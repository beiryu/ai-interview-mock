import { headers } from "next/headers"
import {
  MemorySession,
  OpenAIResponsesCompactionSession,
  run,
  type AgentInputItem,
} from "@openai/agents"

import { createAnswerCoachAgent } from "@/lib/agents/interview-agents"
import { auth } from "@/lib/auth"
import { getOrCreateVectorStore } from "@/lib/openai/vector-store-service"

export async function POST(req: Request) {
  const authSession = await auth.api.getSession({ headers: await headers() })
  if (!authSession?.user?.id) {
    return new Response("Unauthorized", { status: 401 })
  }

  const {
    text,
    language = null,
    agentHistory = [],
    context = [],
    sessionContext,
    selectedDocuments,
    fastMode = false,
  }: {
    text: string
    /** Dominant language of the question from speech-to-text ("vi", "en"…) */
    language?: string | null
    agentHistory: AgentInputItem[]
    context: { role: string; content: string }[]
    sessionContext?: string
    selectedDocuments?: string[]
    fastMode?: boolean
  } = await req.json()

  const vectorStoreId = fastMode
    ? undefined
    : await getOrCreateVectorStore(authSession.user.id)

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
  // The new question goes last so the stable prefix stays cacheable
  const input = `${contextBlock}${languageLine}NEW QUESTION FROM INTERVIEWER: ${text}`

  const memorySession = new MemorySession({ initialItems: agentHistory })
  const session = new OpenAIResponsesCompactionSession({
    underlyingSession: memorySession,
    shouldTriggerCompaction: ({ compactionCandidateItems }) =>
      compactionCandidateItems.length >= 12,
  })

  const agent = createAnswerCoachAgent(
    sessionContext,
    vectorStoreId,
    selectedDocuments
  )

  try {
    const streamed = await run(agent, input, {
      session,
      stream: true,
      // Client aborts (speculation dropped, not a question) stop the model run
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
          const updatedHistory = await session.getItems()
          const done = JSON.stringify({ type: "done", updatedHistory }) + "\n"
          controller.enqueue(encoder.encode(done))
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
