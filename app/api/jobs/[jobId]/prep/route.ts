import { NextResponse } from "next/server"

import { InterviewPrepSchema } from "@/lib/prep/schema"
import { getJobPrep, saveJobPrep, startJobPrep } from "@/lib/prep/service"
import { getCurrentUser } from "@/lib/session"

interface Params {
  params: Promise<{ jobId: string }>
}

/** GET: status + content · POST: (re)generate in the background · PUT: save edits */

async function owned(props: Params) {
  const user = await getCurrentUser()
  if (!user) return null
  const { jobId } = await props.params
  return { userId: user.id, jobId }
}

function notFound(error: unknown) {
  return error instanceof Error && error.message === "Job not found"
}

export async function GET(_req: Request, props: Params) {
  const ctx = await owned(props)
  if (!ctx) return new NextResponse("Unauthorized", { status: 401 })
  try {
    return NextResponse.json(await getJobPrep(ctx.jobId, ctx.userId))
  } catch (error) {
    if (notFound(error)) return new NextResponse("Not found", { status: 404 })
    throw error
  }
}

export async function POST(_req: Request, props: Params) {
  const ctx = await owned(props)
  if (!ctx) return new NextResponse("Unauthorized", { status: 401 })
  try {
    const result = await startJobPrep(ctx.jobId, ctx.userId)
    return NextResponse.json(result, { status: result.blocked ? 409 : 202 })
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
    await saveJobPrep(ctx.jobId, ctx.userId, parsed.data)
    return NextResponse.json(await getJobPrep(ctx.jobId, ctx.userId))
  } catch (error) {
    if (notFound(error)) return new NextResponse("Not found", { status: 404 })
    throw error
  }
}
