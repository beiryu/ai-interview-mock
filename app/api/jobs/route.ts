import { NextResponse } from "next/server"
import * as z from "zod"

import { CvContentSchema, pendingStretches } from "@/lib/cv/schema"
import { startJobCv } from "@/lib/cv/service"
import { db } from "@/lib/db"
import { Prisma } from "@/lib/generated/prisma/client"
import { effectiveStatus } from "@/lib/generation"
import { extractJobInfo } from "@/lib/jobs/extract"
import { jobPrepHash } from "@/lib/prep/source"
import { getCurrentUser } from "@/lib/session"
import { CreateJobRequestSchema } from "@/lib/validations/job"

/**
 * POST: a new job from its description and where its CV comes from (upload,
 * one of your CVs, or a practice persona). Company and title are read from
 * the JD when you leave them blank; the CV starts right away, and your
 * personal answers start as those of your latest job.
 */
export async function POST(req: Request) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return new NextResponse("Unauthorized", { status: 401 })
    }

    const body = CreateJobRequestSchema.parse(await req.json())
    const info =
      body.company && body.title
        ? { company: body.company, title: body.title }
        : await extractJobInfo(body.jdText)

    const latest = await db.job.findFirst({
      where: { userId: user.id, answers: { not: Prisma.DbNull } },
      orderBy: { createdAt: "desc" },
      select: { answers: true },
    })

    const job = await db.job.create({
      data: {
        answers: latest?.answers ?? undefined,
        userId: user.id,
        jdText: body.jdText,
        sourceUrl: body.sourceUrl || null,
        company: body.company || info.company,
        title: body.title || info.title,
      },
    })

    await startJobCv(job.id, user.id, body.cv)

    return NextResponse.json(job)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return new NextResponse(JSON.stringify(error.issues), { status: 422 })
    }
    console.error("Create job failed:", error)
    return new NextResponse(null, { status: 500 })
  }
}

/** GET: your jobs, newest first, with sessions count, CV and prep status. */
export async function GET() {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return new NextResponse("Unauthorized", { status: 401 })
    }

    const jobs = await db.job.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      include: {
        _count: { select: { sessions: true } },
        cv: {
          select: {
            id: true,
            origin: true,
            status: true,
            content: true,
            updatedAt: true,
          },
        },
        prep: { select: { status: true, sourceHash: true, startedAt: true } },
      },
    })

    // The list only needs statuses: the CV's (and stretches waiting for
    // you), and the prep's — "stale" once the JD or the CV changed
    return NextResponse.json(
      jobs.map(({ cv, prep, ...job }) => {
        const content = cv && CvContentSchema.safeParse(cv.content)
        return {
          ...job,
          prep: prep ? effectiveStatus(prep, jobPrepHash(job, cv)) : "missing",
          cv: cv && {
            id: cv.id,
            origin: cv.origin,
            status: cv.status,
            pending: content?.success
              ? pendingStretches(content.data).length
              : 0,
          },
        }
      })
    )
  } catch (error) {
    return new NextResponse(null, { status: 500 })
  }
}
