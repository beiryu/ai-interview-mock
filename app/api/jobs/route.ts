import { NextResponse } from "next/server"
import * as z from "zod"

import { TailoredCvSchema, pendingStretches } from "@/lib/cv/schema"
import { startTailoredCv } from "@/lib/cv/service"
import { db } from "@/lib/db"
import { extractJobInfo } from "@/lib/jobs/extract"
import { getCurrentUser } from "@/lib/session"
import { CreateJobRequestSchema } from "@/lib/validations/job"

/**
 * POST: a new job from its description. Company and title are read from the
 * JD when you leave them blank, and the tailored CV starts right away.
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

    const job = await db.job.create({
      data: {
        userId: user.id,
        jdText: body.jdText,
        sourceUrl: body.sourceUrl || null,
        company: body.company || info.company,
        title: body.title || info.title,
      },
    })

    // Blocked (no documents yet) is fine: the CV page says what's missing
    await startTailoredCv(job.id, user.id)

    return NextResponse.json(job)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return new NextResponse(JSON.stringify(error.issues), { status: 422 })
    }
    console.error("Create job failed:", error)
    return new NextResponse(null, { status: 500 })
  }
}

/** GET: your jobs, newest first, with sessions count and CV status. */
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
        cv: { select: { status: true, content: true } },
      },
    })

    // The list only needs the CV's status and how many stretches wait for you
    return NextResponse.json(
      jobs.map(({ cv, ...job }) => {
        const content = cv && TailoredCvSchema.safeParse(cv.content)
        return {
          ...job,
          cv: cv && {
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
