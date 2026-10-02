import { NextResponse } from "next/server"
import { z } from "zod"

import { handle } from "@/lib/api"
import { getJobCv, startJobCv } from "@/lib/cv/service"
import { getCurrentUser } from "@/lib/session"
import { CvSourceSchema } from "@/lib/validations/job"

interface Params {
  params: Promise<{ jobId: string }>
}

const StartSchema = z.object({ source: CvSourceSchema.optional() })

/**
 * GET: the job's CV with its status · POST: make it from a source, or
 * rebuild it from the one it has ({} body)
 */

async function context(props: Params) {
  const user = await getCurrentUser()
  if (!user) return null
  return { userId: user.id, jobId: (await props.params).jobId }
}

export async function GET(_req: Request, props: Params) {
  const ctx = await context(props)
  if (!ctx) return new NextResponse("Unauthorized", { status: 401 })
  return handle(async () =>
    NextResponse.json(await getJobCv(ctx.jobId, ctx.userId))
  )
}

export async function POST(req: Request, props: Params) {
  const ctx = await context(props)
  if (!ctx) return new NextResponse("Unauthorized", { status: 401 })
  const parsed = StartSchema.safeParse(await req.json().catch(() => ({})))
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid source" },
      { status: 422 }
    )
  }
  return handle(async () => {
    const result = await startJobCv(ctx.jobId, ctx.userId, parsed.data.source)
    return NextResponse.json(result, { status: 202 })
  })
}
