import { NextResponse } from "next/server"
import * as z from "zod"

import { OPENAI_DEFAULTS } from "@/config/defaults/openai"
import openai from "@/lib/openai"
import { getCurrentUser } from "@/lib/session"

const RequestSchema = z.object({
  /** Interviewer's words since the last committed question */
  text: z.string().min(1),
  /** Recent turns, oldest first */
  context: z
    .array(z.object({ role: z.string(), content: z.string() }))
    .default([]),
  lastAnsweredQuestion: z.string().nullable().default(null),
})

const VERDICT_SCHEMA = {
  name: "turn_verdict",
  strict: true,
  schema: {
    type: "object",
    additionalProperties: false,
    required: ["isAsk", "complete", "question", "duplicate"],
    properties: {
      isAsk: {
        type: "boolean",
        description:
          "The interviewer is asking or prompting the candidate for a substantive response",
      },
      complete: {
        type: "boolean",
        description:
          "The ask is finished; false if the interviewer stopped mid-thought",
      },
      question: {
        type: "string",
        description:
          "The full question to answer, self-contained, in the interviewer's language; empty if not an ask",
      },
      duplicate: {
        type: "boolean",
        description: "Just restates the last answered question",
      },
    },
  },
} as const

const SYSTEM_PROMPT = `You watch a live job interview transcript (Vietnamese, English, or mixed) and judge the INTERVIEWER's latest words, which may still be in progress.

isAsk — the interviewer is asking the candidate something or telling them to talk. Questions AND instructions count: "Tell me about…", "Walk me through…", "Describe…", "Em kể…", "Em giới thiệu…", "Why?", "Tại sao?". NOT asks: small talk, acknowledgements ("ok", "ừ", "great", "cảm ơn em"), the interviewer describing their company or team without asking anything.

complete — the ask is fully stated. An instruction like "Walk me through your last project" IS complete. It is incomplete only when it trails off mid-thought ("…and", "…và", "…thì", "…like the", "…when you") or gives context without the actual question yet.

question — the ask rewritten as one self-contained question, in THE SAME LANGUAGE the interviewer used (Vietnamese stays Vietnamese, English stays English; keep English technical terms as spoken). Fold in context they gave ("Hệ thống bên anh dùng Kafka… em sẽ scale nó thế nào?" → "Em sẽ scale hệ thống dùng Kafka của bên anh như thế nào?"). Resolve follow-ups from the conversation ("Why?" after the candidate said they chose Go → "Why did you choose Go?"). Empty string if not an ask.

duplicate — true if the ask requests the same thing as LAST ANSWERED QUESTION, even when reworded ("So again, why are you leaving?" duplicates "Why do you want to leave your current job?").

Transcripts contain speech recognition errors; judge the intent.`

function fitContext(context: { role: string; content: string }[], max: number) {
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

export async function POST(req: Request) {
  const user = await getCurrentUser()
  if (!user) {
    return new Response("Unauthorized", { status: 401 })
  }

  const parsed = RequestSchema.safeParse(await req.json())
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues }, { status: 422 })
  }
  const { text, context, lastAnsweredQuestion } = parsed.data
  const judge = OPENAI_DEFAULTS.judge

  const input = [
    context.length
      ? `CONVERSATION SO FAR:\n${fitContext(context, judge.maxContextChars)}`
      : "",
    lastAnsweredQuestion
      ? `LAST ANSWERED QUESTION: ${lastAnsweredQuestion}`
      : "",
    `INTERVIEWER'S LATEST WORDS: ${text}`,
  ]
    .filter(Boolean)
    .join("\n\n")

  const started = Date.now()
  try {
    const response = await openai.chat.completions.create(
      {
        model: judge.model,
        temperature: 0,
        max_tokens: judge.maxTokens,
        response_format: { type: "json_schema", json_schema: VERDICT_SCHEMA },
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: input },
        ],
      },
      {
        signal: AbortSignal.any([
          req.signal,
          AbortSignal.timeout(judge.timeoutMs),
        ]),
      }
    )

    const verdict = JSON.parse(response.choices[0].message.content ?? "{}")
    return NextResponse.json({ ...verdict, judgeMs: Date.now() - started })
  } catch {
    // No fail-open: the client falls back to its own heuristics
    return NextResponse.json({
      unavailable: true,
      judgeMs: Date.now() - started,
    })
  }
}
