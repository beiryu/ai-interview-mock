import { headers } from "next/headers"
import { NextResponse } from "next/server"
import * as z from "zod"

import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { UpdateInterviewRequestSchema } from "@/lib/validations/interview"

export async function GET(
  req: Request,
  props: { params: Promise<{ interviewId: string }> }
) {
  const params = await props.params
  try {
    const session = await auth.api.getSession({ headers: await headers() })

    if (!session) {
      return new NextResponse("Unauthorized", { status: 403 })
    }

    const interview = await db.interview.findUnique({
      where: {
        id: params.interviewId,
      },
      include: {
        sessions: true,
      },
    })

    return NextResponse.json(interview)
  } catch (error) {
    return new NextResponse(null, { status: 500 })
  }
}

export async function PATCH(
  req: Request,
  props: { params: Promise<{ interviewId: string }> }
) {
  const params = await props.params
  try {
    const session = await auth.api.getSession({ headers: await headers() })

    if (!session) {
      return new NextResponse("Unauthorized", { status: 403 })
    }

    const json = await req.json()
    const body = UpdateInterviewRequestSchema.parse(json)

    const interview = await db.interview.update({
      where: {
        id: params.interviewId,
      },
      data: {
        ...body,
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

export async function DELETE(
  req: Request,
  props: { params: Promise<{ interviewId: string }> }
) {
  const params = await props.params
  try {
    const session = await auth.api.getSession({ headers: await headers() })

    if (!session) {
      return new NextResponse("Unauthorized", { status: 403 })
    }

    await db.interview.delete({
      where: {
        id: params.interviewId,
      },
    })

    return new NextResponse(null, { status: 204 })
  } catch (error) {
    return new NextResponse(null, { status: 500 })
  }
}
