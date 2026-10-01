import { headers } from "next/headers"
import { z } from "zod"

import { streamCoachAnswer } from "@/lib/ai/coach"
import { validateAnswer } from "@/lib/answer/validate"
import { auth } from "@/lib/auth"
import { loadCoachContext } from "@/lib/interview/load-brief"

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

  const coach = await loadCoachContext(interviewId, authSession.user.id)
  const result = streamCoachAnswer({
    brief: coach.brief,
    context,
    language,
    text,
    // Client aborts (draft dropped, not a question) stop the model run
    abortSignal: req.signal,
  })

  const encoder = new TextEncoder()
  const line = (event: object) => encoder.encode(JSON.stringify(event) + "\n")

  const body = new ReadableStream({
    async start(controller) {
      try {
        let answer = ""
        for await (const delta of result.textStream) {
          answer += delta
          controller.enqueue(line({ type: "delta", text: delta }))
        }
        // Which model actually answered (a gateway fallback shows here)
        const { modelId } = await result.response
        // Things to double-check before saying them
        const issues = validateAnswer({
          answer,
          knownIds: coach.knownIds,
          doNotClaim: coach.doNotClaim,
          source: [coach.brief, text, ...context.map((m) => m.content)].join(
            "\n"
          ),
        })
        controller.enqueue(line({ type: "done", model: modelId, issues }))
      } catch {
        // Aborted by the client; provider errors are logged in onError
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
}
