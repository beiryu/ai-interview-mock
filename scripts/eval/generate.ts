import { streamCoachAnswer } from "../../lib/ai/coach"
import { PRESETS } from "./presets"
import {
  isFallback,
  loadQuestions,
  percentile,
  prepBrief,
  rawBrief,
  writeRun,
  type AnswerRecord,
  type RunFile,
} from "./shared"

/**
 * Answers every eval question with a preset's coach, one at a time so the
 * latency numbers aren't skewed by concurrency, and saves the run.
 */
export async function generate(
  presetName: string,
  opts: { interviewId?: string; only?: string }
) {
  const preset = PRESETS[presetName]
  if (!preset) {
    throw new Error(
      `Unknown preset "${presetName}" (have: ${Object.keys(PRESETS).join(
        ", "
      )})`
    )
  }

  const groundTruth = await rawBrief(opts.interviewId)
  const brief =
    preset.brief === "prep" ? await prepBrief(opts.interviewId) : groundTruth
  const questions = loadQuestions().filter(
    (q) => !opts.only || q.kind === opts.only || q.id === opts.only
  )
  console.log(
    `\n## Generate — ${presetName} (${preset.coachModel}, ${preset.brief} brief ${brief.length} chars) · ${questions.length} questions\n`
  )

  const answers: AnswerRecord[] = []
  for (const q of questions) {
    const started = performance.now()
    let firstTokenMs: number | null = null
    let answer = ""
    const record: AnswerRecord = {
      id: q.id,
      kind: q.kind,
      answer: "",
      firstTokenMs: null,
      totalMs: 0,
      model: null,
      inputTokens: null,
      cachedTokens: null,
    }
    try {
      const result = streamCoachAnswer({
        brief,
        context: q.context ?? [],
        language: q.lang,
        text: q.question,
        model: preset.coachModel,
      })
      for await (const delta of result.textStream) {
        firstTokenMs ??= Math.round(performance.now() - started)
        answer += delta
      }
      const usage = await result.usage
      record.model = (await result.response).modelId
      record.inputTokens = usage.inputTokens ?? null
      record.cachedTokens = usage.inputTokenDetails.cacheReadTokens ?? null
    } catch (e) {
      record.error = e instanceof Error ? e.message : String(e)
    }
    record.answer = answer.trim()
    record.firstTokenMs = firstTokenMs
    record.totalMs = Math.round(performance.now() - started)
    answers.push(record)
    console.log(
      `${record.error ? "✗" : "·"} ${q.id.padEnd(8)} first ${String(
        firstTokenMs ?? "—"
      ).padStart(5)}ms · cached ${record.cachedTokens ?? 0}/${
        record.inputTokens ?? "?"
      }${record.error ? ` · ${record.error}` : ""}`
    )
  }

  const run: RunFile = {
    preset: presetName,
    createdAt: new Date().toISOString(),
    coachModel: preset.coachModel,
    briefKind: preset.brief,
    brief,
    groundTruth,
    answers,
  }
  const file = writeRun(run)
  const ttft = answers
    .map((a) => a.firstTokenMs)
    .filter((v): v is number => v !== null)
  console.log(
    `\nfirst token p50 ${percentile(ttft, 0.5)}ms · p90 ${percentile(
      ttft,
      0.9
    )}ms · errors ${answers.filter((a) => a.error).length} · fallbacks ${
      answers.filter((a) => isFallback(a.model, preset.coachModel)).length
    }\nsaved ${file}`
  )
  return file
}
