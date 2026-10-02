import { NextResponse } from "next/server"

import { TailoredCvSchema } from "@/lib/cv/schema"
import {
  getTailoredCv,
  saveTailoredCv,
  startTailoredCv,
} from "@/lib/cv/service"
import { getCurrentUser } from "@/lib/session"

interface Params {
  params: Promise<{ interviewId: string }>
}

/** GET: status + CV · POST: (re)generate in the background · PUT: save edits */

async function context(props: Params) {
  const user = await getCurrentUser()
  if (!user) return null
  return { userId: user.id, interviewId: (await props.params).interviewId }
}

function notFound(error: unknown) {
  return error instanceof Error && error.message === "Interview not found"
}

async function handle(run: () => Promise<Response>) {
  try {
    return await run()
  } catch (error) {
    if (notFound(error)) return new NextResponse("Not found", { status: 404 })
    throw error
  }
}

export async function GET(_req: Request, props: Params) {
  const ctx = await context(props)
  if (!ctx) return new NextResponse("Unauthorized", { status: 401 })
  return handle(async () =>
    NextResponse.json(await getTailoredCv(ctx.interviewId, ctx.userId))
  )
}

export async function POST(_req: Request, props: Params) {
  const ctx = await context(props)
  if (!ctx) return new NextResponse("Unauthorized", { status: 401 })
  return handle(async () => {
    const result = await startTailoredCv(ctx.interviewId, ctx.userId)
    return NextResponse.json(result, { status: result.blocked ? 409 : 202 })
  })
}

export async function PUT(req: Request, props: Params) {
  const ctx = await context(props)
  if (!ctx) return new NextResponse("Unauthorized", { status: 401 })
  const parsed = TailoredCvSchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues }, { status: 422 })
  }
  return handle(async () => {
    await saveTailoredCv(ctx.interviewId, ctx.userId, parsed.data)
    return NextResponse.json(await getTailoredCv(ctx.interviewId, ctx.userId))
  })
}
