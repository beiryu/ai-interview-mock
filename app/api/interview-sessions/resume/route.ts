import { NextResponse } from "next/server"

import { db } from "@/lib/db"
import { getCurrentUser } from "@/lib/session"

// Call-scoped sessions: resume only a recent in-progress run. One older than
// this is treated as a finished interview — auto-completed and NOT resumed,
// so reopening starts a fresh session. Tweak to taste.
const RESUME_WINDOW_MS = 6 * 60 * 60 * 1000 // 6 hours since last activity

// The in-progress session to resume for a job (the live page rehydrates from
// it). Returns null when there is none (or the last one is stale).
export async function GET(req: Request) {
  try {
    const user = await getCurrentUser()
    if (!user) return new NextResponse("Unauthorized", { status: 401 })

    const params = new URL(req.url).searchParams
    const jobId = params.get("jobId")
    const sessionId = params.get("session")
    if (!jobId) return new NextResponse("Missing jobId", { status: 400 })

    const session = await db.interviewSession.findFirst({
      // A chosen in-progress session (from history) or the job's latest
      where: sessionId
        ? { id: sessionId, userId: user.id, status: "in_progress" }
        : { jobId, userId: user.id, status: "in_progress" },
      orderBy: { startedAt: "desc" },
      select: {
        id: true,
        startedAt: true,
        updatedAt: true,
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
      },
    })

    if (!session) return NextResponse.json(null)

    // Auto-expiry applies only to the implicit "latest" resume. An explicit
    // pick from history (sessionId) is honored even if a bit stale.
    if (
      !sessionId &&
      Date.now() - session.updatedAt.getTime() > RESUME_WINDOW_MS
    ) {
      await db.interviewSession.update({
        where: { id: session.id },
        data: { status: "completed", endedAt: session.updatedAt },
      })
      return NextResponse.json(null)
    }

    const { updatedAt: _updatedAt, ...resumable } = session
    return NextResponse.json(resumable)
  } catch {
    return new NextResponse("Internal Error", { status: 500 })
  }
}
