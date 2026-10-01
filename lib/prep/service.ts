import { after } from "next/server"

import { PREP_MAX_DOC_CHARS } from "@/config/defaults/ai"
import { db } from "@/lib/db"
import { DocumentType } from "@/lib/generated/prisma/enums"
import { buildInterviewBrief } from "@/lib/interview/brief"

import { generateInterviewPrep, generateProfilePrep } from "./generate"
import {
  InterviewPrepSchema,
  ProfilePrepSchema,
  type InterviewPrep,
  type PrepStatus,
  type ProfilePrep,
} from "./schema"
import { interviewSourceHash, profileSourceHash } from "./source"

/**
 * Prep packs in the database: status, background generation and saving the
 * candidate's edits. Generation runs after the response (`after`), so the
 * API returns at once and the UI polls the status.
 */

// A pending run older than this was lost (server restart): allow a new one
const PENDING_TIMEOUT_MS = 5 * 60_000

const NO_INTERVIEW = { companyName: null, jobTitle: null, notes: null }

export interface PrepState<T> {
  status: PrepStatus
  content: T | null
  error: string | null
  updatedAt: Date | null
  /** Why a prep can't be generated yet (e.g. no documents), else null */
  blocked: string | null
}

export const NO_DOCUMENTS =
  "Upload your CV, portfolio or notes under Documents first."

/** Documents that describe the candidate (everything but job descriptions). */
async function hasProfileDocuments(userId: string) {
  const count = await db.document.count({
    where: { userId, type: { not: DocumentType.JOB_DESCRIPTION } },
  })
  return count > 0
}

/** Readable one-paragraph error (gateway errors carry ANSI colors). */
function errorMessage(error: unknown) {
  const text = error instanceof Error ? error.message : String(error)
  return text
    .replace(/\u001b\[[0-9;]*m/g, "")
    .split("\n\n")[0]
    .trim()
}

function effectiveStatus(
  row: { status: string; sourceHash: string | null; startedAt: Date | null },
  currentHash: string
): PrepStatus {
  if (row.status === "pending") {
    const age = Date.now() - (row.startedAt?.getTime() ?? 0)
    return age > PENDING_TIMEOUT_MS ? "failed" : "pending"
  }
  if (row.status === "ready" && row.sourceHash !== currentHash) return "stale"
  return row.status as PrepStatus
}

// ─── Profile (per user) ───────────────────────────────────────────────────────

/** Everything except job descriptions describes the candidate. */
async function profileInputs(userId: string) {
  const documents = await db.document.findMany({
    where: { userId, type: { not: DocumentType.JOB_DESCRIPTION } },
    select: {
      id: true,
      title: true,
      type: true,
      content: true,
      updatedAt: true,
    },
    orderBy: { createdAt: "asc" },
  })
  return {
    hash: profileSourceHash(documents),
    text: buildInterviewBrief(NO_INTERVIEW, documents, PREP_MAX_DOC_CHARS),
  }
}

export async function getProfilePrep(
  userId: string
): Promise<PrepState<ProfilePrep>> {
  const row = await db.profilePrep.findUnique({ where: { userId } })
  const blocked = (await hasProfileDocuments(userId)) ? null : NO_DOCUMENTS
  if (!row) {
    return {
      status: "missing",
      content: null,
      error: null,
      updatedAt: null,
      blocked,
    }
  }
  const { hash } = await profileInputs(userId)
  const parsed = ProfilePrepSchema.safeParse(row.content)
  return {
    status: effectiveStatus(row, hash),
    content: parsed.success ? parsed.data : null,
    error: row.error,
    updatedAt: row.updatedAt,
    blocked,
  }
}

/** Runs the profile prep now (awaited). Used by the API job and scripts. */
export async function runProfilePrep(userId: string) {
  try {
    const { hash, text } = await profileInputs(userId)
    if (!text.trim()) throw new Error("No documents to prepare from")
    const row = await db.profilePrep.findUnique({ where: { userId } })
    const previous = ProfilePrepSchema.safeParse(row?.content)
    const content = await generateProfilePrep(
      text,
      previous.success ? previous.data : null
    )
    await db.profilePrep.update({
      where: { userId },
      data: { status: "ready", content, sourceHash: hash, error: null },
    })
  } catch (error) {
    console.error("Profile prep failed:", error)
    await db.profilePrep.update({
      where: { userId },
      data: {
        status: "failed",
        error: errorMessage(error),
      },
    })
  }
}

async function markPending<
  T extends { status: string; startedAt: Date | null }
>(existing: T | null, upsert: () => Promise<unknown>) {
  if (
    existing?.status === "pending" &&
    Date.now() - (existing.startedAt?.getTime() ?? 0) < PENDING_TIMEOUT_MS
  ) {
    return false // already running
  }
  await upsert()
  return true
}

/** Marks the profile prep pending and runs it, awaited (scripts, chains). */
export async function prepareProfileNow(userId: string) {
  await db.profilePrep.upsert({
    where: { userId },
    create: { userId, status: "pending", startedAt: new Date() },
    update: { status: "pending", startedAt: new Date(), error: null },
  })
  await runProfilePrep(userId)
}

/** Same for an interview prep. */
export async function prepareInterviewNow(interviewId: string, userId: string) {
  await db.interviewPrep.upsert({
    where: { interviewId },
    create: { interviewId, status: "pending", startedAt: new Date() },
    update: { status: "pending", startedAt: new Date(), error: null },
  })
  await runInterviewPrep(interviewId, userId)
}

/** Starts a background profile prep unless one is already running. */
export async function startProfilePrep(userId: string) {
  if (!(await hasProfileDocuments(userId)))
    return { started: false, blocked: NO_DOCUMENTS }
  const existing = await db.profilePrep.findUnique({ where: { userId } })
  const started = await markPending(existing, () =>
    db.profilePrep.upsert({
      where: { userId },
      create: { userId, status: "pending", startedAt: new Date() },
      update: { status: "pending", startedAt: new Date(), error: null },
    })
  )
  if (started) after(() => runProfilePrep(userId))
  return { started, blocked: null }
}

export async function saveProfilePrep(userId: string, content: ProfilePrep) {
  const parsed = ProfilePrepSchema.parse(content)
  await db.profilePrep.upsert({
    where: { userId },
    create: { userId, status: "ready", content: parsed },
    update: { content: parsed },
  })
}

// ─── Interview (per JD) ───────────────────────────────────────────────────────

async function interviewInputs(interviewId: string, userId: string) {
  const interview = await db.interview.findFirst({
    where: { id: interviewId, userId },
    select: {
      jobTitle: true,
      companyName: true,
      notes: true,
      documentIds: true,
    },
  })
  if (!interview) throw new Error("Interview not found")
  const jobDocuments = await db.document.findMany({
    where: {
      userId,
      id: { in: interview.documentIds },
      type: DocumentType.JOB_DESCRIPTION,
    },
    select: { id: true, title: true, content: true, updatedAt: true },
  })
  const profile = await db.profilePrep.findUnique({
    where: { userId },
    select: { sourceHash: true },
  })
  const header = [
    interview.jobTitle && `ROLE: ${interview.jobTitle}`,
    interview.companyName && `COMPANY: ${interview.companyName}`,
    interview.notes && `CANDIDATE NOTES: ${interview.notes}`,
  ]
    .filter(Boolean)
    .join("\n")
  return {
    hash: interviewSourceHash({
      interview,
      jobDocuments,
      profileHash: profile?.sourceHash ?? null,
    }),
    header,
    jobDescription: jobDocuments
      .map((d) => `### ${d.title}\n${d.content}`)
      .join("\n\n")
      .slice(0, PREP_MAX_DOC_CHARS),
  }
}

export async function getInterviewPrep(
  interviewId: string,
  userId: string
): Promise<PrepState<InterviewPrep>> {
  const row = await db.interviewPrep.findUnique({ where: { interviewId } })
  const { hash } = await interviewInputs(interviewId, userId) // ownership check
  // The interview prep builds on the profile prep, which needs documents
  const blocked = (await hasProfileDocuments(userId)) ? null : NO_DOCUMENTS
  if (!row) {
    return {
      status: "missing",
      content: null,
      error: null,
      updatedAt: null,
      blocked,
    }
  }
  const parsed = InterviewPrepSchema.safeParse(row.content)
  return {
    status: effectiveStatus(row, hash),
    content: parsed.success ? parsed.data : null,
    error: row.error,
    updatedAt: row.updatedAt,
    blocked,
  }
}

export async function runInterviewPrep(interviewId: string, userId: string) {
  try {
    // The interview prep cites profile ids, so the profile comes first
    let profile = await getProfilePrep(userId)
    if (!profile.content) {
      await prepareProfileNow(userId)
      profile = await getProfilePrep(userId)
      if (!profile.content)
        throw new Error(profile.error ?? "Profile prep failed")
    }

    const inputs = await interviewInputs(interviewId, userId)
    const row = await db.interviewPrep.findUnique({ where: { interviewId } })
    const previous = InterviewPrepSchema.safeParse(row?.content)
    const content = await generateInterviewPrep({
      header: inputs.header,
      jobDescription: inputs.jobDescription,
      profile: profile.content,
      previous: previous.success ? previous.data : null,
    })
    await db.interviewPrep.update({
      where: { interviewId },
      data: { status: "ready", content, sourceHash: inputs.hash, error: null },
    })
  } catch (error) {
    console.error("Interview prep failed:", error)
    await db.interviewPrep.update({
      where: { interviewId },
      data: {
        status: "failed",
        error: errorMessage(error),
      },
    })
  }
}

export async function startInterviewPrep(interviewId: string, userId: string) {
  await interviewInputs(interviewId, userId) // ownership check
  if (!(await hasProfileDocuments(userId)))
    return { started: false, blocked: NO_DOCUMENTS }
  const existing = await db.interviewPrep.findUnique({ where: { interviewId } })
  const started = await markPending(existing, () =>
    db.interviewPrep.upsert({
      where: { interviewId },
      create: { interviewId, status: "pending", startedAt: new Date() },
      update: { status: "pending", startedAt: new Date(), error: null },
    })
  )
  if (started) after(() => runInterviewPrep(interviewId, userId))
  return { started, blocked: null }
}

export async function saveInterviewPrep(
  interviewId: string,
  userId: string,
  content: InterviewPrep
) {
  await interviewInputs(interviewId, userId) // ownership check
  const parsed = InterviewPrepSchema.parse(content)
  await db.interviewPrep.upsert({
    where: { interviewId },
    create: { interviewId, status: "ready", content: parsed },
    update: { content: parsed },
  })
}
