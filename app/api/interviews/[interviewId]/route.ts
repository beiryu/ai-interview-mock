import { NextResponse } from "next/server"
import * as z from "zod"

import { db } from "@/lib/db"
import { getCurrentUser } from "@/lib/session"
import {
  UpdateInterviewRequestSchema,
  toInterviewData,
} from "@/lib/validations/interview"

interface Params {
  params: Promise<{ interviewId: string }>
}

async function findOwnedInterview(interviewId: string, userId: string) {
  return db.interview.findFirst({ where: { id: interviewId, userId } })
}

export async function GET(req: Request, props: Params) {
  const { interviewId } = await props.params
  try {
    const user = await getCurrentUser()
    if (!user) {
      return new NextResponse("Unauthorized", { status: 401 })
    }

    const interview = await db.interview.findFirst({
      where: { id: interviewId, userId: user.id },
      include: {
        sessions: {
          orderBy: { startedAt: "desc" },
          select: {
            id: true,
            status: true,
            startedAt: true,
            endedAt: true,
            transcript: true,
          },
        },
      },
    })

    if (!interview) {
      return new NextResponse("Not found", { status: 404 })
    }

    return NextResponse.json(interview)
  } catch (error) {
    return new NextResponse(null, { status: 500 })
  }
}

export async function PATCH(req: Request, props: Params) {
  const { interviewId } = await props.params
  try {
    const user = await getCurrentUser()
    if (!user) {
      return new NextResponse("Unauthorized", { status: 401 })
    }

    if (!(await findOwnedInterview(interviewId, user.id))) {
      return new NextResponse("Not found", { status: 404 })
    }

    const body = UpdateInterviewRequestSchema.parse(await req.json())

    const interview = await db.interview.update({
      where: { id: interviewId },
      data: toInterviewData(body),
    })

    return NextResponse.json(interview)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return new NextResponse(JSON.stringify(error.issues), { status: 422 })
    }

    return new NextResponse(null, { status: 500 })
  }
}

export async function DELETE(req: Request, props: Params) {
  const { interviewId } = await props.params
  try {
    const user = await getCurrentUser()
    if (!user) {
      return new NextResponse("Unauthorized", { status: 401 })
    }

    if (!(await findOwnedInterview(interviewId, user.id))) {
      return new NextResponse("Not found", { status: 404 })
    }

    await db.interview.delete({ where: { id: interviewId } })

    return new NextResponse(null, { status: 204 })
  } catch (error) {
    return new NextResponse(null, { status: 500 })
  }
}
