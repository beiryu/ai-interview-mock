import { NextResponse } from "next/server"
import * as z from "zod"

import { db } from "@/lib/db"
import { getCurrentUser } from "@/lib/session"
import { UpdateJobRequestSchema, toJobData } from "@/lib/validations/job"

interface Params {
  params: Promise<{ jobId: string }>
}

async function findOwnedJob(jobId: string, userId: string) {
  return db.job.findFirst({ where: { id: jobId, userId } })
}

export async function GET(req: Request, props: Params) {
  const { jobId } = await props.params
  try {
    const user = await getCurrentUser()
    if (!user) {
      return new NextResponse("Unauthorized", { status: 401 })
    }

    const job = await db.job.findFirst({
      where: { id: jobId, userId: user.id },
      include: {
        sessions: {
          orderBy: { startedAt: "desc" },
          select: {
            id: true,
            status: true,
            startedAt: true,
            endedAt: true,
            transcript: true,
            answers: true,
          },
        },
      },
    })

    if (!job) {
      return new NextResponse("Not found", { status: 404 })
    }

    return NextResponse.json(job)
  } catch (error) {
    return new NextResponse(null, { status: 500 })
  }
}

export async function PATCH(req: Request, props: Params) {
  const { jobId } = await props.params
  try {
    const user = await getCurrentUser()
    if (!user) {
      return new NextResponse("Unauthorized", { status: 401 })
    }

    const existing = await findOwnedJob(jobId, user.id)
    if (!existing) {
      return new NextResponse("Not found", { status: 404 })
    }

    const body = UpdateJobRequestSchema.parse(await req.json())
    const data = toJobData(body)
    // Scheduling an interview moves a job you haven't closed to interviewing
    if (
      data.scheduledAt &&
      !body.status &&
      (existing.status === "SAVED" || existing.status === "APPLIED")
    ) {
      data.status = "INTERVIEWING"
    }

    const job = await db.job.update({ where: { id: jobId }, data })

    return NextResponse.json(job)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return new NextResponse(JSON.stringify(error.issues), { status: 422 })
    }

    return new NextResponse(null, { status: 500 })
  }
}

export async function DELETE(req: Request, props: Params) {
  const { jobId } = await props.params
  try {
    const user = await getCurrentUser()
    if (!user) {
      return new NextResponse("Unauthorized", { status: 401 })
    }

    if (!(await findOwnedJob(jobId, user.id))) {
      return new NextResponse("Not found", { status: 404 })
    }

    await db.job.delete({ where: { id: jobId } })

    return new NextResponse(null, { status: 204 })
  } catch (error) {
    return new NextResponse(null, { status: 500 })
  }
}
