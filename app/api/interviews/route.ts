import { headers } from "next/headers"
import { NextResponse } from "next/server"
import * as z from "zod"

import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { CreateInterviewRequestSchema } from "@/lib/validations/interview"

export async function POST(req: Request) {
  try {
    const session = await auth.api.getSession({ headers: await headers() })

    if (!session) {
      return new NextResponse("Unauthorized", { status: 403 })
    }

    const json = await req.json()
    const body = CreateInterviewRequestSchema.parse(json)

    const interview = await db.interview.create({
      data: {
        name: body.name,
        type: body.type,
        status: body.status,
        priority: body.priority,
        dueDate: body.dueDate,
        jobTitle: body.jobTitle,
        companyName: body.companyName,
        notes: body.notes,
        user: {
          connect: {
            id: session.user.id,
          },
        },
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
    const session = await auth.api.getSession({ headers: await headers() })

    if (!session) {
      return new NextResponse("Unauthorized", { status: 403 })
    }

    const interviews = await db.interview.findMany({
      include: {
        sessions: true,
      },
    })

    return NextResponse.json(interviews)
  } catch (error) {
    return new NextResponse(null, { status: 500 })
  }
}
