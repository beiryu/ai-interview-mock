import { headers } from "next/headers"
import { z } from "zod"

import { streamScreenshotSolution } from "@/lib/ai/screenshot"
import { auth } from "@/lib/auth"

const RequestSchema = z.object({
  /** Screenshot as a data URL ("data:image/png;base64,…") */
  image: z.string().startsWith("data:image/").max(12_000_000),
  language: z.string().nullable().default(null),
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
  const { image, language } = parsed.data

  const result = streamScreenshotSolution({
    image,
    language,
    abortSignal: req.signal,
  })

  const encoder = new TextEncoder()
  const line = (event: object) => encoder.encode(JSON.stringify(event) + "\n")

  const body = new ReadableStream({
    async start(controller) {
      try {
        for await (const delta of result.textStream) {
          controller.enqueue(line({ type: "delta", text: delta }))
        }
        const { modelId } = await result.response
        controller.enqueue(line({ type: "done", model: modelId }))
      } catch (error) {
        controller.enqueue(
          line({
            type: "error",
            message: error instanceof Error ? error.message : "Failed",
          })
        )
      } finally {
        controller.close()
      }
    },
  })

  return new Response(body, {
    headers: { "Content-Type": "application/x-ndjson" },
  })
}
