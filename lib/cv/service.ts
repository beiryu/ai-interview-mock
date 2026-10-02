import { after } from "next/server"

import { db } from "@/lib/db"
import {
  NO_DOCUMENTS,
  effectiveStatus,
  errorMessage,
  getProfilePrep,
  interviewInputs,
  markPending,
  prepareProfileNow,
  profileInputs,
  type PrepState,
} from "@/lib/prep/service"

import { generateTailoredCv } from "./generate"
import { TailoredCvSchema, pendingStretches, type TailoredCv } from "./schema"

/**
 * Tailored CVs in the database (one per interview): status, background
 * generation and your edits — the same lifecycle as the prep packs. A CV is
 * stale when the profile prep or the job description changed.
 */

export interface CvState extends PrepState<TailoredCv> {
  /** Stretches you haven't approved yet (PDF export waits for them) */
  pending: number
}

export async function getTailoredCv(
  interviewId: string,
  userId: string
): Promise<CvState> {
  const { hash } = await interviewInputs(interviewId, userId) // ownership check
  const { text } = await profileInputs(userId)
  const blocked = text.trim() ? null : NO_DOCUMENTS
  const row = await db.tailoredCv.findUnique({ where: { interviewId } })
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

export async function runTailoredCv(interviewId: string, userId: string) {
  try {
    let profile = await getProfilePrep(userId)
    if (!profile.content) {
      await prepareProfileNow(userId)
      profile = await getProfilePrep(userId)
      if (!profile.content)
        throw new Error(profile.error ?? "Profile prep failed")
    }
    const inputs = await interviewInputs(interviewId, userId)
    const row = await db.tailoredCv.findUnique({ where: { interviewId } })
    const previous = TailoredCvSchema.safeParse(row?.content)
    const content = await generateTailoredCv({
      header: inputs.header,
      jobDescription: inputs.jobDescription,
      profile: profile.content,
      documents: (await profileInputs(userId)).text,
      previous: previous.success ? previous.data : null,
    })
    await db.tailoredCv.update({
      where: { interviewId },
      data: { status: "ready", content, sourceHash: inputs.hash, error: null },
    })
  } catch (error) {
    console.error("Tailored CV failed:", error)
    await db.tailoredCv.update({
      where: { interviewId },
      data: { status: "failed", error: errorMessage(error) },
    })
  }
}

/** Marks the CV pending and builds it, awaited (scripts, the prep chain). */
export async function prepareCvNow(interviewId: string, userId: string) {
  await db.tailoredCv.upsert({
    where: { interviewId },
    create: { interviewId, status: "pending", startedAt: new Date() },
    update: { status: "pending", startedAt: new Date(), error: null },
  })
  await runTailoredCv(interviewId, userId)
}

/** The CV, building it first if there is none yet (interview prep needs it). */
export async function ensureTailoredCv(interviewId: string, userId: string) {
  const state = await getTailoredCv(interviewId, userId)
  if (state.content) return state.content
  await prepareCvNow(interviewId, userId)
  const fresh = await getTailoredCv(interviewId, userId)
  if (!fresh.content) throw new Error(fresh.error ?? "Tailored CV failed")
  return fresh.content
}

export async function startTailoredCv(interviewId: string, userId: string) {
  const state = await getTailoredCv(interviewId, userId)
  if (state.blocked) return { started: false, blocked: state.blocked }
  const existing = await db.tailoredCv.findUnique({ where: { interviewId } })
  const started = await markPending(existing, () =>
    db.tailoredCv.upsert({
      where: { interviewId },
      create: { interviewId, status: "pending", startedAt: new Date() },
      update: { status: "pending", startedAt: new Date(), error: null },
    })
  )
  if (started) after(() => runTailoredCv(interviewId, userId))
  return { started, blocked: null }
}

export async function saveTailoredCv(
  interviewId: string,
  userId: string,
  content: TailoredCv
) {
  await interviewInputs(interviewId, userId) // ownership check
  const parsed = TailoredCvSchema.parse(content)
  await db.tailoredCv.upsert({
    where: { interviewId },
    create: { interviewId, status: "ready", content: parsed },
    update: { content: parsed },
  })
}
