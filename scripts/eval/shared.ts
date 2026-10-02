import { mkdirSync, readFileSync, writeFileSync } from "node:fs"
import path from "node:path"

import type { Turn } from "../../lib/ai/judge"
import { CvContentSchema, cvText } from "../../lib/cv/schema"
import { db } from "../../lib/db"
import { loadInterviewBrief } from "../../lib/interview/load-brief"

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

/** The job to evaluate: --job, else your latest job with a CV. */
export async function evalJob(jobId?: string) {
  const job = await db.job.findFirst({
    where: jobId ? { id: jobId } : { cv: { isNot: null } },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      userId: true,
      company: true,
      title: true,
      jdText: true,
      cv: {
        select: {
          origin: true,
          content: true,
          basedOn: { select: { rawText: true, origin: true } },
        },
      },
    },
  })
  if (!job) throw new Error("No job to evaluate: create one in the app")
  return job
}

/**
 * The grader's truth: what the candidate really wrote (the uploaded CV
 * behind the job's CV), the job's CV and its description.
 */
export async function rawBrief(jobId?: string) {
  const job = await evalJob(jobId)
  const content = CvContentSchema.safeParse(job.cv?.content)
  const uploaded =
    job.cv?.basedOn?.origin === "UPLOADED" ? job.cv.basedOn.rawText : null
  return [
    `## Interview\nRole: ${job.title}\nCompany: ${job.company}`,
    content.success ? `## Candidate CV\n${cvText(content.data)}` : "",
    uploaded ? `## Candidate's own CV text\n${uploaded}` : "",
    job.jdText ? `## Job description\n${job.jdText}` : "",
  ]
    .filter(Boolean)
    .join("\n\n")
}

export async function evalUserId(jobId?: string) {
  return (await evalJob(jobId)).userId
}

/** The coach brief, exactly as the app builds it for the job. */
export async function prepBrief(jobId?: string) {
  const job = await evalJob(jobId)
  return loadInterviewBrief(job.id, job.userId)
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
