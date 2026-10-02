import { z } from "zod"

import { AnswersSchema } from "@/lib/prep/schema"

/** Where an application stands (mirrors the Prisma enum). */
export const JOB_STATUSES = [
  "SAVED",
  "APPLIED",
  "INTERVIEWING",
  "OFFER",
  "REJECTED",
  "ARCHIVED",
] as const
export type JobStatus = (typeof JOB_STATUSES)[number]

export const JOB_STATUS_LABEL: Record<JobStatus, string> = {
  SAVED: "Saved",
  APPLIED: "Applied",
  INTERVIEWING: "Interviewing",
  OFFER: "Offer",
  REJECTED: "Rejected",
  ARCHIVED: "Archived",
}

export const JobSchema = z.object({
  id: z.string(),
  company: z.string(),
  title: z.string(),
  jdText: z.string(),
  sourceUrl: z.string().nullable(),
  status: z.enum(JOB_STATUSES),
  scheduledAt: z.string().nullable(),
  notes: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
  answers: z.unknown().optional(),
  _count: z.object({ sessions: z.number() }).optional(),
  /** Tailored CV summary (list endpoint only) */
  cv: z
    .object({
      id: z.string(),
      origin: z.enum(["UPLOADED", "REFINED", "GENERATED"]),
      status: z.string(),
      pending: z.number(),
    })
    .nullable()
    .optional(),
})

const optionalUrl = z
  .string()
  .trim()
  .max(2000)
  .refine((v) => v === "" || /^https?:\/\//i.test(v), "Must be a link")
  .optional()

/** Where a job's CV comes from. */
export const CvSourceSchema = z.discriminatedUnion("type", [
  /** Upload a CV (its text) and refine it for the job */
  z.object({
    type: z.literal("upload"),
    title: z.string().trim().min(1).max(120),
    rawText: z
      .string()
      .trim()
      .min(200, "This doesn't look like a whole CV")
      .max(100_000),
  }),
  /** Refine one of your CVs for the job */
  z.object({ type: z.literal("cv"), cvId: z.string().min(1) }),
  /** A practice persona written from the JD alone */
  z.object({ type: z.literal("generate") }),
])

export type CvSource = z.infer<typeof CvSourceSchema>

/** New job: the JD is what matters; company and title are read from it when blank. */
export const CreateJobRequestSchema = z.object({
  jdText: z
    .string()
    .trim()
    .min(50, "Paste the whole job description")
    .max(50_000),
  company: z.string().trim().max(120).optional(),
  title: z.string().trim().max(160).optional(),
  sourceUrl: optionalUrl,
  cv: CvSourceSchema,
})

export const UpdateJobRequestSchema = z
  .object({
    company: z.string().trim().max(120),
    title: z.string().trim().max(160),
    jdText: z.string().trim().max(50_000),
    sourceUrl: optionalUrl,
    status: z.enum(JOB_STATUSES),
    // ISO timestamp, or "" to clear the interview time
    scheduledAt: z.string(),
    notes: z.string().max(5000),
    answers: AnswersSchema,
  })
  .partial()

export type Job = z.infer<typeof JobSchema>
export type CreateJobRequest = z.infer<typeof CreateJobRequestSchema>
export type UpdateJobRequest = z.infer<typeof UpdateJobRequestSchema>

/** Display name: "Company — Title" (either may be missing). */
export function jobName(job: Pick<Job, "company" | "title">) {
  return [job.company, job.title].filter(Boolean).join(" — ") || "Untitled job"
}

/** Normalizes an update into Prisma data (empty -> null). */
export function toJobData(values: UpdateJobRequest) {
  const orNull = (v: string | undefined) =>
    v === undefined ? undefined : v.trim() === "" ? null : v.trim()
  return {
    company: values.company,
    title: values.title,
    jdText: values.jdText,
    sourceUrl: orNull(values.sourceUrl),
    status: values.status,
    notes: orNull(values.notes),
    answers: values.answers,
    scheduledAt:
      values.scheduledAt === undefined
        ? undefined
        : values.scheduledAt
        ? new Date(values.scheduledAt)
        : null,
  }
}
