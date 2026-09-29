import { NextResponse } from "next/server"
import * as z from "zod"

import { judgeTurn } from "@/lib/ai/judge"
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

export async function POST(req: Request) {
  const user = await getCurrentUser()
  if (!user) {
    return new Response("Unauthorized", { status: 401 })
  }

  const parsed = RequestSchema.safeParse(await req.json())
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues }, { status: 422 })
  }

  const started = Date.now()
  try {
    const verdict = await judgeTurn({ ...parsed.data, abortSignal: req.signal })
    return NextResponse.json({ ...verdict, judgeMs: Date.now() - started })
  } catch {
    // No fail-open: the client falls back to its own heuristics
    return NextResponse.json({
      unavailable: true,
      judgeMs: Date.now() - started,
    })
  }
}
