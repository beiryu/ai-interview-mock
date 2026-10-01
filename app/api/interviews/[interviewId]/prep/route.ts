import { NextResponse } from "next/server"

import { InterviewPrepSchema } from "@/lib/prep/schema"
import {
  getInterviewPrep,
  saveInterviewPrep,
  startInterviewPrep,
} from "@/lib/prep/service"
import { getCurrentUser } from "@/lib/session"

interface Params {
  params: Promise<{ interviewId: string }>
}

/** GET: status + content · POST: (re)generate in the background · PUT: save edits */

async function owned(props: Params) {
  const user = await getCurrentUser()
  if (!user) return null
  const { interviewId } = await props.params
  return { userId: user.id, interviewId }
}

function notFound(error: unknown) {
  return error instanceof Error && error.message === "Interview not found"
}

export async function GET(_req: Request, props: Params) {
  const ctx = await owned(props)
  if (!ctx) return new NextResponse("Unauthorized", { status: 401 })
  try {
    return NextResponse.json(
      await getInterviewPrep(ctx.interviewId, ctx.userId)
    )
  } catch (error) {
    if (notFound(error)) return new NextResponse("Not found", { status: 404 })
    throw error
  }
}

export async function POST(_req: Request, props: Params) {
  const ctx = await owned(props)
  if (!ctx) return new NextResponse("Unauthorized", { status: 401 })
  try {
    const started = await startInterviewPrep(ctx.interviewId, ctx.userId)
    return NextResponse.json({ started }, { status: 202 })
  } catch (error) {
    if (notFound(error)) return new NextResponse("Not found", { status: 404 })
    throw error
  }
}

export async function PUT(req: Request, props: Params) {
  const ctx = await owned(props)
  if (!ctx) return new NextResponse("Unauthorized", { status: 401 })
  const parsed = InterviewPrepSchema.safeParse(await req.json())
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues }, { status: 422 })
  }
  try {
    await saveInterviewPrep(ctx.interviewId, ctx.userId, parsed.data)
    return NextResponse.json(
      await getInterviewPrep(ctx.interviewId, ctx.userId)
    )
  } catch (error) {
    if (notFound(error)) return new NextResponse("Not found", { status: 404 })
    throw error
  }
}
