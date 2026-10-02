import { NextResponse } from "next/server"
import * as z from "zod"

import { TailoredCvSchema, pendingStretches } from "@/lib/cv/schema"
import { db } from "@/lib/db"
import { getCurrentUser } from "@/lib/session"
import {
  CreateInterviewRequestSchema,
  toInterviewData,
} from "@/lib/validations/interview"

export async function POST(req: Request) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return new NextResponse("Unauthorized", { status: 401 })
    }

    const body = CreateInterviewRequestSchema.parse(await req.json())

    const interview = await db.interview.create({
      data: {
        ...toInterviewData(body),
        name: body.name,
        userId: user.id,
      },
    })

    return NextResponse.json(interview)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return new NextResponse(JSON.stringify(error.issues), { status: 422 })
    }

    return new NextResponse(null, { status: 500 })
  }
}

export async function GET() {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return new NextResponse("Unauthorized", { status: 401 })
    }

    const interviews = await db.interview.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      include: {
        _count: { select: { sessions: true } },
        cv: { select: { status: true, content: true } },
      },
    })

    // The list only needs the CV's status and how many stretches wait for you
    return NextResponse.json(
      interviews.map(({ cv, ...interview }) => {
        const content = cv && TailoredCvSchema.safeParse(cv.content)
        return {
          ...interview,
          cv: cv && {
            status: cv.status,
            pending: content?.success
              ? pendingStretches(content.data).length
              : 0,
          },
        }
      })
    )
  } catch (error) {
    return new NextResponse(null, { status: 500 })
  }
}
