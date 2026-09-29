import { useChatDocumentStore } from "@/stores/chat-document-store"
import type { AgentInputItem } from "@openai/agents"
import { create } from "zustand"
import { createJSONStorage, persist } from "zustand/middleware"

import type { AnswerMetrics, InterviewMessage } from "@/types/interview-message"
import { MicrophoneStatus } from "@/types/interview-session"
import { INTERVIEW_DEFAULTS } from "@/config/defaults/interview"
import { classifyQuestion, streamAnswer } from "@/lib/answer/stream-answer"
import {
  TurnEngine,
  type CommittedTurn,
  type Role,
} from "@/lib/turn/turn-engine"

export interface LiveLine {
  text: string
  language: string | null
}

interface InterviewSessionStore {
  /** Meeting-tab capture status */
  microphoneStatus: MicrophoneStatus
  /** In-progress (uncommitted) speech per stream */
  live: Record<Role, LiveLine>
  sttError: string | null

  messages: InterviewMessage[]

  // Agent memory
  agentHistory: AgentInputItem[]

  // Session states
  currentSessionId: string | null
  sessionContext: string

  setMicrophoneStatus: (status: MicrophoneStatus) => void
  setSttError: (error: string | null) => void
  /** Attach a freshly created DB session (id + context for the coach). */
  startSession: (sessionId: string, sessionContext: string) => void
  /** Clear everything from the previous session (transcript, answers, memory). */
  resetSession: () => void
}

const EMPTY_LIVE: Record<Role, LiveLine> = {
  interviewer: { text: "", language: null },
  candidate: { text: "", language: null },
}

export const useInterviewSessionStore = create<InterviewSessionStore>()(
  persist(
    (set) => ({
      microphoneStatus: "disconnected",
      live: EMPTY_LIVE,
      sttError: null,
      messages: [],
      agentHistory: [],
      currentSessionId: null,
      sessionContext: "",

      setMicrophoneStatus: (status) => set({ microphoneStatus: status }),
      setSttError: (error) => set({ sttError: error }),

      startSession: (sessionId, sessionContext) =>
        set({ currentSessionId: sessionId, sessionContext }),

      resetSession: () => {
        cancelSpeculation()
        for (const controller of activeAnswers.values()) controller.abort()
        activeAnswers.clear()
        turnEngine.reset()
        set({
          currentSessionId: null,
          sessionContext: "",
          messages: [],
          agentHistory: [],
          live: EMPTY_LIVE,
          sttError: null,
        })
      },
    }),
    {
      name: "interview-agent-history",
      storage: createJSONStorage(() => sessionStorage),
      partialize: (state) => ({ agentHistory: state.agentHistory }),
    }
  )
)

const store = useInterviewSessionStore

// ─── Turn engine wiring ────────────────────────────────────────────────────────

const finalizers: Partial<Record<Role, () => void>> = {}

/** Lets a live transcriber expose "finalize now" to the turn engine. */
export function registerFinalizer(role: Role, finalize: (() => void) | null) {
  if (finalize) finalizers[role] = finalize
  else delete finalizers[role]
}

export const turnEngine = new TurnEngine(INTERVIEW_DEFAULTS, {
  onLive: (role, text, language) =>
    store.setState((s) => ({
      live: { ...s.live, [role]: { text, language } },
    })),
  onFinalizeRequest: (role) => finalizers[role]?.(),
  onSpeculate: (text, language) => speculate(text, language),
  onCancelSpeculation: () => cancelSpeculation(),
  onCommit: (turn) => commitInterviewerTurn(turn),
  onCandidateTurn: (text) => appendMessage("candidate", text),
})

// ─── Messages ──────────────────────────────────────────────────────────────────

function appendMessage(role: "interviewer" | "candidate", content: string) {
  const id = crypto.randomUUID()
  const now = new Date()
  store.setState((s) => ({
    messages: [
      ...s.messages,
      {
        id,
        role,
        content,
        messageType: "other",
        questionAnalysis: null,
        createdAt: now,
        updatedAt: now,
        sessionId: s.currentSessionId ?? "",
      },
    ],
  }))
  return id
}

type Analysis = NonNullable<InterviewMessage["questionAnalysis"]>

function updateAnalysis(
  messageId: string,
  update: (analysis: Analysis) => Partial<Analysis>
) {
  store.setState((s) => ({
    messages: s.messages.map((m) =>
      m.id === messageId && m.questionAnalysis
        ? {
            ...m,
            questionAnalysis: {
              ...m.questionAnalysis,
              ...update(m.questionAnalysis),
            },
          }
        : m
    ),
  }))
}

function recentContext(excludeId: string) {
  return store
    .getState()
    .messages.filter((m) => m.id !== excludeId)
    .slice(-4)
    .map((m) => ({ role: m.role, content: m.content }))
}

function answerRequest(text: string, language: string | null, excludeId = "") {
  const { coachDocuments, fastMode } = useChatDocumentStore.getState()
  const state = store.getState()
  return {
    text,
    language,
    agentHistory: state.agentHistory,
    context: recentContext(excludeId),
    sessionContext: state.sessionContext,
    selectedDocuments: coachDocuments,
    fastMode,
  }
}

function normalize(text: string) {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, "")
    .replace(/\s+/g, " ")
    .trim()
}

// ─── Speculative answers ──────────────────────────────────────────────────────
// Started when the interviewer pauses; shown only if the committed question
// matches, otherwise aborted (client and server side).

interface Speculation {
  text: string
  controller: AbortController
  answer: string
  firstTokenAt: number | null
  history: AgentInputItem[] | null
  /** Card the speculation was promoted into, once committed */
  messageId: string | null
  commitAt: number | null
}

let speculation: Speculation | null = null
/** Answer requests backing visible cards, by message id */
const activeAnswers = new Map<string, AbortController>()

function speculate(text: string, language: string | null) {
  cancelSpeculation()
  const controller = new AbortController()
  const spec: Speculation = {
    text,
    controller,
    answer: "",
    firstTokenAt: null,
    history: null,
    messageId: null,
    commitAt: null,
  }
  speculation = spec

  streamAnswer(
    answerRequest(text, language),
    {
      onDelta: (delta) => {
        const isFirst = spec.firstTokenAt === null
        if (isFirst) spec.firstTokenAt = performance.now()
        spec.answer += delta
        if (spec.messageId) {
          const id = spec.messageId
          if (isFirst) recordFirstToken(id, spec.commitAt)
          updateAnalysis(id, (a) => ({
            suggestedAnswer: a.suggestedAnswer + delta,
          }))
        }
      },
      onDone: (history) => {
        spec.history = history
        // Only a promoted (committed) answer becomes agent memory
        if (spec.messageId) store.setState({ agentHistory: history })
      },
    },
    controller.signal
  ).catch((error: unknown) => {
    if (controller.signal.aborted || !spec.messageId) return
    updateAnalysis(spec.messageId, () => ({
      error: error instanceof Error ? error.message : String(error),
    }))
  })
}

function cancelSpeculation() {
  // A promoted speculation backs a card; activeAnswers owns its lifetime
  if (speculation && !speculation.messageId) speculation.controller.abort()
  speculation = null
}

function recordFirstToken(messageId: string, commitAt: number | null) {
  const firstTokenMs =
    commitAt === null ? null : Math.round(performance.now() - commitAt)
  updateAnalysis(messageId, (a) => ({
    metrics: a.metrics ? { ...a.metrics, firstTokenMs } : a.metrics,
  }))
}

// ─── Committing interviewer turns ─────────────────────────────────────────────

function commitInterviewerTurn(turn: CommittedTurn) {
  const commitAt = performance.now()
  const state = store.getState()

  // Amend: replace the previous question's card rather than adding one
  let messageId: string | null = null
  if (turn.amends) {
    const previous = [...state.messages]
      .reverse()
      .find((m) => m.role === "interviewer")
    if (previous) {
      messageId = previous.id
      activeAnswers.get(previous.id)?.abort()
      activeAnswers.delete(previous.id)
      store.setState((s) => ({
        messages: s.messages.map((m) =>
          m.id === previous.id ? { ...m, content: turn.text } : m
        ),
      }))
    }
  }
  const id = messageId ?? appendMessage("interviewer", turn.text)

  const spec = speculation
  const promoted =
    spec !== null &&
    spec.messageId === null &&
    !turn.amends &&
    normalize(spec.text) === normalize(turn.text)

  const metrics: AnswerMetrics = {
    commitReason: turn.reason,
    silenceMs: Math.round(turn.silenceMs),
    firstTokenMs: promoted && spec.firstTokenAt !== null ? 0 : null,
    speculated: promoted,
  }

  const now = new Date()
  store.setState((s) => ({
    messages: s.messages.map((m) =>
      m.id === id
        ? {
            ...m,
            questionAnalysis: {
              id,
              messageId: id,
              question: turn.text,
              suggestedAnswer: promoted ? spec.answer : "",
              language: turn.language,
              metrics,
              error: null,
              createdAt: now,
              updatedAt: now,
            },
          }
        : m
    ),
  }))

  let controller: AbortController
  if (promoted) {
    spec.messageId = id
    spec.commitAt = commitAt
    controller = spec.controller
    if (spec.history) store.setState({ agentHistory: spec.history })
    speculation = null
  } else {
    cancelSpeculation()
    controller = new AbortController()
    let first = true
    streamAnswer(
      answerRequest(turn.text, turn.language, id),
      {
        onDelta: (delta) => {
          if (first) {
            first = false
            recordFirstToken(id, commitAt)
          }
          updateAnalysis(id, (a) => ({
            suggestedAnswer: a.suggestedAnswer + delta,
          }))
        },
        onDone: (history) => store.setState({ agentHistory: history }),
      },
      controller.signal
    ).catch((error: unknown) => {
      if (controller.signal.aborted) return
      updateAnalysis(id, () => ({
        error: error instanceof Error ? error.message : String(error),
      }))
    })
  }
  activeAnswers.set(id, controller)

  // One-word turns ("okay", "right", "ừ") are acknowledgements, not
  // questions — unless punctuated as one ("Why?")
  if (
    turn.text.trim().split(/\s+/).length < 2 &&
    !turn.text.trim().endsWith("?")
  ) {
    controller.abort()
    dropCard(id)
    return
  }
  // Everything else: let the classifier veto in parallel with the answer
  void classifyQuestion(turn.text, recentContext(id), controller.signal).then(
    (isQuestion) => {
      if (isQuestion || controller.signal.aborted) return
      controller.abort()
      dropCard(id)
    }
  )
}

function dropCard(messageId: string) {
  activeAnswers.delete(messageId)
  store.setState((s) => ({
    messages: s.messages.map((m) =>
      m.id === messageId ? { ...m, questionAnalysis: null } : m
    ),
  }))
}
