import { headers } from "next/headers"
import { NextResponse } from "next/server"

import { auth } from "@/lib/auth"
import { ConfigService } from "@/lib/config/config.service"
import openai from "@/lib/openai"
import { buildPrompt, buildSummarizerPrompt } from "@/lib/utils"

// Note: runtime = "edge" removed — ConfigService requires Node.js (Prisma)

export async function POST(req: Request) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user?.id) {
    return new Response("Unauthorized", { status: 401 })
  }

  const config = await ConfigService.forUser(session.user.id)
  const { backgroundText, flag, prompt: transcribe } = await req.json()

  let prompt = transcribe
  if (flag === "interview-assistant") {
    prompt = buildPrompt(backgroundText, transcribe)
  } else if (flag === "summarize") {
    prompt = buildSummarizerPrompt(transcribe)
  }

  try {
    const stream = await openai.chat.completions.create({
      model: config.openai.chat.model,
      max_tokens: config.openai.chat.maxTokens,
      temperature: config.openai.chat.temperature,
      presence_penalty: config.openai.chat.presencePenalty,
      frequency_penalty: config.openai.chat.frequencyPenalty,
      messages: [{ role: "user", content: prompt }],
      stream: true,
    })

    const encoder = new TextEncoder()
    const readable = new ReadableStream({
      async start(controller) {
        for await (const chunk of stream) {
          const content = chunk.choices[0]?.delta?.content || ""
          if (content) {
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ content })}\n\n`)
            )
          }
        }
        controller.enqueue(encoder.encode("data: [DONE]\n\n"))
        controller.close()
      },
    })

    return new Response(readable, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    })
  } catch (error) {
    console.error(error)
    return new NextResponse("Error", { status: 500 })
  }
}
