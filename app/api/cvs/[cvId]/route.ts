import { NextResponse } from "next/server"
import { z } from "zod"

import { handle } from "@/lib/api"
import { CvContentSchema } from "@/lib/cv/schema"
import {
  deleteCv,
  getCv,
  saveCv,
  startJobCv,
  startParse,
} from "@/lib/cv/service"
import { db } from "@/lib/db"
import { getCurrentUser } from "@/lib/session"

interface Params {
  params: Promise<{ cvId: string }>
}

const SaveSchema = z.object({
  content: CvContentSchema,
  title: z.string().trim().max(120).optional(),
})

/**
 * GET: the CV with its status · PUT: save your edits · POST: rebuild it
 * (re-read an uploaded CV, or remake a job's CV from its source) ·
 * DELETE: remove it
 */

async function context(props: Params) {
  const user = await getCurrentUser()
  if (!user) return null
  return { userId: user.id, cvId: (await props.params).cvId }
}

export async function GET(_req: Request, props: Params) {
  const ctx = await context(props)
  if (!ctx) return new NextResponse("Unauthorized", { status: 401 })
  return handle(async () =>
    NextResponse.json(await getCv(ctx.cvId, ctx.userId))
  )
}

export async function PUT(req: Request, props: Params) {
  const ctx = await context(props)
  if (!ctx) return new NextResponse("Unauthorized", { status: 401 })
  const parsed = SaveSchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues }, { status: 422 })
  }
  return handle(async () => {
    await saveCv(ctx.cvId, ctx.userId, parsed.data.content, parsed.data.title)
    return NextResponse.json(await getCv(ctx.cvId, ctx.userId))
  })
}

export async function POST(_req: Request, props: Params) {
  const ctx = await context(props)
  if (!ctx) return new NextResponse("Unauthorized", { status: 401 })
  return handle(async () => {
    const cv = await db.cv.findFirst({
      where: { id: ctx.cvId, userId: ctx.userId },
      select: { origin: true, jobId: true },
    })
    if (!cv) throw new Error("CV not found")
    const result =
      cv.origin === "UPLOADED"
        ? await startParse(ctx.cvId, ctx.userId)
        : await startJobCv(cv.jobId!, ctx.userId)
    return NextResponse.json(result, { status: 202 })
  })
}

export async function DELETE(_req: Request, props: Params) {
  const ctx = await context(props)
  if (!ctx) return new NextResponse("Unauthorized", { status: 401 })
  return handle(async () => {
    await deleteCv(ctx.cvId, ctx.userId)
    return new NextResponse(null, { status: 204 })
  })
}
