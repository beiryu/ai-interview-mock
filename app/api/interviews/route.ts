import { NextResponse } from "next/server"
import * as z from "zod"

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
      include: { _count: { select: { sessions: true } } },
    })

    return NextResponse.json(interviews)
  } catch (error) {
    return new NextResponse(null, { status: 500 })
  }
}
