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
}

export interface QuestionAnalysis {
  id: string

  question: string
  suggestedAnswer: string
  /** Detected language of the question ("vi", "en", …) */
  language: string | null
  metrics: AnswerMetrics | null
  error: string | null

  createdAt: Date
  updatedAt: Date

  messageId: string
}
