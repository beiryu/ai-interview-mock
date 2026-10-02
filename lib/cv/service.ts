import { after } from "next/server"

import { db } from "@/lib/db"
import {
  NO_DOCUMENTS,
  effectiveStatus,
  errorMessage,
  getProfilePrep,
  jobInputs,
  markPending,
  prepareProfileNow,
  profileInputs,
  type PrepState,
} from "@/lib/prep/service"

import { generateTailoredCv } from "./generate"
import { TailoredCvSchema, pendingStretches, type TailoredCv } from "./schema"

/**
 * Tailored CVs in the database (one per job): status, background
 * generation and your edits — the same lifecycle as the prep packs. A CV is
 * stale when the profile prep or the job description changed.
 */

export interface CvState extends PrepState<TailoredCv> {
  /** Stretches you haven't approved yet (PDF export waits for them) */
  pending: number
}

export async function getTailoredCv(
  jobId: string,
  userId: string
): Promise<CvState> {
  const { hash } = await jobInputs(jobId, userId) // ownership check
  const { text } = await profileInputs(userId)
  const blocked = text.trim() ? null : NO_DOCUMENTS
  const row = await db.tailoredCv.findUnique({ where: { jobId } })
  if (!row) {
    return {
      status: "missing",
      content: null,
      error: null,
      updatedAt: null,
      blocked,
      pending: 0,
    }
  }
  const parsed = TailoredCvSchema.safeParse(row.content)
  const content = parsed.success ? parsed.data : null
  return {
    status: effectiveStatus(row, hash),
    content,
    error: row.error,
    updatedAt: row.updatedAt,
    blocked,
    pending: content ? pendingStretches(content).length : 0,
  }
}

export async function runTailoredCv(jobId: string, userId: string) {
  try {
    let profile = await getProfilePrep(userId)
    if (!profile.content) {
      await prepareProfileNow(userId)
      profile = await getProfilePrep(userId)
      if (!profile.content)
        throw new Error(profile.error ?? "Profile prep failed")
    }
    const inputs = await jobInputs(jobId, userId)
    const row = await db.tailoredCv.findUnique({ where: { jobId } })
    const previous = TailoredCvSchema.safeParse(row?.content)
    const content = await generateTailoredCv({
      header: inputs.header,
      jobDescription: inputs.jobDescription,
      profile: profile.content,
      documents: (await profileInputs(userId)).text,
      previous: previous.success ? previous.data : null,
    })
    await db.tailoredCv.update({
      where: { jobId },
      data: { status: "ready", content, sourceHash: inputs.hash, error: null },
    })
  } catch (error) {
    console.error("Tailored CV failed:", error)
    await db.tailoredCv.update({
      where: { jobId },
      data: { status: "failed", error: errorMessage(error) },
    })
  }
}

/** Marks the CV pending and builds it, awaited (scripts, the prep chain). */
export async function prepareCvNow(jobId: string, userId: string) {
  await db.tailoredCv.upsert({
    where: { jobId },
    create: { jobId, status: "pending", startedAt: new Date() },
    update: { status: "pending", startedAt: new Date(), error: null },
  })
  await runTailoredCv(jobId, userId)
}

/** The CV, building it first if there is none yet (the job prep needs it). */
export async function ensureTailoredCv(jobId: string, userId: string) {
  const state = await getTailoredCv(jobId, userId)
  if (state.content) return state.content
  await prepareCvNow(jobId, userId)
  const fresh = await getTailoredCv(jobId, userId)
  if (!fresh.content) throw new Error(fresh.error ?? "Tailored CV failed")
  return fresh.content
}

export async function startTailoredCv(jobId: string, userId: string) {
  const state = await getTailoredCv(jobId, userId)
  if (state.blocked) return { started: false, blocked: state.blocked }
  const existing = await db.tailoredCv.findUnique({ where: { jobId } })
  const started = await markPending(existing, () =>
    db.tailoredCv.upsert({
      where: { jobId },
      create: { jobId, status: "pending", startedAt: new Date() },
      update: { status: "pending", startedAt: new Date(), error: null },
    })
  )
  if (started) after(() => runTailoredCv(jobId, userId))
  return { started, blocked: null }
}

export async function saveTailoredCv(
  jobId: string,
  userId: string,
  content: TailoredCv
) {
  await jobInputs(jobId, userId) // ownership check
  const parsed = TailoredCvSchema.parse(content)
  await db.tailoredCv.upsert({
    where: { jobId },
    create: { jobId, status: "ready", content: parsed },
    update: { content: parsed },
  })
}
