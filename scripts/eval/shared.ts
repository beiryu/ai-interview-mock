import { mkdirSync, readFileSync, writeFileSync } from "node:fs"
import path from "node:path"

import { BRIEF_MAX_CHARS } from "../../config/defaults/ai"
import type { Turn } from "../../lib/ai/judge"
import { db } from "../../lib/db"
import { buildInterviewBrief } from "../../lib/interview/brief"
import { loadInterviewBrief } from "../../lib/interview/load-brief"
import { renderPrepBrief } from "../../lib/prep/render"
import { ProfilePrepSchema } from "../../lib/prep/schema"

export const EVAL_DIR = path.join(process.cwd(), "eval")
export const RESULTS_DIR = path.join(EVAL_DIR, "results")

export type QuestionKind =
  | "technical"
  | "experience"
  | "behavioral"
  | "personal"
  | "motivation"
  | "followup"

export interface EvalQuestion {
  id: string
  kind: QuestionKind
  lang: "vi" | "en"
  question: string
  context?: Turn[]
  /** What a good answer does (shown to the grader) */
  expect?: string
  /** Things the answer must not claim about the candidate */
  mustNotClaim?: string[]
}

export interface AnswerRecord {
  id: string
  kind: QuestionKind
  answer: string
  firstTokenMs: number | null
  totalMs: number
  model: string | null
  inputTokens: number | null
  cachedTokens: number | null
  error?: string
}

export interface Grade {
  groundedness: number
  unsupportedClaims: string[]
  relevance: number
  specificity: number
  star: number | null
  speakability: number
  languageMatch: boolean
  verdict: string
}

export interface RunFile {
  preset: string
  createdAt: string
  coachModel: string
  briefKind: string
  /** What the coach saw */
  brief: string
  /** The candidate's documents, as the grader's source of truth */
  groundTruth: string
  answers: AnswerRecord[]
  grades?: Record<string, Grade>
  grader?: string
}

export function loadQuestions(): EvalQuestion[] {
  return JSON.parse(
    readFileSync(path.join(EVAL_DIR, "coach-questions.json"), "utf8")
  )
}

export function readRun(file: string): RunFile {
  return JSON.parse(readFileSync(file, "utf8"))
}

export function writeRun(run: RunFile, file?: string) {
  mkdirSync(RESULTS_DIR, { recursive: true })
  const target =
    file ??
    path.join(
      RESULTS_DIR,
      `${run.createdAt.replace(/[:.]/g, "-")}-${run.preset}.json`
    )
  writeFileSync(target, JSON.stringify(run, null, 2))
  return target
}

/** The raw document brief (documents + role), also the grader's truth. */
export async function rawBrief(jobId?: string) {
  const user = await db.user.findFirst({ select: { id: true } })
  if (!user) throw new Error("No user in the database")
  if (jobId) return loadInterviewBrief(jobId, user.id)

  const documents = await db.document.findMany({
    where: { userId: user.id },
    select: { title: true, type: true, content: true },
  })
  return buildInterviewBrief(
    {
      company: "Acme",
      title: "Senior Backend Engineer",
      notes: null,
      jdText: "",
    },
    documents,
    BRIEF_MAX_CHARS
  )
}

export async function evalUserId() {
  const user = await db.user.findFirst({ select: { id: true } })
  if (!user) throw new Error("No user in the database")
  return user.id
}

/** The coach brief from the prep pack, as the app builds it. */
export async function prepBrief(jobId?: string) {
  const userId = await evalUserId()
  if (jobId) {
    const brief = await loadInterviewBrief(jobId, userId)
    const prep = await db.profilePrep.findUnique({ where: { userId } })
    if (!prep?.content)
      throw new Error("No profile prep: run `pnpm ai:eval prep` first")
    return brief
  }
  const row = await db.profilePrep.findUnique({ where: { userId } })
  const profile = ProfilePrepSchema.safeParse(row?.content)
  if (!profile.success) {
    throw new Error("No profile prep: run `pnpm ai:eval prep` first")
  }
  const documents = await rawBrief()
  return renderPrepBrief({
    job: { company: "Acme", title: "Senior Backend Engineer", notes: null },
    profile: profile.data,
    interviewPrep: null,
    documents: documents.slice(documents.indexOf("## Candidate documents")),
  })
}

export function percentile(values: number[], p: number) {
  if (values.length === 0) return "—"
  const sorted = [...values].sort((a, b) => a - b)
  return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))]
}

export function mean(values: number[]) {
  return values.length
    ? Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 100) /
        100
    : null
}

/** Runs `fn` over `items` with at most `limit` in flight. */
export async function pool<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>
): Promise<R[]> {
  const results: R[] = new Array(items.length)
  let next = 0
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (next < items.length) {
        const i = next++
        results[i] = await fn(items[i])
      }
    })
  )
  return results
}

/** The answering model isn't the one asked for (the gateway fell back). */
export function isFallback(answered: string | null, requested: string) {
  if (!answered) return false
  const name = requested.slice(requested.indexOf("/") + 1)
  return answered !== requested && !answered.endsWith(name)
}
