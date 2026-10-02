import { z } from "zod"

export const InterviewSchema = z.object({
  id: z.string(),
  name: z.string(),
  companyName: z.string().nullable(),
  jobTitle: z.string().nullable(),
  scheduledAt: z.string().nullable(),
  notes: z.string().nullable(),
  documentIds: z.array(z.string()),
  createdAt: z.string(),
  updatedAt: z.string(),
  _count: z.object({ sessions: z.number() }).optional(),
})

// Shared by the create and edit forms; empty strings mean "not set".
export const InterviewFormSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(120),
  companyName: z.string().trim().max(120).optional(),
  jobTitle: z.string().trim().max(120).optional(),
  // ISO timestamp (converted from datetime-local in the browser), or "" when unset
  scheduledAt: z.string().optional(),
  notes: z.string().max(5000).optional(),
  // Documents the answer coach reads during the interview
  documentIds: z.array(z.string().min(1)).max(20).optional(),
})

export const CreateInterviewRequestSchema = InterviewFormSchema
export const UpdateInterviewRequestSchema = InterviewFormSchema.partial()

export type Interview = z.infer<typeof InterviewSchema>
export type InterviewFormValues = z.infer<typeof InterviewFormSchema>
export type CreateInterviewRequest = z.infer<
  typeof CreateInterviewRequestSchema
>
export type UpdateInterviewRequest = z.infer<
  typeof UpdateInterviewRequestSchema
> & { id: string }

/** Normalizes form values into Prisma data (empty -> null). */
export function toInterviewData(values: Partial<InterviewFormValues>) {
  const orNull = (v: string | undefined) =>
    v === undefined ? undefined : v.trim() === "" ? null : v.trim()

  return {
    name: values.name,
    companyName: orNull(values.companyName),
    jobTitle: orNull(values.jobTitle),
    notes: orNull(values.notes),
    documentIds: values.documentIds,
    scheduledAt:
      values.scheduledAt === undefined
        ? undefined
        : values.scheduledAt
        ? new Date(values.scheduledAt)
        : null,
  }
}
