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

    const { interviewId } = CreateInterviewSessionRequestSchema.parse(
      await req.json()
    )

    const interview = await db.interview.findFirst({
      where: { id: interviewId, userId: user.id },
    })
    if (!interview) {
      return new NextResponse("Not found", { status: 404 })
    }

    const interviewSession = await db.interviewSession.create({
      data: { interviewId, userId: user.id },
    })

    return NextResponse.json(interviewSession)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return new NextResponse(JSON.stringify(error.issues), { status: 422 })
    }

    return new NextResponse("Internal Error", { status: 500 })
  }
}
