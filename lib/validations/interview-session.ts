import { z } from "zod"

export const TranscriptEntrySchema = z.object({
  role: z.enum(["interviewer", "candidate"]),
  text: z.string(),
  at: z.string(),
})

export const CreateInterviewSessionRequestSchema = z.object({
  jobId: z.string(),
})

/** A saved AI answer card (small text; stored as Json on the session). */
export const SavedAnswerSchema = z.object({
  messageId: z.string(),
  question: z.string(),
  answer: z.string(),
  kind: z.string().nullable().optional(),
  language: z.string().nullable().optional(),
  issues: z.array(z.any()).optional(),
  at: z.string(),
})

/** One Code Q&A turn about a screenshot. */
export const SavedCodeQaSchema = z.object({
  id: z.string(),
  question: z.string(),
  source: z.enum(["voice", "typed"]),
  answer: z.string(),
  at: z.string(),
})

/** Upsert body for a captured screenshot (child table, heavy image). */
export const SaveScreenshotRequestSchema = z.object({
  id: z.string(),
  image: z.string().startsWith("data:image/").max(12_000_000),
  text: z.string().default(""),
  model: z.string().nullable().optional(),
  thread: z.array(SavedCodeQaSchema).default([]),
})

export const UpdateInterviewSessionRequestSchema = z.object({
  status: z.enum(["in_progress", "completed"]).optional(),
  transcript: z.array(TranscriptEntrySchema).optional(),
  answers: z.array(SavedAnswerSchema).optional(),
  endedAt: z.string().optional(),
})

export type SavedAnswer = z.infer<typeof SavedAnswerSchema>
export type SavedCodeQa = z.infer<typeof SavedCodeQaSchema>
export type SaveScreenshotRequest = z.infer<typeof SaveScreenshotRequestSchema>

export type TranscriptEntry = z.infer<typeof TranscriptEntrySchema>
export type CreateInterviewSessionRequest = z.infer<
  typeof CreateInterviewSessionRequestSchema
>
export type UpdateInterviewSessionRequest = z.infer<
  typeof UpdateInterviewSessionRequestSchema
>

export type InterviewSessionSummary = {
  id: string
  status: string
  startedAt: string
  endedAt: string | null
  transcript: TranscriptEntry[] | null
  answers: SavedAnswer[] | null
}
