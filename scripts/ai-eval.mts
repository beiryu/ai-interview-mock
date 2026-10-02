/**
 * Evaluates the live AI calls with real models through the AI Gateway.
 * Run before and after changing a model or prompt (config/defaults/ai.ts,
 * lib/ai/*). Needs AI_GATEWAY_API_KEY and the database (briefs are built
 * from a job: --job <id>, else your latest job with a CV).
 *
 *   pnpm ai:eval judge [--model deepseek/deepseek-v4.1-flash]
 *       labelled turn-judge cases: pass/fail + latency
 *   pnpm ai:eval coach [--model …] [--job <id>]
 *       a few coach answers twice: latency, prompt caching, format
 *   pnpm ai:eval prep [--job <id>]
 *       builds the job's prep (and its CV if needed) now
 *   pnpm ai:eval generate --preset <name> [--job <id>] [--only <kind|id>]
 *       answers eval/coach-questions.json, saves eval/results/<run>.json
 *   pnpm ai:eval grade <run.json> [--grader <model>]
 *       rubric scores (groundedness, relevance, specificity, STAR, …)
 *   pnpm ai:eval compare <A.json> <B.json> [--grader <model>]
 *       pairwise, both orders, A's win rate
 */
import { parseArgs } from "node:util"

import { AI_TASKS } from "../config/defaults/ai"
import { db } from "../lib/db"
import { prepareJobPrepNow } from "../lib/prep/service"
import { generate } from "./eval/generate"
import { compare, grade } from "./eval/grade"
import { evalJob, prepBrief } from "./eval/shared"
import { evalCoach, evalJudge } from "./eval/smoke"

const { values: args, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    model: { type: "string" },
    job: { type: "string" },
    preset: { type: "string" },
    only: { type: "string" },
    grader: { type: "string" },
  },
})

const [command = "help", ...files] = positionals

try {
  switch (command) {
    case "judge":
      await evalJudge(args.model ?? AI_TASKS.judge.model)
      break
    case "coach":
      await evalCoach(
        args.model ?? AI_TASKS.coach.model,
        await prepBrief(args.job)
      )
      break
    case "prep": {
      const job = await evalJob(args.job)
      const started = performance.now()
      await prepareJobPrepNow(job.id, job.userId)
      const row = await db.jobPrep.findUnique({ where: { jobId: job.id } })
      console.log(
        `job prep (${job.company}): ${row?.status}${
          row?.error ? ` (${row.error})` : ""
        } · ${Math.round((performance.now() - started) / 1000)}s`
      )
      break
    }
    case "generate":
      await generate(args.preset ?? "current", {
        jobId: args.job,
        only: args.only,
      })
      break
    case "grade":
      if (!files[0]) throw new Error("Usage: pnpm ai:eval grade <run.json>")
      await grade(files[0], { grader: args.grader })
      break
    case "compare":
      if (files.length < 2)
        throw new Error("Usage: pnpm ai:eval compare <A.json> <B.json>")
      await compare(files[0], files[1], { grader: args.grader })
      break
    default:
      console.log(
        "Commands: judge | coach | prep | generate | grade | compare (see scripts/ai-eval.mts)"
      )
  }
} finally {
  await db.$disconnect()
}
