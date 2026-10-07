import { NextResponse } from "next/server"

import { db } from "@/lib/db"
import { getCurrentUser } from "@/lib/session"
import { SaveScreenshotRequestSchema } from "@/lib/validations/interview-session"

interface Params {
  params: Promise<{ id: string }>
}

// Upsert one captured screenshot (its solution + Code Q&A thread) for a
// session. Called from the store on capture-done and on each thread turn.
// The image (heavy base64) is written once on create and left alone on
// later updates, so thread updates stay cheap.
export async function POST(req: Request, props: Params) {
  const { id: sessionId } = await props.params
  try {
    const user = await getCurrentUser()
    if (!user) return new NextResponse("Unauthorized", { status: 401 })

    const parsed = SaveScreenshotRequestSchema.safeParse(await req.json())
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.flatten() },
        { status: 400 }
      )
    }

    const session = await db.interviewSession.findFirst({
      where: { id: sessionId, userId: user.id },
      select: { id: true },
    })
    if (!session) return new NextResponse("Not found", { status: 404 })

    const { id, image, text, model, thread } = parsed.data
    await db.interviewScreenshot.upsert({
      where: { id },
      create: { id, sessionId, image, text, model: model ?? null, thread },
      update: { text, model: model ?? null, thread },
    })

    return new NextResponse(null, { status: 204 })
  } catch {
    return new NextResponse("Internal Error", { status: 500 })
  }
}
