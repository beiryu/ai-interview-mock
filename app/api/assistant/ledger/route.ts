import { NextResponse } from "next/server"
import { z } from "zod"

import { EMPTY_LEDGER, LedgerSchema, updateLedger } from "@/lib/ai/ledger"
import { db } from "@/lib/db"
import { ProfilePrepSchema } from "@/lib/prep/schema"
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
    select: { ledger: true },
  })
  if (!session) return new NextResponse("Not found", { status: 404 })

  const prep = await db.profilePrep.findUnique({
    where: { userId: user.id },
    select: { content: true },
  })
  const profile = ProfilePrepSchema.safeParse(prep?.content)
  const current = LedgerSchema.safeParse(session.ledger)

  try {
    const ledger = await updateLedger({
      ...input,
      ledger: current.success ? current.data : EMPTY_LEDGER,
      stories: profile.success
        ? profile.data.stories.map((s) => `${s.id} ${s.title}`)
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
