import { headers } from "next/headers"
import { run } from "@openai/agents"
import { z } from "zod"

import { createAnswerCoachAgent } from "@/lib/agents/interview-agents"
import { auth } from "@/lib/auth"
import { loadInterviewBrief } from "@/lib/interview/load-brief"

const RequestSchema = z.object({
  interviewId: z.string().min(1),
  text: z.string().min(1),
  /** Dominant language of the question from speech-to-text ("vi", "en"…) */
  language: z.string().nullable().default(null),
  /** Recent transcript; the only memory the coach has (stateless per call) */
  context: z
    .array(z.object({ role: z.string(), content: z.string() }))
    .default([]),
})

export async function POST(req: Request) {
  const authSession = await auth.api.getSession({ headers: await headers() })
  if (!authSession?.user?.id) {
    return new Response("Unauthorized", { status: 401 })
  }

  const parsed = RequestSchema.safeParse(await req.json())
  if (!parsed.success) {
    return new Response("Invalid request", { status: 400 })
  }
  const { interviewId, text, language, context } = parsed.data

  const brief = await loadInterviewBrief(interviewId, authSession.user.id)

  const contextBlock =
    context.length > 0
      ? "CONVERSATION SO FAR:\n" +
        context
          .map(
            (m) =>
              `${m.role === "interviewer" ? "INTERVIEWER" : "YOU SAID"}: ${
                m.content
              }`
          )
          .join("\n") +
        "\n\n"
      : ""

  const languageLine = language ? `QUESTION LANGUAGE: ${language}\n` : ""
  const input = `${contextBlock}${languageLine}NEW QUESTION FROM INTERVIEWER: ${text}`

  try {
    const streamed = await run(createAnswerCoachAgent(brief), input, {
      stream: true,
      // Client aborts (draft dropped, not a question) stop the model run
      signal: req.signal,
    })

    const encoder = new TextEncoder()
    const body = new ReadableStream({
      async start(controller) {
        try {
          for await (const event of streamed) {
            if (
              event.type === "raw_model_stream_event" &&
              event.data.type === "output_text_delta"
            ) {
              const chunk =
                JSON.stringify({
                  type: "delta",
                  text: (event.data as { delta: string }).delta,
                }) + "\n"
              controller.enqueue(encoder.encode(chunk))
            }
          }
          controller.enqueue(
            encoder.encode(JSON.stringify({ type: "done" }) + "\n")
          )
        } catch (err: unknown) {
          const isAbort =
            err instanceof Error &&
            (err.name === "AbortError" ||
              (err as NodeJS.ErrnoException).code === "ERR_INVALID_STATE")
          if (!isAbort) console.error("Stream error:", err)
        } finally {
          try {
            controller.close()
          } catch {
            // Already closed — client disconnected
          }
        }
      },
    })

    return new Response(body, {
      headers: { "Content-Type": "application/x-ndjson" },
    })
  } catch (error) {
    console.error("Error running answer coach agent:", error)
    return new Response("Error analyzing interview", { status: 500 })
  }
}
