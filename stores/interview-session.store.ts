import { create } from "zustand"

import type { AnswerMetrics, InterviewMessage } from "@/types/interview-message"
import { MicrophoneStatus } from "@/types/interview-session"
import { INTERVIEW_DEFAULTS } from "@/config/defaults/interview"
import {
  judgeTurn,
  streamAnswer,
  type JudgeResult,
} from "@/lib/answer/stream-answer"
import type { AnswerIssue } from "@/lib/answer/validate"
import { SAME_QUESTION, textSimilarity } from "@/lib/turn/similarity"
import {
  TurnEngine,
  type CommittedTurn,
  type Role,
} from "@/lib/turn/turn-engine"

export interface LiveLine {
  text: string
  language: string | null
}

/**
 * What the copilot is doing, shown above the suggestions:
 * idle → listening → (waiting for the rest) → answering | skipped
 */
export type CopilotStatus =
  | "idle"
  | "listening"
  | "waiting"
  | "answering"
  | "skipped"

interface InterviewSessionStore {
  /** Meeting-tab capture status */
  microphoneStatus: MicrophoneStatus
  /** In-progress (uncommitted) speech per stream */
  live: Record<Role, LiveLine>
  sttError: string | null
  status: CopilotStatus
  /** Why the last turn was skipped ("not a question", "already answered") */
  skipReason: string | null

  messages: InterviewMessage[]

  // Session states
  /** Interview on screen; the server builds the coach's brief from it */
  interviewId: string | null
  currentSessionId: string | null

  setMicrophoneStatus: (status: MicrophoneStatus) => void
  setSttError: (error: string | null) => void
  /** Attach a freshly created DB session. */
  startSession: (sessionId: string) => void
  /** Clear everything from the previous session and switch interview. */
  resetSession: (interviewId?: string | null) => void

  // Manual controls (buttons + hotkeys)
  /** Answer what the interviewer has said so far, or redo the last answer */
  answerNow: () => void
  /** Stop and hide the answer being generated / shown last */
  skipCurrent: () => void
  regenerate: (messageId: string) => void
}

const EMPTY_LIVE: Record<Role, LiveLine> = {
  interviewer: { text: "", language: null },
  candidate: { text: "", language: null },
}

export const useInterviewSessionStore = create<InterviewSessionStore>()(
  (set) => ({
    microphoneStatus: "disconnected",
    live: EMPTY_LIVE,
    sttError: null,
    status: "idle",
    skipReason: null,
    messages: [],
    interviewId: null,
    currentSessionId: null,

    setMicrophoneStatus: (status) => set({ microphoneStatus: status }),
    setSttError: (error) => set({ sttError: error }),

    startSession: (sessionId) => set({ currentSessionId: sessionId }),

    resetSession: (interviewId = null) => {
      abortPause()
      for (const answer of answers.values()) answer.controller.abort()
      answers.clear()
      lastAnsweredQuestion = null
      turnEngine.reset()
      set({
        interviewId,
        currentSessionId: null,
        messages: [],
        live: EMPTY_LIVE,
        sttError: null,
        status: "idle",
        skipReason: null,
      })
    },

    answerNow: () => {
      if (turnEngine.forceCommit(performance.now())) return
      const last = lastAnswerCard()
      if (last) regenerateAnswer(last.id)
    },

    skipCurrent: () => {
      abortPause()
      const last = lastAnswerCard()
      if (last) dropCard(last.id, "skipped")
    },

    regenerate: (messageId) => regenerateAnswer(messageId),
  })
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
  onPause: (text, language) => startPause(text, language),
  onResume: () => abortPause(),
  onCommit: (turn) => commitInterviewerTurn(turn),
  onCandidateTurn: (text) => appendMessage("candidate", text),
  onStatus: (status) => {
    // "answering" / "skipped" are owned by the answer flow until new speech
    if (status === "idle" && store.getState().status !== "listening") return
    store.setState({ status, skipReason: null })
  },
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

function updateMetrics(messageId: string, patch: Partial<AnswerMetrics>) {
  updateAnalysis(messageId, (a) => ({
    metrics: a.metrics ? { ...a.metrics, ...patch } : a.metrics,
  }))
}

function recentContext(excludeId = "") {
  return store
    .getState()
    .messages.filter((m) => m.id !== excludeId)
    .slice(-6)
    .map((m) => ({ role: m.role, content: m.content }))
}

function lastAnswerCard() {
  return [...store.getState().messages]
    .reverse()
    .find((m) => m.questionAnalysis !== null)
}

// ─── Answer generation ────────────────────────────────────────────────────────

interface AnswerRun {
  question: string
  controller: AbortController
  text: string
  firstTokenAt: number | null
  /** Model that answered, once the stream is done */
  model: string | null
  /** Validator warnings, once the stream is done */
  issues: AnswerIssue[]
  /** Card showing this run; null while it is a hidden draft */
  messageId: string | null
  commitAt: number | null
}

/** Visible answer runs by message id */
const answers = new Map<string, AnswerRun>()
let lastAnsweredQuestion: string | null = null

function startAnswer(question: string, language: string | null): AnswerRun {
  const { interviewId, currentSessionId } = store.getState()
  const run: AnswerRun = {
    question,
    controller: new AbortController(),
    text: "",
    firstTokenAt: null,
    model: null,
    issues: [],
    messageId: null,
    commitAt: null,
  }

  streamAnswer(
    {
      interviewId: interviewId ?? "",
      sessionId: currentSessionId,
      text: question,
      language,
      context: recentContext(),
    },
    {
      onDelta: (delta) => {
        const isFirst = run.firstTokenAt === null
        if (isFirst) run.firstTokenAt = performance.now()
        run.text += delta
        if (!run.messageId) return
        if (isFirst) recordFirstToken(run)
        updateAnalysis(run.messageId, (a) => ({
          suggestedAnswer: a.suggestedAnswer + delta,
        }))
      },
      onDone: ({ model, issues }) => {
        run.model = model
        run.issues = issues
        if (!run.messageId) return
        updateMetrics(run.messageId, { model })
        updateAnalysis(run.messageId, () => ({ issues }))
      },
    },
    run.controller.signal
  ).catch((error: unknown) => {
    if (run.controller.signal.aborted || !run.messageId) return
    updateAnalysis(run.messageId, () => ({
      error: error instanceof Error ? error.message : String(error),
    }))
  })

  return run
}

/** Attach a run (fresh or a promoted draft) to a card. */
function showAnswer(run: AnswerRun, messageId: string, commitAt: number) {
  run.messageId = messageId
  run.commitAt = commitAt
  answers.set(messageId, run)
  updateAnalysis(messageId, () => ({ suggestedAnswer: run.text }))
  if (run.firstTokenAt !== null) {
    updateMetrics(messageId, {
      firstTokenMs: Math.max(0, Math.round(run.firstTokenAt - commitAt)),
    })
  }
  // A promoted draft may have finished before it got a card
  if (run.model) {
    updateMetrics(messageId, { model: run.model })
    updateAnalysis(messageId, () => ({ issues: run.issues }))
  }
  lastAnsweredQuestion = run.question
  store.setState({ status: "answering", skipReason: null })
}

function recordFirstToken(run: AnswerRun) {
  if (!run.messageId || run.commitAt === null) return
  updateMetrics(run.messageId, {
    firstTokenMs: Math.round(performance.now() - run.commitAt),
  })
}

function dropCard(messageId: string, reason: string) {
  answers.get(messageId)?.controller.abort()
  answers.delete(messageId)
  store.setState((s) => ({
    status: "skipped",
    skipReason: reason,
    messages: s.messages.map((m) =>
      m.id === messageId ? { ...m, questionAnalysis: null } : m
    ),
  }))
}

function regenerateAnswer(messageId: string) {
  const message = store.getState().messages.find((m) => m.id === messageId)
  const analysis = message?.questionAnalysis
  if (!message || !analysis) return
  answers.get(messageId)?.controller.abort()
  updateAnalysis(messageId, () => ({ suggestedAnswer: "", error: null }))
  showAnswer(
    startAnswer(analysis.question, analysis.language),
    messageId,
    performance.now()
  )
}

// ─── Pause: judge + hidden draft in parallel ──────────────────────────────────
// Started when the interviewer pauses. The draft is shown only if the
// committed question is (nearly) the same; the judge verdict both gates the
// turn engine and, after commit, can veto or re-target the answer.

interface PendingJudge {
  text: string
  controller: AbortController
  result: Promise<JudgeResult>
}

let draft: AnswerRun | null = null
let draftsDiscarded = 0
let pendingJudge: PendingJudge | null = null

function startPause(text: string, language: string | null) {
  abortPause()
  draft = startAnswer(text, language)

  const controller = new AbortController()
  const judge: PendingJudge = {
    text,
    controller,
    result: judgeTurn(
      {
        text,
        context: recentContext(),
        lastAnsweredQuestion,
      },
      controller.signal
    ),
  }
  pendingJudge = judge
  void judge.result.then((verdict) => {
    if ("unavailable" in verdict) return
    turnEngine.onJudge(judge.text, verdict)
  })
}

function abortPause() {
  if (draft && !draft.messageId) {
    draft.controller.abort()
    draftsDiscarded++
  }
  draft = null
  pendingJudge?.controller.abort()
  pendingJudge = null
}

// ─── Committing interviewer turns ─────────────────────────────────────────────

/**
 * Before a new question: record the previous one — and what the candidate
 * actually said to it — in the session ledger (background, best effort).
 */
function recordPreviousAnswer() {
  const { messages, currentSessionId } = store.getState()
  if (!currentSessionId) return
  const cardIndex = messages.findLastIndex((m) => m.questionAnalysis)
  if (cardIndex === -1) return
  const card = messages[cardIndex].questionAnalysis!
  if (card.recorded) return
  const said = messages
    .slice(cardIndex + 1)
    .filter((m) => m.role === "candidate")
    .map((m) => m.content)
    .join(" ")
  if (!said.trim()) return
  updateAnalysis(card.messageId, () => ({ recorded: true }))
  void fetch("/api/assistant/ledger", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      sessionId: currentSessionId,
      question: card.question,
      kind: card.kind ?? "other",
      suggested: card.suggestedAnswer,
      said,
    }),
  }).catch(() => {})
}

function commitInterviewerTurn(turn: CommittedTurn) {
  const commitAt = performance.now()

  if (!turn.answerable) {
    abortPause()
    appendMessage("interviewer", turn.text)
    store.setState({ status: "skipped", skipReason: "not a question" })
    return
  }

  if (!turn.amends) recordPreviousAnswer()

  // Amend: re-answer the previous question's card with the longer question
  let messageId: string | null = null
  if (turn.amends) {
    const previous = [...store.getState().messages]
      .reverse()
      .find((m) => m.role === "interviewer")
    if (previous) {
      messageId = previous.id
      answers.get(previous.id)?.controller.abort()
      answers.delete(previous.id)
      store.setState((s) => ({
        messages: s.messages.map((m) =>
          m.id === previous.id ? { ...m, content: turn.text } : m
        ),
      }))
    }
  }
  const id = messageId ?? appendMessage("interviewer", turn.text)

  // Reuse the pause's judge call when it judged (nearly) this text
  const judge =
    pendingJudge &&
    textSimilarity(pendingJudge.text, turn.text) >= SAME_QUESTION
      ? pendingJudge
      : null
  const judgeController = judge?.controller ?? new AbortController()
  const judgeResult =
    judge?.result ??
    judgeTurn(
      {
        text: turn.text,
        context: recentContext(id),
        lastAnsweredQuestion,
      },
      judgeController.signal
    )
  pendingJudge = null

  // Promote the hidden draft when it answered (nearly) this question
  const promoted =
    draft !== null &&
    !turn.amends &&
    textSimilarity(draft.question, turn.text) >= SAME_QUESTION
      ? draft
      : null
  if (draft && !promoted) {
    draft.controller.abort()
    draftsDiscarded++
  }
  draft = null

  const metrics: AnswerMetrics = {
    commitReason: turn.reason,
    silenceMs: Math.round(turn.silenceMs),
    firstTokenMs: null,
    speculated: promoted !== null,
    discardedSpeculations: draftsDiscarded,
    endpointLagMs: turn.endpointLagMs,
    judgeMs: null,
    model: null,
  }
  draftsDiscarded = 0

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
              suggestedAnswer: "",
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

  showAnswer(promoted ?? startAnswer(turn.text, turn.language), id, commitAt)

  // The verdict may arrive after the answer started: veto or re-target it
  void judgeResult.then((verdict) => {
    updateMetrics(id, { judgeMs: verdict.judgeMs })
    if ("unavailable" in verdict) return
    if (!store.getState().messages.some((m) => m.id === id)) return
    updateAnalysis(id, () => ({ kind: verdict.kind }))

    if (!verdict.isAsk) {
      dropCard(id, "not a question")
      return
    }
    if (verdict.duplicate && turn.reason !== "manual") {
      dropCard(id, "already answered")
      return
    }

    const question = verdict.question.trim()
    const current = answers.get(id)
    if (question && current) {
      updateAnalysis(id, () => ({ question }))
      // Merged context / resolved follow-up: answer the real question
      if (textSimilarity(question, current.question) < SAME_QUESTION) {
        current.controller.abort()
        updateAnalysis(id, () => ({ suggestedAnswer: "" }))
        showAnswer(startAnswer(question, turn.language), id, commitAt)
      }
    }
  })
}
