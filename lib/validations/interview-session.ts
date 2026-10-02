import { z } from "zod"

export const TranscriptEntrySchema = z.object({
  role: z.enum(["interviewer", "candidate"]),
  text: z.string(),
  at: z.string(),
})

export const CreateInterviewSessionRequestSchema = z.object({
  interviewId: z.string(),
})

export const UpdateInterviewSessionRequestSchema = z.object({
  status: z.enum(["in_progress", "completed"]).optional(),
  transcript: z.array(TranscriptEntrySchema).optional(),
  endedAt: z.string().optional(),
})

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
}
