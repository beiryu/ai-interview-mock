import { headers } from "next/headers"
import { NextResponse } from "next/server"

import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { UpdateInterviewSessionRequestSchema } from "@/lib/validations/interview-session"

interface Params {
  params: Promise<{ id: string }>
}

export async function PUT(req: Request, props: Params) {
  const params = await props.params
  try {
    const session = await auth.api.getSession({ headers: await headers() })
    if (!session) {
      return new NextResponse("Unauthorized", { status: 403 })
    }

    const json = await req.json()
    const parsed = UpdateInterviewSessionRequestSchema.safeParse(json)
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.flatten() },
        { status: 400 }
      )
    }

    if (parsed.data.id !== params.id) {
      return new NextResponse("Session id mismatch", { status: 400 })
    }

    const existing = await db.interviewSession.findFirst({
      where: { id: params.id, userId: session.user.id },
    })
    if (!existing) {
      return new NextResponse("Not found", { status: 404 })
    }

    const updatedSession = await db.interviewSession.update({
      where: { id: params.id },
      data: { status: parsed.data.status },
    })

    return NextResponse.json(updatedSession)
  } catch (error) {
    return new NextResponse("Internal Error", { status: 500 })
  }
}
