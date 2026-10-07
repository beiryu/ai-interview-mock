import { after } from "next/server"

import { db } from "@/lib/db"
import { Prisma } from "@/lib/generated/prisma/client"
import type { CvOrigin as DbCvOrigin } from "@/lib/generated/prisma/enums"
import { effectiveStatus, errorMessage, isRunning } from "@/lib/generation"
import type { PrepStatus } from "@/lib/prep/schema"
import { jobCvHash } from "@/lib/prep/source"
import type { CvSource } from "@/lib/validations/job"

import { generateCv, parseCv, refineCv } from "./generate"
import {
  CvContentSchema,
  bulletIndex,
  pendingStretches,
  type CvContent,
  type CvOrigin,
} from "./schema"

/**
 * CVs in the database. One table, three origins: UPLOADED (yours, parsed
 * from the text you upload), REFINED (made for a job from another CV) and
 * GENERATED (a practice persona made from a job description). A job has at
 * most one CV (cvs.job_id). Generation runs after the response (`after`);
 * the UI polls the status.
 */

export interface CvSummary {
  id: string
  title: string
  origin: CvOrigin
  basedOn: { id: string; title: string } | null
  job: { id: string; company: string; title: string } | null
}

export interface CvState {
  status: PrepStatus
  content: CvContent | null
  error: string | null
  updatedAt: Date | null
  /** Why it can't be made yet, else null */
  blocked: string | null
  /** Stretches you haven't approved yet (the PDF waits for them) */
  pending: number
  cv: CvSummary | null
  /** Source bullet id → its text, for the "from" chips of a refined CV */
  sourceLabels: Record<string, string>
}

const parseContent = (value: unknown) => {
  const parsed = CvContentSchema.safeParse(value)
  return parsed.success ? parsed.data : null
}

const SUMMARY_SELECT = {
  id: true,
  title: true,
  origin: true,
  basedOn: { select: { id: true, title: true } },
  job: { select: { id: true, company: true, title: true } },
} as const

// ─── Uploaded CVs ────────────────────────────────────────────────────────────

/** Parses an uploaded CV now (awaited). */
export async function runParse(cvId: string) {
  try {
    const cv = await db.cv.findUniqueOrThrow({ where: { id: cvId } })
    if (!cv.rawText?.trim()) throw new Error("This CV has no text")
    const content = await parseCv(cv.rawText)
    await db.cv.update({
      where: { id: cvId },
      data: { status: "ready", content, error: null },
    })
  } catch (error) {
    console.error("CV parse failed:", error)
    await db.cv.update({
      where: { id: cvId },
      data: { status: "failed", error: errorMessage(error) },
    })
  }
}

/** Stores an uploaded CV and parses it in the background. */
export async function createUploadedCv(
  userId: string,
  { title, rawText }: { title: string; rawText: string }
) {
  const cv = await db.cv.create({
    data: {
      userId,
      title,
      origin: "UPLOADED",
      rawText,
      status: "pending",
      startedAt: new Date(),
    },
  })
  after(() => runParse(cv.id))
  return cv
}

/** An uploaded CV's content, parsing it first if needed (refining needs it). */
async function parsedUpload(cvId: string) {
  let cv = await db.cv.findUniqueOrThrow({ where: { id: cvId } })
  // Just uploaded: its parse is running, wait for it
  for (let waited = 0; isRunning(cv) && waited < 180; waited += 2) {
    await new Promise((resolve) => setTimeout(resolve, 2000))
    cv = await db.cv.findUniqueOrThrow({ where: { id: cvId } })
  }
  if (cv.status !== "ready" || !parseContent(cv.content)) {
    await db.cv.update({
      where: { id: cvId },
      data: { status: "pending", startedAt: new Date(), error: null },
    })
    await runParse(cvId)
    cv = await db.cv.findUniqueOrThrow({ where: { id: cvId } })
  }
  const content = parseContent(cv.content)
  if (!content) throw new Error(cv.error ?? "Couldn't read your CV")
  return { cv, content }
}

/**
 * What a refined CV is checked against: the uploaded CV at the root of its
 * "based on" chain (the truth), and the CV to start from when that root
 * isn't the direct base.
 */
async function refineSource(basedOnId: string) {
  let base = await db.cv.findUniqueOrThrow({ where: { id: basedOnId } })
  if (base.origin === "GENERATED") {
    throw new Error("A practice persona can't be the base of a real CV")
  }
  const start = base.origin === "REFINED" ? parseContent(base.content) : null
  for (let hops = 0; base.origin !== "UPLOADED" && hops < 10; hops++) {
    if (!base.basedOnId) throw new Error("The original CV was deleted")
    base = await db.cv.findUniqueOrThrow({ where: { id: base.basedOnId } })
  }
  const root = await parsedUpload(base.id)
  return { root, start }
}

// ─── A job's CV ──────────────────────────────────────────────────────────────

async function jobFor(jobId: string, userId: string) {
  const job = await db.job.findFirst({
    where: { id: jobId, userId },
    select: {
      id: true,
      title: true,
      company: true,
      notes: true,
      jdText: true,
      cv: {
        include: {
          basedOn: { select: { id: true, updatedAt: true } },
        },
      },
    },
  })
  if (!job) throw new Error("Job not found")
  return job
}

function jobHeader(job: {
  title: string
  company: string
  notes: string | null
}) {
  return [
    job.title && `ROLE: ${job.title}`,
    job.company && `COMPANY: ${job.company}`,
    job.notes && `CANDIDATE NOTES: ${job.notes}`,
  ]
    .filter(Boolean)
    .join("\n")
}

const jobCvTitle = (job: { company: string; title: string }) =>
  [job.company, job.title].filter(Boolean).join(" — ") || "Untitled job"

export async function getJobCv(
  jobId: string,
  userId: string
): Promise<CvState> {
  const job = await jobFor(jobId, userId)
  const row = job.cv
  if (!row) {
    return {
      status: "missing",
      content: null,
      error: null,
      updatedAt: null,
      blocked: null,
      pending: 0,
      cv: null,
      sourceLabels: {},
    }
  }
  const content = parseContent(row.content)
  const summary = await db.cv.findUniqueOrThrow({
    where: { id: row.id },
    select: {
      ...SUMMARY_SELECT,
      basedOn: { select: { id: true, title: true, content: true } },
    },
  })
  const base = summary.basedOn ? parseContent(summary.basedOn.content) : null
  return {
    status: effectiveStatus(
      row,
      row.origin === "GENERATED"
        ? jobCvHash(job, null)
        : jobCvHash(job, row.basedOn)
    ),
    content,
    error: row.error,
    updatedAt: row.updatedAt,
    blocked: null,
    pending: content ? pendingStretches(content).length : 0,
    cv: {
      id: summary.id,
      title: summary.title,
      origin: summary.origin,
      basedOn: summary.basedOn
        ? { id: summary.basedOn.id, title: summary.basedOn.title }
        : null,
      job: summary.job,
    },
    sourceLabels: base ? Object.fromEntries(bulletIndex(base)) : {},
  }
}

/** Builds the job's CV now (awaited), from scratch: refined from its base, or generated. */
export async function runJobCv(jobId: string, userId: string) {
  const job = await jobFor(jobId, userId)
  const row = job.cv
  if (!row) throw new Error("This job has no CV to build")
  try {
    // Regenerating writes a new CV: earlier edits and approvals don't carry over
    const previous = null
    let content: CvContent
    let hash: string
    if (row.origin === "GENERATED") {
      content = await generateCv({
        header: jobHeader(job),
        jobDescription: job.jdText,
        previous,
      })
      hash = jobCvHash(job, null)
    } else {
      if (!row.basedOnId)
        throw new Error("The CV this one is based on was deleted")
      const { root, start } = await refineSource(row.basedOnId)
      content = await refineCv({
        header: jobHeader(job),
        jobDescription: job.jdText,
        source: root.content,
        sourceText: root.cv.rawText ?? "",
        start,
        previous,
      })
      const base = await db.cv.findUniqueOrThrow({
        where: { id: row.basedOnId },
        select: { id: true, updatedAt: true },
      })
      hash = jobCvHash(job, base)
    }
    await db.cv.update({
      where: { id: row.id },
      data: { status: "ready", content, sourceHash: hash, error: null },
    })
  } catch (error) {
    console.error("Job CV failed:", error)
    await db.cv.update({
      where: { id: row.id },
      data: { status: "failed", error: errorMessage(error) },
    })
  }
}

/**
 * Sets up the job's CV from `source` (or rebuilds it from what it has) and
 * marks it pending. Returns false when a run is already going.
 */
async function prepareJobCv(jobId: string, userId: string, source?: CvSource) {
  const job = await jobFor(jobId, userId)
  if (isRunning(job.cv)) return false
  const pending = { status: "pending", startedAt: new Date(), error: null }

  if (!source) {
    if (!job.cv) throw new Error("Choose how to make this job's CV first")
    await db.cv.update({ where: { id: job.cv.id }, data: pending })
    return true
  }

  let origin: DbCvOrigin = "REFINED"
  let basedOnId: string | null = null
  if (source.type === "generate") {
    origin = "GENERATED"
  } else if (source.type === "upload") {
    basedOnId = (await createUploadedCv(userId, source)).id
  } else {
    const base = await db.cv.findFirst({
      where: { id: source.cvId, userId },
      select: { id: true, origin: true },
    })
    if (!base) throw new Error("CV not found")
    if (base.origin === "GENERATED") {
      throw new Error("A practice persona can't be the base of a real CV")
    }
    basedOnId = base.id
  }

  const data = { origin, basedOnId, ...pending }
  if (job.cv) {
    await db.cv.update({
      where: { id: job.cv.id },
      data: { ...data, content: Prisma.DbNull },
    })
  } else {
    await db.cv.create({
      data: { ...data, userId, jobId, title: jobCvTitle(job) },
    })
  }
  return true
}

/** Makes (or rebuilds) the job's CV in the background. */
export async function startJobCv(
  jobId: string,
  userId: string,
  source?: CvSource
) {
  const started = await prepareJobCv(jobId, userId, source)
  if (started) after(() => runJobCv(jobId, userId))
  return { started, blocked: null }
}

/** The job's CV, building it first if it isn't ready (the prep needs it). */
export async function ensureJobCv(jobId: string, userId: string) {
  let state = await getJobCv(jobId, userId)
  if (!state.cv) throw new Error("This job has no CV yet")
  // Being made right now (e.g. just after New job): wait for that run
  for (
    let waited = 0;
    state.status === "pending" && waited < 180;
    waited += 2
  ) {
    await new Promise((resolve) => setTimeout(resolve, 2000))
    state = await getJobCv(jobId, userId)
  }
  if (!state.content || state.status === "failed") {
    await prepareJobCv(jobId, userId)
    await runJobCv(jobId, userId)
    state = await getJobCv(jobId, userId)
  }
  if (!state.content || !state.cv) {
    throw new Error(state.error ?? "The CV couldn't be made")
  }
  const sourceText = await rootText(state.cv.id)
  return {
    content: state.content,
    practice: state.cv.origin === "GENERATED",
    sourceText,
    id: state.cv.id,
  }
}

/** The uploaded text behind a CV ("" for a practice persona). */
async function rootText(cvId: string) {
  let cv = await db.cv.findUniqueOrThrow({ where: { id: cvId } })
  for (let hops = 0; cv.origin !== "UPLOADED" && hops < 10; hops++) {
    if (!cv.basedOnId) return ""
    cv = await db.cv.findUniqueOrThrow({ where: { id: cv.basedOnId } })
  }
  return cv.rawText ?? ""
}

// ─── Any CV ──────────────────────────────────────────────────────────────────

export async function listCvs(userId: string) {
  const rows = await db.cv.findMany({
    where: { userId },
    orderBy: { updatedAt: "desc" },
    select: {
      ...SUMMARY_SELECT,
      status: true,
      content: true,
      updatedAt: true,
    },
  })
  return rows.map(({ content, ...row }) => {
    const parsed = parseContent(content)
    return {
      ...row,
      headline: parsed?.headline ?? "",
      pending: parsed ? pendingStretches(parsed).length : 0,
    }
  })
}

export async function getCv(cvId: string, userId: string): Promise<CvState> {
  const row = await db.cv.findFirst({
    where: { id: cvId, userId },
    select: {
      ...SUMMARY_SELECT,
      status: true,
      sourceHash: true,
      startedAt: true,
      content: true,
      error: true,
      updatedAt: true,
      jobId: true,
    },
  })
  if (!row) throw new Error("CV not found")
  // A job's CV carries the job's status (stale) and source chips
  if (row.jobId) return getJobCv(row.jobId, userId)
  const content = parseContent(row.content)
  return {
    status: effectiveStatus(row, null),
    content,
    error: row.error,
    updatedAt: row.updatedAt,
    blocked: null,
    pending: content ? pendingStretches(content).length : 0,
    cv: {
      id: row.id,
      title: row.title,
      origin: row.origin,
      basedOn: row.basedOn,
      job: row.job,
    },
    sourceLabels: {},
  }
}

export async function saveCv(
  cvId: string,
  userId: string,
  content: CvContent,
  title?: string
) {
  const row = await db.cv.findFirst({ where: { id: cvId, userId } })
  if (!row) throw new Error("CV not found")
  await db.cv.update({
    where: { id: cvId },
    data: {
      content: CvContentSchema.parse(content),
      ...(title?.trim() ? { title: title.trim() } : {}),
      // Saved by you: a lost run no longer applies
      ...(row.status !== "ready" ? { status: "ready", error: null } : {}),
    },
  })
}

/** Re-reads an uploaded CV (e.g. after a failed parse). */
export async function startParse(cvId: string, userId: string) {
  const row = await db.cv.findFirst({ where: { id: cvId, userId } })
  if (!row) throw new Error("CV not found")
  if (row.origin !== "UPLOADED") throw new Error("Only uploaded CVs are parsed")
  if (isRunning(row)) return { started: false, blocked: null }
  await db.cv.update({
    where: { id: cvId },
    data: { status: "pending", startedAt: new Date(), error: null },
  })
  after(() => runParse(cvId))
  return { started: true, blocked: null }
}

export async function deleteCv(cvId: string, userId: string) {
  const row = await db.cv.findFirst({ where: { id: cvId, userId } })
  if (!row) throw new Error("CV not found")
  await db.cv.delete({ where: { id: cvId } })
}
