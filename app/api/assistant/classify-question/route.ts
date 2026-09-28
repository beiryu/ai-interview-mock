import { headers } from "next/headers"
import { NextResponse } from "next/server"

import { auth } from "@/lib/auth"
import { ConfigService } from "@/lib/config/config.service"
import openai from "@/lib/openai"

export async function POST(req: Request) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user?.id) {
    return new Response("Unauthorized", { status: 401 })
  }

  const config = await ConfigService.forUser(session.user.id)

  const {
    text,
    context = [],
  }: {
    text: string
    context: { role: string; content: string }[]
  } = await req.json()

  // Tier 1: word count gate — free, no LLM
  if (text.trim().split(/\s+/).length < 4) {
    return NextResponse.json({ isQuestion: false })
  }

  const controller = new AbortController()
  const timeout = setTimeout(
    () => controller.abort(),
    config.openai.classify.timeoutMs
  )

  try {
    const messages: {
      role: "system" | "user" | "assistant"
      content: string
    }[] = [
      {
        role: "system",
        content:
          'You are a classifier for interview transcripts. The speech may be Vietnamese, English, or mixed.\n\nDetermine if the transcript is a complete interview question worth answering.\n\nReturn only valid JSON: { "isQuestion": true } or { "isQuestion": false }\n\nReturn false for:\n- Single words or short filler sounds (yes, no, ok, ừ, uh, hmm, right, okay)\n- Incomplete fragments (trailing off mid-sentence)\n- Affirmations or acknowledgements\n\nReturn true for:\n- Complete questions requiring a substantive answer\n- Statements that clearly prompt a response',
      },
    ]

    // Add up to 3 context messages
    for (const m of context.slice(-3)) {
      messages.push({
        role: m.role === "candidate" ? "assistant" : "user",
        content: m.content,
      })
    }

    messages.push({ role: "user", content: `INPUT: ${text}` })

    const response = await openai.chat.completions.create(
      {
        model: config.openai.classify.model,
        messages,
        response_format: { type: "json_object" },
        max_tokens: config.openai.classify.maxTokens,
        temperature: config.openai.classify.temperature,
      },
      { signal: controller.signal }
    )

    const result = JSON.parse(response.choices[0].message.content ?? "{}")
    return NextResponse.json({ isQuestion: result.isQuestion ?? true })
  } catch {
    // Timeout or any error → fail open (preserve existing behavior)
    return NextResponse.json({ isQuestion: true })
  } finally {
    clearTimeout(timeout)
  }
}
