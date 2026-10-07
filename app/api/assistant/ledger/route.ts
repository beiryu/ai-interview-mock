import { NextResponse } from "next/server"
import { z } from "zod"

import { EMPTY_LEDGER, LedgerSchema, updateLedger } from "@/lib/ai/ledger"
import { db } from "@/lib/db"
import { JobPrepSchema } from "@/lib/prep/schema"
import { getCurrentUser } from "@/lib/session"

const RequestSchema = z.object({
  sessionId: z.string().min(1),
  question: z.string().min(1),
  kind: z.string().default("other"),
  /** The answer the coach suggested */
  suggested: z.string().default(""),
  /** What the candidate actually said afterwards */
  said: z.string().min(1),
})

/**
 * Records one answered question in the session ledger. Fire-and-forget
 * from the client; failures only mean the coach knows a bit less.
 */
export async function POST(req: Request) {
  const user = await getCurrentUser()
  if (!user) return new NextResponse("Unauthorized", { status: 401 })

  const parsed = RequestSchema.safeParse(await req.json())
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues }, { status: 422 })
  }
  const { sessionId, ...input } = parsed.data

  const session = await db.interviewSession.findFirst({
    where: { id: sessionId, userId: user.id },
    select: {
      ledger: true,
      job: { select: { prep: { select: { content: true } } } },
    },
  })
  if (!session) return new NextResponse("Not found", { status: 404 })

  // The job's stories, so the ledger can note which ones were told
  const prep = JobPrepSchema.safeParse(session.job.prep?.content)
  const current = LedgerSchema.safeParse(session.ledger)

  try {
    const ledger = await updateLedger({
      ...input,
      ledger: current.success ? current.data : EMPTY_LEDGER,
      stories: prep.success
        ? prep.data.stories.map((s) => `${s.id} ${s.title}`)
        : [],
    })
    await db.interviewSession.update({
      where: { id: sessionId },
      data: { ledger },
    })
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error("Ledger update failed:", error)
    return NextResponse.json({ ok: false }, { status: 502 })
  }
}
