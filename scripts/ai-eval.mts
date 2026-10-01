/**
 * Evaluates the live AI calls with real models: the turn judge against
 * labelled cases, and the answer coach for latency, prompt caching, format
 * and grounding in your own documents. Run before and after changing a
 * model or prompt (config/defaults/ai.ts, lib/ai/*).
 *
 *   pnpm ai:eval                                  # both, configured models
 *   pnpm ai:eval --only judge --model openai/gpt-4.1-nano
 *   pnpm ai:eval --only coach --interview <interviewId>
 *
 * Needs OPENAI_API_KEY (+ provider keys for other models) and the database
 * (the coach's brief is built from your documents).
 */
import { parseArgs } from "node:util"

import { AI_TASKS, BRIEF_MAX_CHARS } from "../config/defaults/ai"
import { streamCoachAnswer } from "../lib/ai/coach"
import { judgeTurn, type Turn, type Verdict } from "../lib/ai/judge"
import { splitAnswer } from "../lib/answer/format"
import { db } from "../lib/db"
import { buildInterviewBrief } from "../lib/interview/brief"
import { loadInterviewBrief } from "../lib/interview/load-brief"

const { values: args } = parseArgs({
  options: {
    only: { type: "string" },
    model: { type: "string" },
    interview: { type: "string" },
  },
})

// ─── Judge ────────────────────────────────────────────────────────────────────

interface JudgeCase {
  name: string
  text: string
  context?: Turn[]
  lastAnsweredQuestion?: string
  expect: Partial<Pick<Verdict, "isAsk" | "complete" | "duplicate">>
  /** Words the rewritten question must contain (merged / resolved) */
  questionHas?: string[]
}

const JUDGE_CASES: JudgeCase[] = [
  {
    name: "vi complete question",
    text: "Em đã làm việc với Kubernetes chưa?",
    expect: { isAsk: true, complete: true, duplicate: false },
    questionHas: ["Kubernetes"],
  },
  {
    name: "en instruction is complete",
    text: "Walk me through your last project",
    expect: { isAsk: true, complete: true },
  },
  {
    name: "en trails off",
    text: "Tell me about a time when you and",
    expect: { isAsk: true, complete: false },
  },
  {
    name: "vi trails off",
    text: "Vậy thì khi hệ thống bị quá tải thì",
    expect: { complete: false },
  },
  {
    name: "vi acknowledgement",
    text: "Ok, cảm ơn em",
    expect: { isAsk: false },
  },
  {
    name: "en company pitch, no ask",
    text: "So our team owns the payments platform and we are growing fast this year",
    expect: { isAsk: false },
  },
  {
    name: "vi context folded in",
    text: "Hệ thống bên anh dùng Kafka cho thanh toán, khoảng mười nghìn message mỗi giây. Em sẽ scale nó thế nào?",
    expect: { isAsk: true, complete: true },
    questionHas: ["Kafka", "scale"],
  },
  {
    name: "en follow-up resolved",
    text: "Why?",
    context: [
      {
        role: "interviewer",
        content: "Which language did you pick for the new service?",
      },
      { role: "candidate", content: "We went with Go for that service." },
    ],
    expect: { isAsk: true, complete: true },
    questionHas: ["Go"],
  },
  {
    name: "vi follow-up resolved",
    text: "Tại sao vậy em?",
    context: [
      { role: "interviewer", content: "Em chọn database nào cho dự án đó?" },
      { role: "candidate", content: "Em chọn PostgreSQL ạ." },
    ],
    expect: { isAsk: true },
    questionHas: ["PostgreSQL"],
  },
  {
    name: "en duplicate",
    text: "So again, why are you leaving?",
    lastAnsweredQuestion: "Why do you want to leave your current job?",
    expect: { isAsk: true, duplicate: true },
  },
]

async function evalJudge(model: string) {
  console.log(`\n## Judge — ${model}\n`)
  const times: number[] = []
  let passed = 0

  for (const c of JUDGE_CASES) {
    const started = performance.now()
    let verdict: Verdict | null = null
    let error = ""
    try {
      verdict = await judgeTurn({
        text: c.text,
        context: c.context ?? [],
        lastAnsweredQuestion: c.lastAnsweredQuestion ?? null,
        model,
      })
    } catch (e) {
      error = e instanceof Error ? e.message : String(e)
    }
    const ms = Math.round(performance.now() - started)
    times.push(ms)

    const failures = verdict
      ? [
          ...Object.entries(c.expect)
            .filter(([k, v]) => verdict![k as keyof Verdict] !== v)
            .map(([k, v]) => `${k}≠${v}`),
          ...(c.questionHas ?? [])
            .filter(
              (w) => !verdict!.question.toLowerCase().includes(w.toLowerCase())
            )
            .map((w) => `question lacks "${w}"`),
        ]
      : [error || "no verdict"]
    if (failures.length === 0) passed++

    console.log(
      `${failures.length ? "✗" : "✓"} ${c.name.padEnd(28)} ${String(
        ms
      ).padStart(5)}ms  ` +
        (verdict ? JSON.stringify(verdict.question) : "") +
        (failures.length ? `  ← ${failures.join(", ")}` : "")
    )
  }

  times.sort((a, b) => a - b)
  console.log(
    `\n${passed}/${JUDGE_CASES.length} passed · p50 ${
      times[Math.floor(times.length / 2)]
    }ms · max ${times.at(-1)}ms`
  )
}

// ─── Coach ────────────────────────────────────────────────────────────────────

const COACH_QUESTIONS: [string, string][] = [
  ["en", "Tell me about a project you're proud of."],
  ["vi", "Em đã làm gì với AWS rồi?"],
  // Not in the documents (as of writing): must not claim it
  ["en", "Have you worked with Kafka in production?"],
  ["en", "What's the difference between optimistic and pessimistic locking?"],
]

async function coachBrief() {
  const user = await db.user.findFirst({ select: { id: true } })
  if (!user) throw new Error("No user in the database")
  if (args.interview) return loadInterviewBrief(args.interview, user.id)

  // No interview given: brief from all of the user's documents
  const documents = await db.document.findMany({
    where: { userId: user.id },
    select: { title: true, type: true, content: true },
  })
  return buildInterviewBrief(
    { companyName: "Acme", jobTitle: "Senior Backend Engineer", notes: null },
    documents,
    BRIEF_MAX_CHARS
  )
}

async function evalCoach(model: string) {
  const brief = await coachBrief()
  console.log(`\n## Coach — ${model} · brief ${brief.length} chars\n`)

  for (const [language, text] of COACH_QUESTIONS) {
    console.log(`=== ${text}`)
    // Twice: the second call shows whether the brief prefix is cached
    for (const attempt of [1, 2]) {
      const started = performance.now()
      let firstTokenMs: number | null = null
      let answer = ""
      const result = streamCoachAnswer({
        brief,
        context: [],
        language,
        text,
        model,
      })
      for await (const delta of result.textStream) {
        firstTokenMs ??= Math.round(performance.now() - started)
        answer += delta
      }
      const usage = await result.usage
      const { modelId } = await result.response
      const { points, script } = splitAnswer(answer)
      const formatOk = points.length === 3 && script.length > 0

      console.log(
        `  #${attempt} first token ${
          firstTokenMs ?? "—"
        }ms · total ${Math.round(performance.now() - started)}ms · ` +
          `input ${usage.inputTokens} (cached ${
            usage.inputTokenDetails.cacheReadTokens ?? 0
          }) · ` +
          `format ${formatOk ? "ok" : "✗"} · ${modelId}`
      )
      if (attempt === 1)
        console.log(`    ${answer.trim().replace(/\n/g, "\n    ")}`)
    }
    console.log()
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────────

try {
  if (args.only !== "coach") await evalJudge(args.model ?? AI_TASKS.judge.model)
  if (args.only !== "judge") await evalCoach(args.model ?? AI_TASKS.coach.model)
} finally {
  await db.$disconnect()
}
