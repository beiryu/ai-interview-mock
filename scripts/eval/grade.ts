import { z } from "zod"

import { runObject } from "../../lib/ai/run"
import {
  loadQuestions,
  mean,
  percentile,
  pool,
  readRun,
  writeRun,
  type AnswerRecord,
  type EvalQuestion,
  type Grade,
  type RunFile,
} from "./shared"

/**
 * LLM-as-judge for coach answers, with the grader from AI_TASKS.grader (a
 * different model family than the coach, against self-preference bias).
 * Absolute rubric per answer (`grade`) and pairwise runs in both orders
 * (`compare`) — pairwise is the more reliable signal between two setups.
 */

const SOURCE_RULES = `GROUND TRUTH is the candidate's own documents. A claim about the candidate (employer, project, role, team size, metric, technology they used, personal fact such as salary, hobbies, location, reasons) is SUPPORTED only if the ground truth or the conversation context states it. General technical knowledge is not a claim about the candidate. A placeholder the candidate is told to fill in (e.g. "[điền: …]", "[your example]") is not a claim — it is the correct move when the documents lack the fact. Inventing a plausible story, number or preference is the worst failure.`

const RubricSchema = z.object({
  groundedness: z
    .number()
    .int()
    .min(1)
    .max(5)
    .describe(
      "5 = every claim about the candidate is supported; 3 = minor unsupported detail; 1 = invented story, number or experience"
    ),
  unsupportedClaims: z
    .array(z.string())
    .describe("Each claim about the candidate not supported by ground truth"),
  relevance: z
    .number()
    .int()
    .min(1)
    .max(5)
    .describe("Answers exactly what was asked"),
  specificity: z
    .number()
    .int()
    .min(1)
    .max(5)
    .describe("Concrete (real projects, numbers, mechanisms) vs generic"),
  star: z
    .number()
    .int()
    .min(1)
    .max(5)
    .nullable()
    .describe(
      "Behavioral questions only: Situation-Task-Action-Result shape; null otherwise"
    ),
  speakability: z
    .number()
    .int()
    .min(1)
    .max(5)
    .describe(
      "Easy to glance at and say aloud live: key points first, short sentences, no jargon dump"
    ),
  languageMatch: z
    .boolean()
    .describe(
      "Answer is in the question's language (English tech terms inside Vietnamese are fine)"
    ),
  verdict: z.string().describe("One sentence on the main strength or failure"),
})

const PairSchema = z.object({
  winner: z.enum(["first", "second", "tie"]),
  reason: z.string().describe("One sentence"),
})

function questionBlock(q: EvalQuestion) {
  return [
    q.context?.length
      ? `CONVERSATION SO FAR:\n${q.context
          .map((t) => `${t.role.toUpperCase()}: ${t.content}`)
          .join("\n")}`
      : "",
    `QUESTION (${q.kind}, ${q.lang}): ${q.question}`,
    q.expect ? `A GOOD ANSWER: ${q.expect}` : "",
    q.mustNotClaim?.length
      ? `MUST NOT CLAIM: ${q.mustNotClaim.join("; ")}`
      : "",
  ]
    .filter(Boolean)
    .join("\n\n")
}

export async function grade(file: string, opts: { grader?: string }) {
  const run = readRun(file)
  const questions = new Map(loadQuestions().map((q) => [q.id, q]))
  const graded: Record<string, Grade> = {}

  await pool(run.answers, 5, async (a) => {
    const q = questions.get(a.id)
    if (!q || a.error || !a.answer) return
    try {
      const { output } = await runObject("grader", RubricSchema, {
        model: opts.grader,
        maxRetries: 2,
        instructions: `You grade suggested answers that a live interview copilot shows the candidate to say. ${SOURCE_RULES} Be strict and consistent; length is not a virtue.`,
        prompt: `GROUND TRUTH:\n${run.groundTruth}\n\n${questionBlock(
          q
        )}\n\nSUGGESTED ANSWER:\n${a.answer}`,
      })
      graded[a.id] = output
    } catch (e) {
      console.error(`grade ${a.id} failed:`, e instanceof Error ? e.message : e)
    }
  })

  run.grades = graded
  run.grader = opts.grader ?? "AI_TASKS.grader"
  writeRun(run, file)
  printGradeSummary(run)
}

export function printGradeSummary(run: RunFile) {
  const rows = run.answers.filter((a) => run.grades?.[a.id])
  const g = (a: AnswerRecord) => run.grades![a.id]
  const byKind = new Map<string, AnswerRecord[]>()
  for (const a of rows) byKind.set(a.kind, [...(byKind.get(a.kind) ?? []), a])

  console.log(`\n## Grades — ${run.preset} (${run.coachModel})\n`)
  console.log("kind         n  ground  relev  spec  speak  star  lang")
  for (const [kind, list] of [...byKind, ["ALL", rows] as const]) {
    const stars = list
      .map((a) => g(a).star)
      .filter((v): v is number => v !== null)
    console.log(
      `${kind.padEnd(11)} ${String(list.length).padStart(2)}  ${[
        mean(list.map((a) => g(a).groundedness)),
        mean(list.map((a) => g(a).relevance)),
        mean(list.map((a) => g(a).specificity)),
        mean(list.map((a) => g(a).speakability)),
        stars.length ? mean(stars) : "—",
        `${list.filter((a) => g(a).languageMatch).length}/${list.length}`,
      ]
        .map((v) => String(v).padStart(5))
        .join("  ")}`
    )
  }
  const ttft = run.answers
    .map((a) => a.firstTokenMs)
    .filter((v): v is number => v !== null)
  console.log(
    `\nfirst token p50 ${percentile(ttft, 0.5)}ms · p90 ${percentile(
      ttft,
      0.9
    )}ms`
  )
  const invented = rows.filter((a) => g(a).groundedness <= 2)
  if (invented.length) {
    console.log(`\nLikely invented (groundedness ≤ 2):`)
    for (const a of invented)
      console.log(
        `  ${a.id}: ${g(a).unsupportedClaims.join(" | ") || g(a).verdict}`
      )
  }
}

export async function compare(
  fileA: string,
  fileB: string,
  opts: { grader?: string }
) {
  const a = readRun(fileA)
  const b = readRun(fileB)
  const questions = new Map(loadQuestions().map((q) => [q.id, q]))
  const answersB = new Map(b.answers.map((x) => [x.id, x]))
  const pairs = a.answers
    .map((x) => [x, answersB.get(x.id)] as const)
    .filter(
      (p): p is readonly [AnswerRecord, AnswerRecord] =>
        !!p[1] && !!p[0].answer && !!p[1].answer && questions.has(p[0].id)
    )

  const judgeOnce = async (q: EvalQuestion, first: string, second: string) => {
    const { output } = await runObject("grader", PairSchema, {
      model: opts.grader,
      maxRetries: 2,
      instructions: `You compare two suggested answers a live interview copilot could show the candidate. ${SOURCE_RULES} Prefer, in order: truthful about the candidate > answers what was asked > easy to say aloud live > concrete. Do not prefer the longer answer. Answer "tie" when neither is clearly better.`,
      prompt: `GROUND TRUTH:\n${a.groundTruth}\n\n${questionBlock(
        q
      )}\n\nFIRST ANSWER:\n${first}\n\nSECOND ANSWER:\n${second}`,
    })
    return output
  }

  // Both orders; disagreeing verdicts (position bias) count as a tie
  const results = await pool(pairs, 4, async ([x, y]) => {
    const q = questions.get(x.id)!
    try {
      const [ab, ba] = await Promise.all([
        judgeOnce(q, x.answer, y.answer),
        judgeOnce(q, y.answer, x.answer),
      ])
      const winAB =
        ab.winner === "first" ? "A" : ab.winner === "second" ? "B" : "tie"
      const winBA =
        ba.winner === "first" ? "B" : ba.winner === "second" ? "A" : "tie"
      const winner = winAB === winBA ? winAB : "tie"
      return { id: x.id, kind: x.kind, winner, reason: ab.reason }
    } catch (e) {
      console.error(
        `compare ${x.id} failed:`,
        e instanceof Error ? e.message : e
      )
      return null
    }
  })

  const done = results.filter((r): r is NonNullable<typeof r> => r !== null)
  const count = (w: string, list = done) =>
    list.filter((r) => r.winner === w).length
  console.log(
    `\n## Pairwise — A: ${a.preset} (${a.coachModel}) vs B: ${b.preset} (${b.coachModel})\n`
  )
  console.log("kind          A   B  tie")
  const kinds = [...new Set(done.map((r) => r.kind))]
  for (const kind of [...kinds, "ALL"]) {
    const list = kind === "ALL" ? done : done.filter((r) => r.kind === kind)
    console.log(
      `${kind.padEnd(11)} ${[
        count("A", list),
        count("B", list),
        count("tie", list),
      ]
        .map((n) => String(n).padStart(3))
        .join(" ")}`
    )
  }
  const decided = count("A") + count("B")
  if (decided) {
    console.log(
      `\nA win rate (excluding ties): ${Math.round(
        (count("A") / decided) * 100
      )}%`
    )
  }
  for (const r of done.filter((r) => r.winner !== "tie")) {
    console.log(`  ${r.id} → ${r.winner}: ${r.reason}`)
  }
}
