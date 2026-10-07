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
import type {
  SavedAnswer,
  SavedCodeQa,
} from "@/lib/validations/interview-session"
import { captureScreen } from "@/lib/screenshot/capture"
import { streamCodeQa, streamScreenshot } from "@/lib/screenshot/stream"
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
  /**
   * On: answer each question as soon as the interviewer finishes. Off:
   * listen and transcribe only; answers come from Answer now (⌘⇧Enter).
   */
  autoAnswer: boolean
  setAutoAnswer: (on: boolean) => void
  /** Coding-question screenshot solutions, oldest first (Screenshot button) */
  screenshotSolutions: ScreenshotSolution[]
  /** Capture the screen and stream a solution; appends a new one */
  captureSolution: () => void
  clearSolutions: () => void
  /** Solution id the overlay's Screenshot view is focused on (code-QA target) */
  codeQaTarget: string | null
  setCodeQaTarget: (id: string | null) => void
  /** Ask about the captured code; appends to that solution's thread */
  askAboutCode: (input: {
    solutionId: string
    question: string
    source: "voice" | "typed"
  }) => void
  /** Your own microphone (candidate stream) is capturing */
  candidateMicActive: boolean
  /** Starts/stops your microphone (set by MicOnlyRecorder while mounted) */
  toggleCandidateMic: (() => void) | null
  /** In-progress (uncommitted) speech per stream */
  live: Record<Role, LiveLine>
  sttError: string | null
  status: CopilotStatus
  /** Why the last turn was skipped ("not a question", "already answered") */
  skipReason: string | null

  messages: InterviewMessage[]

  // Session states
  /** Interview on screen; the server builds the coach's brief from it */
  jobId: string | null
  currentSessionId: string | null

  setMicrophoneStatus: (status: MicrophoneStatus) => void
  setSttError: (error: string | null) => void
  /** Attach a freshly created DB session. */
  startSession: (sessionId: string) => void
  /** Restore a saved session: answer cards + screenshots back into the view. */
  hydrateSession: (payload: ResumePayload) => void
  /** Clear everything from the previous session and switch interview. */
  resetSession: (jobId?: string | null) => void

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
    // Restored after mount (restoreAutoAnswer) so SSR markup matches
    autoAnswer: true,
    screenshotSolutions: [],
    captureSolution: () => void runScreenshot(),
    clearSolutions: () => {
      screenshotController?.abort()
      screenshotController = null
      set({ screenshotSolutions: [] })
    },
    codeQaTarget: null,
    setCodeQaTarget: (id) => set({ codeQaTarget: id }),
    askAboutCode: (input) => void runCodeQa(input),
    setAutoAnswer: (on) => {
      saveAutoAnswer(on)
      if (!on) abortPause()
      set({ autoAnswer: on })
    },
    candidateMicActive: false,
    toggleCandidateMic: null,
    live: EMPTY_LIVE,
    sttError: null,
    status: "idle",
    skipReason: null,
    messages: [],
    jobId: null,
    currentSessionId: null,

    setMicrophoneStatus: (status) => set({ microphoneStatus: status }),
    setSttError: (error) => set({ sttError: error }),

    startSession: (sessionId) => set({ currentSessionId: sessionId }),

    hydrateSession: (payload) => hydrateSessionFromPayload(payload),

    resetSession: (jobId = null) => {
      abortPause()
      screenshotController?.abort()
      screenshotController = null
      for (const answer of answers.values()) answer.controller.abort()
      answers.clear()
      lastAnsweredQuestion = null
      turnEngine.reset()
      set({
        jobId,
        currentSessionId: null,
        messages: [],
        live: EMPTY_LIVE,
        sttError: null,
        status: "idle",
        skipReason: null,
        screenshotSolutions: [],
        codeQaTarget: null,
      })
    },

    answerNow: () => {
      // In the overlay's Screenshot view: answer the latest spoken question
      // about the code (grounded in the screenshot), not via the coach
      const target = useInterviewSessionStore.getState().codeQaTarget
      if (target) {
        const question = latestInterviewerQuestion()
        if (question) {
          runCodeQa({ solutionId: target, question, source: "voice" })
        }
        return
      }
      if (turnEngine.forceCommit(performance.now())) return
      // Manual mode: the interviewer finished, nothing answered it yet
      const unanswered = lastUnansweredQuestion()
      if (unanswered) return answerMessage(unanswered)
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

// The auto-answer switch is remembered per browser (a convenience only)
const AUTO_ANSWER_KEY = "copilot:auto-answer"

/** Call once on mount: brings back the switch's last position. */
export function restoreAutoAnswer() {
  let on = true
  try {
    on = localStorage.getItem(AUTO_ANSWER_KEY) !== "off"
  } catch {
    // Default: on
  }
  store.setState({ autoAnswer: on })
}

function saveAutoAnswer(on: boolean) {
  try {
    localStorage.setItem(AUTO_ANSWER_KEY, on ? "on" : "off")
  } catch {
    // Not remembered; the switch still works for this page
  }
}

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
  // Manual mode drafts nothing ahead (no judge, no hidden answer)
  onPause: (text, language) => {
    if (store.getState().autoAnswer) startPause(text, language)
  },
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

/** The newest interviewer line, if no answer card came after it. */
function lastUnansweredQuestion() {
  const messages = store.getState().messages
  const last = messages.findLast((m) => m.role === "interviewer")
  if (!last || last.questionAnalysis) return null
  const lastCard = messages.findLastIndex((m) => m.questionAnalysis)
  return messages.indexOf(last) > lastCard ? last : null
}

// ─── Screenshot solutions ─────────────────────────────────────────────────────

/** A follow-up question about the captured code and its streamed answer */
export interface CodeQaEntry {
  id: string
  question: string
  source: "voice" | "typed"
  answer: string
  streaming: boolean
  error: string | null
  createdAt: Date
}

export interface ScreenshotSolution {
  id: string
  /** The captured screenshot (data URL), kept so Code Q&A can reuse it */
  image: string
  /** Markdown, streaming in */
  text: string
  capturing: boolean
  streaming: boolean
  error: string | null
  model: string | null
  createdAt: Date
  /** Questions about this code and their answers, oldest first */
  thread: CodeQaEntry[]
}

// ─── Code Q&A (questions about a captured screenshot) ────────────────────────

let codeQaController: AbortController | null = null

/** The interviewer's current/last spoken question, for a voice code-QA. */
function latestInterviewerQuestion(): string {
  const live = store.getState().live.interviewer.text.trim()
  if (live) return live
  const last = [...store.getState().messages]
    .reverse()
    .find((m) => m.role === "interviewer")
  return last?.content.trim() ?? ""
}

async function runCodeQa({
  solutionId,
  question,
  source,
}: {
  solutionId: string
  question: string
  source: "voice" | "typed"
}) {
  const solution = store
    .getState()
    .screenshotSolutions.find((s) => s.id === solutionId)
  if (!solution || !solution.image || !question.trim()) return

  codeQaController?.abort()
  const controller = new AbortController()
  codeQaController = controller
  const entryId = crypto.randomUUID()
  const language = store.getState().live.interviewer.language

  // History (prior Q&A) and the image are captured now, before streaming
  const history = solution.thread
    .filter((t) => t.answer && !t.error)
    .map((t) => ({ question: t.question, answer: t.answer }))
  const image = solution.image
  const solutionText = solution.text

  // Append the new entry to this solution's thread
  const updateThread = (fn: (entry: CodeQaEntry) => CodeQaEntry) =>
    store.setState((st) => ({
      screenshotSolutions: st.screenshotSolutions.map((shot) =>
        shot.id === solutionId
          ? {
              ...shot,
              thread: shot.thread.map((e) => (e.id === entryId ? fn(e) : e)),
            }
          : shot
      ),
    }))
  store.setState((st) => ({
    screenshotSolutions: st.screenshotSolutions.map((shot) =>
      shot.id === solutionId
        ? {
            ...shot,
            thread: [
              ...shot.thread,
              {
                id: entryId,
                question: question.trim(),
                source,
                answer: "",
                streaming: true,
                error: null,
                createdAt: new Date(),
              },
            ],
          }
        : shot
    ),
  }))

  try {
    await streamCodeQa(
      {
        image,
        solution: solutionText,
        history,
        question: question.trim(),
        language,
      },
      {
        onDelta: (delta) =>
          updateThread((e) => ({ ...e, answer: e.answer + delta })),
        onDone: () => {
          updateThread((e) => ({ ...e, streaming: false }))
          persistScreenshot(solutionId)
        },
      },
      controller.signal
    )
  } catch (error) {
    if (controller.signal.aborted) return
    updateThread((e) => ({
      ...e,
      streaming: false,
      error: error instanceof Error ? error.message : "Code answer failed",
    }))
  }
}

let screenshotController: AbortController | null = null

async function runScreenshot() {
  screenshotController?.abort()
  const controller = new AbortController()
  screenshotController = controller
  const id = crypto.randomUUID()
  const language = store.getState().live.interviewer.language

  // Update this run's entry by id (guards against a late delta from an
  // aborted/superseded run clobbering a newer one)
  const patch = (update: Partial<ScreenshotSolution>) =>
    store.setState((s) => ({
      screenshotSolutions: s.screenshotSolutions.map((shot) =>
        shot.id === id ? { ...shot, ...update } : shot
      ),
    }))

  const current = () =>
    store.getState().screenshotSolutions.find((shot) => shot.id === id)

  // Append a new entry (so earlier captures stay in history for the pager)
  store.setState((s) => ({
    screenshotSolutions: [
      ...s.screenshotSolutions,
      {
        id,
        image: "",
        text: "",
        capturing: true,
        streaming: false,
        error: null,
        model: null,
        createdAt: new Date(),
        thread: [],
      },
    ],
  }))

  let image: string
  try {
    image = await captureScreen()
  } catch (error) {
    if (controller.signal.aborted) return
    patch({
      capturing: false,
      error: error instanceof Error ? error.message : "Capture failed",
    })
    return
  }
  if (controller.signal.aborted) return
  // Keep the image so Code Q&A can ground follow-ups in the same screenshot
  patch({ image, capturing: false, streaming: true })

  try {
    await streamScreenshot(
      { image, language },
      {
        onDelta: (delta) => patch({ text: (current()?.text ?? "") + delta }),
        onDone: (model) => {
          patch({ streaming: false, model })
          persistScreenshot(id)
        },
      },
      controller.signal
    )
  } catch (error) {
    if (controller.signal.aborted) return
    patch({
      streaming: false,
      error: error instanceof Error ? error.message : "Solution failed",
    })
  }
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

// ─── Persistence: save answers / screenshots, restore a session ─────────────

export interface ResumePayload {
  id: string
  transcript?:
    | { role: "interviewer" | "candidate"; text: string; at: string }[]
    | null
  answers?: SavedAnswer[] | null
  screenshots?:
    | {
        id: string
        image: string
        text: string
        model: string | null
        thread?: SavedCodeQa[] | null
        createdAt: string
      }[]
    | null
}

/** The current answer cards as the serializable shape stored on the session. */
function savedAnswers(): SavedAnswer[] {
  return store
    .getState()
    .messages.filter((m) => m.questionAnalysis)
    .map((m) => {
      const a = m.questionAnalysis!
      return {
        messageId: a.messageId,
        question: a.question,
        answer: a.suggestedAnswer,
        kind: a.kind ?? null,
        language: a.language,
        issues: a.issues ?? [],
        at: new Date(a.createdAt).toISOString(),
      }
    })
}

/** Save all answer cards to the session (fire-and-forget, like the ledger). */
function persistAnswers() {
  const sessionId = store.getState().currentSessionId
  if (!sessionId) return
  void fetch(`/api/interview-sessions/${sessionId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ answers: savedAnswers() }),
  }).catch(() => {})
}

/** Upsert one screenshot (solution + thread) to the session. */
function persistScreenshot(id: string) {
  const sessionId = store.getState().currentSessionId
  if (!sessionId) return
  const shot = store.getState().screenshotSolutions.find((s) => s.id === id)
  if (!shot || !shot.image) return
  void fetch(`/api/interview-sessions/${sessionId}/screenshots`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      id: shot.id,
      image: shot.image,
      text: shot.text,
      model: shot.model,
      thread: shot.thread
        .filter((t) => t.answer && !t.error)
        .map((t) => ({
          id: t.id,
          question: t.question,
          source: t.source,
          answer: t.answer,
          at: new Date(t.createdAt).toISOString(),
        })),
    }),
  }).catch(() => {})
}

/** Rebuild the store from a saved session (answer cards + screenshots). */
function hydrateSessionFromPayload(payload: ResumePayload) {
  const transcript = payload.transcript ?? []
  const savedCards = payload.answers ?? []
  const shots = payload.screenshots ?? []

  const messages: InterviewMessage[] = transcript.map((t) => ({
    id: crypto.randomUUID(),
    role: t.role,
    content: t.text,
    messageType: "other",
    questionAnalysis: null,
    createdAt: new Date(t.at),
    updatedAt: new Date(t.at),
    sessionId: payload.id,
  }))

  for (const a of savedCards) {
    const at = new Date(a.at)
    const card: Analysis = {
      id: a.messageId,
      messageId: a.messageId,
      question: a.question,
      suggestedAnswer: a.answer,
      language: a.language ?? null,
      metrics: null,
      error: null,
      issues: (a.issues as Analysis["issues"]) ?? [],
      kind: a.kind ?? null,
      recorded: true,
      createdAt: at,
      updatedAt: at,
    }
    // Attach to the best-matching interviewer line without a card; else new
    let best = -1
    let bestScore = 0
    messages.forEach((m, i) => {
      if (m.role !== "interviewer" || m.questionAnalysis) return
      const score = textSimilarity(m.content, a.question)
      if (score > bestScore) {
        bestScore = score
        best = i
      }
    })
    if (best >= 0 && bestScore >= 0.5) {
      messages[best] = { ...messages[best], id: a.messageId, questionAnalysis: card }
    } else {
      messages.push({
        id: a.messageId,
        role: "interviewer",
        content: a.question,
        messageType: "other",
        questionAnalysis: card,
        createdAt: at,
        updatedAt: at,
        sessionId: payload.id,
      })
    }
  }
  messages.sort((x, y) => x.createdAt.getTime() - y.createdAt.getTime())

  const screenshotSolutions: ScreenshotSolution[] = shots.map((s) => ({
    id: s.id,
    image: s.image,
    text: s.text,
    capturing: false,
    streaming: false,
    error: null,
    model: s.model ?? null,
    createdAt: new Date(s.createdAt),
    thread: (s.thread ?? []).map((t) => ({
      id: t.id,
      question: t.question,
      source: t.source,
      answer: t.answer,
      streaming: false,
      error: null,
      createdAt: new Date(t.at),
    })),
  }))

  lastAnsweredQuestion = savedCards.at(-1)?.question ?? null
  store.setState({
    currentSessionId: payload.id,
    messages,
    screenshotSolutions,
  })
}

/** Visible answer runs by message id */
const answers = new Map<string, AnswerRun>()
let lastAnsweredQuestion: string | null = null

function startAnswer(question: string, language: string | null): AnswerRun {
  const { jobId, currentSessionId } = store.getState()
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
      jobId: jobId ?? "",
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
        persistAnswers()
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

  // Manual mode: record what was said; Answer now answers it
  if (!store.getState().autoAnswer && turn.reason !== "manual") {
    abortPause()
    const previous = turn.amends ? lastUnansweredQuestion() : null
    if (previous) {
      store.setState((s) => ({
        messages: s.messages.map((m) =>
          m.id === previous.id ? { ...m, content: turn.text } : m
        ),
      }))
    } else {
      appendMessage("interviewer", turn.text)
    }
    store.setState({ status: "idle", skipReason: null })
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
  answerTurn(id, turn, commitAt)
}

/** Manual mode: answer an interviewer line that was recorded earlier. */
function answerMessage(message: InterviewMessage) {
  abortPause()
  recordPreviousAnswer()
  const turn: CommittedTurn = {
    text: message.content,
    language: null,
    reason: "manual",
    silenceMs: 0,
    amends: false,
    answerable: true,
    endpointLagMs: null,
  }
  answerTurn(message.id, turn, performance.now())
}

/** Judge + answer the interviewer line `id` (its card shows the answer). */
function answerTurn(id: string, turn: CommittedTurn, commitAt: number) {

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
