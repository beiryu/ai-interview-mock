import { NextResponse } from "next/server"
import * as z from "zod"

import { db } from "@/lib/db"
import { getCurrentUser } from "@/lib/session"
import { CreateInterviewSessionRequestSchema } from "@/lib/validations/interview-session"

export async function POST(req: Request) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return new NextResponse("Unauthorized", { status: 401 })
    }

    const { jobId } = CreateInterviewSessionRequestSchema.parse(
      await req.json()
    )

    const job = await db.job.findFirst({
      where: { id: jobId, userId: user.id },
      select: { id: true },
    })
    if (!job) {
      return new NextResponse("Not found", { status: 404 })
    }

    const interviewSession = await db.interviewSession.create({
      data: { jobId, userId: user.id },
    })

    return NextResponse.json(interviewSession)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return new NextResponse(JSON.stringify(error.issues), { status: 422 })
    }

    return new NextResponse("Internal Error", { status: 500 })
  }
}
