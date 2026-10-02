import { z } from "zod"

import { JUDGE_CONTEXT_CHARS } from "@/config/defaults/ai"

import { runObject } from "./run"

/**
 * The turn judge: is the interviewer's latest speech an ask, is it finished,
 * and what exactly should be answered. See app/api/assistant/judge.
 */

export const QUESTION_KINDS = [
  "technical",
  "experience",
  "behavioral",
  "personal",
  "motivation",
  "followup",
  "other",
] as const

export const VerdictSchema = z.object({
  isAsk: z
    .boolean()
    .describe(
      "The interviewer is asking or prompting the candidate for a substantive response"
    ),
  complete: z
    .boolean()
    .describe(
      "The ask is finished; false if the interviewer stopped mid-thought"
    ),
  question: z
    .string()
    .describe(
      "The full question to answer, self-contained, in the interviewer's language; empty if not an ask"
    ),
  duplicate: z.boolean().describe("Just restates the last answered question"),
  kind: z
    .enum(QUESTION_KINDS)
    .describe('What kind of question it is ("other" if not an ask)'),
})

export type Verdict = z.infer<typeof VerdictSchema>
export type QuestionKind = (typeof QUESTION_KINDS)[number]

const SYSTEM_PROMPT = `You watch a live job interview transcript (Vietnamese, English, or mixed) and judge the INTERVIEWER's latest words, which may still be in progress.

isAsk — the interviewer is asking the candidate something or telling them to talk. Questions AND instructions count: "Tell me about…", "Walk me through…", "Describe…", "Em kể…", "Em giới thiệu…", "Why?", "Tại sao?". NOT asks: small talk, acknowledgements ("ok", "ừ", "great", "cảm ơn em"), the interviewer describing their company or team without asking anything.

complete — the ask is fully stated. An instruction like "Walk me through your last project" IS complete. It is incomplete only when it trails off mid-thought ("…and", "…và", "…thì", "…like the", "…when you") or gives context without the actual question yet.

question — the ask rewritten as one self-contained question, in THE SAME LANGUAGE the interviewer used (Vietnamese stays Vietnamese, English stays English; keep English technical terms as spoken). Fold in context they gave ("Hệ thống bên anh dùng Kafka… em sẽ scale nó thế nào?" → "Em sẽ scale hệ thống dùng Kafka của bên anh như thế nào?"). Resolve follow-ups from the conversation ("Why?" after the candidate said they chose Go → "Why did you choose Go?"). Empty string if not an ask.

duplicate — true if the ask requests the same thing as LAST ANSWERED QUESTION, even when reworded ("So again, why are you leaving?" duplicates "Why do you want to leave your current job?").

kind — technical (concepts, design, how something works), experience (what the candidate did/used), behavioral ("tell me about a time…"), personal (salary, reasons, location, availability, hobbies, strengths/weaknesses), motivation (why us, introduce yourself, career goals), followup (digs into the previous answer), other.

Transcripts contain speech recognition errors; judge the intent.`

export interface Turn {
  role: string
  content: string
}

/** Newest turns that fit in `max` characters, oldest first. */
export function fitContext(
  context: { role: string; content: string }[],
  max: number
) {
  const lines: string[] = []
  let size = 0
  for (const turn of [...context].reverse()) {
    const who = turn.role === "candidate" ? "CANDIDATE" : "INTERVIEWER"
    const line = `${who}: ${turn.content}`
    if (size + line.length > max) break
    lines.unshift(line)
    size += line.length
  }
  return lines.join("\n")
}

export function buildJudgeInput({
  text,
  context,
  lastAnsweredQuestion,
  maxContextChars = JUDGE_CONTEXT_CHARS,
}: {
  text: string
  context: Turn[]
  lastAnsweredQuestion: string | null
  maxContextChars?: number
}) {
  return [
    context.length
      ? `CONVERSATION SO FAR:\n${fitContext(context, maxContextChars)}`
      : "",
    lastAnsweredQuestion
      ? `LAST ANSWERED QUESTION: ${lastAnsweredQuestion}`
      : "",
    `INTERVIEWER'S LATEST WORDS: ${text}`,
  ]
    .filter(Boolean)
    .join("\n\n")
}

/** Throws on timeout, abort, provider or schema errors. */
export async function judgeTurn({
  abortSignal,
  model,
  ...input
}: {
  text: string
  context: Turn[]
  lastAnsweredQuestion: string | null
  abortSignal?: AbortSignal
  /** Gateway id overriding the configured model (evals) */
  model?: string
}): Promise<Verdict> {
  const { output } = await runObject("judge", VerdictSchema, {
    instructions: SYSTEM_PROMPT,
    prompt: buildJudgeInput(input),
    abortSignal,
    model,
  })
  return output
}
