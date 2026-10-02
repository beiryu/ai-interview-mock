import { after } from "next/server"

import { ensureJobCv } from "@/lib/cv/service"
import { db } from "@/lib/db"
import { effectiveStatus, errorMessage, isRunning } from "@/lib/generation"

import { generateJobPrep } from "./generate"
import { JobPrepSchema, type JobPrep, type PrepStatus } from "./schema"
import { jobPrepHash } from "./source"

/**
 * Job preps in the database (one per job): status, background generation
 * and your edits. The prep is built from the job's CV, so it waits for (or
 * builds) the CV first, and goes stale when the CV or the job changes.
 */

export interface PrepState<T> {
  status: PrepStatus
  content: T | null
  error: string | null
  updatedAt: Date | null
  /** Why it can't be prepared yet (no CV), else null */
  blocked: string | null
}

export const NO_CV = "Make this job's CV first (CV tab)."

async function jobInputs(jobId: string, userId: string) {
  const job = await db.job.findFirst({
    where: { id: jobId, userId },
    select: {
      title: true,
      company: true,
      notes: true,
      jdText: true,
      cv: { select: { id: true, updatedAt: true } },
    },
  })
  if (!job) throw new Error("Job not found")
  const header = [
    job.title && `ROLE: ${job.title}`,
    job.company && `COMPANY: ${job.company}`,
    job.notes && `CANDIDATE NOTES: ${job.notes}`,
  ]
    .filter(Boolean)
    .join("\n")
  return { job, header, hash: jobPrepHash(job, job.cv) }
}

export async function getJobPrep(
  jobId: string,
  userId: string
): Promise<PrepState<JobPrep>> {
  const { job, hash } = await jobInputs(jobId, userId)
  const blocked = job.cv ? null : NO_CV
  const row = await db.jobPrep.findUnique({ where: { jobId } })
  if (!row) {
    return {
      status: "missing",
      content: null,
      error: null,
      updatedAt: null,
      blocked,
    }
  }
  const parsed = JobPrepSchema.safeParse(row.content)
  return {
    status: effectiveStatus(row, hash),
    content: parsed.success ? parsed.data : null,
    error: row.error,
    updatedAt: row.updatedAt,
    blocked,
  }
}

/** Builds the job prep now (awaited). Used by the API job and scripts. */
export async function runJobPrep(jobId: string, userId: string) {
  try {
    const cv = await ensureJobCv(jobId, userId)
    // Read after the CV: building it changes what the prep is based on
    const { job, header, hash } = await jobInputs(jobId, userId)
    const row = await db.jobPrep.findUnique({ where: { jobId } })
    const previous = JobPrepSchema.safeParse(row?.content)
    const content = await generateJobPrep({
      header,
      jobDescription: job.jdText,
      cv: cv.content,
      sourceText: cv.sourceText,
      practice: cv.practice,
      previous: previous.success ? previous.data : null,
    })
    await db.jobPrep.update({
      where: { jobId },
      data: { status: "ready", content, sourceHash: hash, error: null },
    })
  } catch (error) {
    console.error("Job prep failed:", error)
    await db.jobPrep.update({
      where: { jobId },
      data: { status: "failed", error: errorMessage(error) },
    })
  }
}

const pendingRow = (jobId: string) => ({
  where: { jobId },
  create: { jobId, status: "pending", startedAt: new Date() },
  update: { status: "pending", startedAt: new Date(), error: null },
})

/** Marks the job prep pending and builds it, awaited (scripts). */
export async function prepareJobPrepNow(jobId: string, userId: string) {
  await db.jobPrep.upsert(pendingRow(jobId))
  await runJobPrep(jobId, userId)
}

/** Starts a background job prep unless one is already running. */
export async function startJobPrep(jobId: string, userId: string) {
  const { job } = await jobInputs(jobId, userId)
  if (!job.cv) return { started: false, blocked: NO_CV }
  const existing = await db.jobPrep.findUnique({ where: { jobId } })
  if (isRunning(existing)) return { started: false, blocked: null }
  await db.jobPrep.upsert(pendingRow(jobId))
  after(() => runJobPrep(jobId, userId))
  return { started: true, blocked: null }
}

export async function saveJobPrep(
  jobId: string,
  userId: string,
  content: JobPrep
) {
  await jobInputs(jobId, userId) // ownership check
  const parsed = JobPrepSchema.parse(content)
  await db.jobPrep.upsert({
    where: { jobId },
    create: { jobId, status: "ready", content: parsed },
    update: { content: parsed },
  })
}
