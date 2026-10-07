import { NextResponse } from "next/server"

import { db } from "@/lib/db"
import { getCurrentUser } from "@/lib/session"
import { UpdateInterviewSessionRequestSchema } from "@/lib/validations/interview-session"

interface Params {
  params: Promise<{ id: string }>
}

// GET: full detail of one session for the history view (lazy — images and
// chat are heavy, so they are not in the job's session list).
export async function GET(_req: Request, props: Params) {
  const { id } = await props.params
  try {
    const user = await getCurrentUser()
    if (!user) return new NextResponse("Unauthorized", { status: 401 })

    const session = await db.interviewSession.findFirst({
      where: { id, userId: user.id },
      select: {
        id: true,
        status: true,
        startedAt: true,
        endedAt: true,
        transcript: true,
        answers: true,
        screenshots: {
          orderBy: { createdAt: "asc" },
          select: {
            id: true,
            image: true,
            text: true,
            model: true,
            thread: true,
            createdAt: true,
          },
        },
        chat: {
          select: {
            messages: {
              orderBy: { createdAt: "asc" },
              select: { id: true, role: true, content: true },
            },
          },
        },
      },
    })
    if (!session) return new NextResponse("Not found", { status: 404 })

    const { chat, ...rest } = session
    return NextResponse.json({ ...rest, chat: chat?.messages ?? [] })
  } catch {
    return new NextResponse("Internal Error", { status: 500 })
  }
}

// PUT is used by the client; POST accepts the same body so the page can save
// via navigator.sendBeacon (which only sends POST) when the tab is closed.
async function update(req: Request, props: Params) {
  const { id } = await props.params
  try {
    const user = await getCurrentUser()
    if (!user) {
      return new NextResponse("Unauthorized", { status: 401 })
    }

    const parsed = UpdateInterviewSessionRequestSchema.safeParse(
      await req.json()
    )
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.flatten() },
        { status: 400 }
      )
    }

    const existing = await db.interviewSession.findFirst({
      where: { id, userId: user.id },
      select: { id: true },
    })
    if (!existing) {
      return new NextResponse("Not found", { status: 404 })
    }

    const { status, transcript, answers, endedAt } = parsed.data
    const updatedSession = await db.interviewSession.update({
      where: { id },
      data: {
        status,
        transcript,
        answers,
        endedAt: endedAt ? new Date(endedAt) : undefined,
      },
      select: { id: true, status: true, startedAt: true, endedAt: true },
    })

    return NextResponse.json(updatedSession)
  } catch (error) {
    return new NextResponse("Internal Error", { status: 500 })
  }
}

export { update as PUT, update as POST }
