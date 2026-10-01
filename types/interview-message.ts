export type RoleType = "interviewer" | "candidate" | "ai" | "system"
export type MessageType =
  | "question"
  | "answer"
  | "feedback"
  | "suggestion"
  | "other"

export interface InterviewMessage {
  id: string

  role: RoleType
  content: string
  messageType: MessageType
  questionAnalysis: QuestionAnalysis | null

  createdAt: Date
  updatedAt: Date

  sessionId: string
}

export interface AnswerMetrics {
  /** Why the turn was committed (see lib/turn/turn-engine.ts) */
  commitReason: string
  /** Interviewer silence at commit time */
  silenceMs: number
  /** Commit → first answer token; 0 when a speculative answer was ready */
  firstTokenMs: number | null
  /** The answer was started before the turn was committed */
  speculated: boolean
  /** Speculative answers thrown away for this question (interviewer kept
   *  talking, or the final text differed) */
  discardedSpeculations: number
  /** Soniox `<end>` lag for this turn (null if committed another way) */
  endpointLagMs: number | null
  /** Judge round-trip for this question (null until it answers) */
  judgeMs: number | null
  /** Model that wrote the answer (shows when the gateway fell back) */
  model: string | null
}

export interface QuestionAnalysis {
  id: string

  question: string
  suggestedAnswer: string
  /** Detected language of the question ("vi", "en", …) */
  language: string | null
  metrics: AnswerMetrics | null
  error: string | null
  /** Question kind from the judge (null until it answers) */
  kind?: string | null

  createdAt: Date
  updatedAt: Date

  messageId: string
}
