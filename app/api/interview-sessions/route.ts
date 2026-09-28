import { headers } from "next/headers"
import { NextResponse } from "next/server"

import { auth } from "@/lib/auth"
import { db } from "@/lib/db"

export async function POST(req: Request) {
  try {
    const session = await auth.api.getSession({ headers: headers() })
    if (!session) {
      return new NextResponse("Unauthorized", { status: 403 })
    }

    const { interviewId } = await req.json()

    // Build sessionContext from interview metadata
    const interview = await db.interview.findUnique({
      where: { id: interviewId },
    })

    const parts: string[] = []
    if (interview?.jobTitle) parts.push(`Role: ${interview.jobTitle}`)
    if (interview?.companyName) parts.push(`Company: ${interview.companyName}`)
    if (interview?.type) parts.push(`Interview type: ${interview.type}`)
    const sessionContext = parts.length > 0 ? parts.join("\n") : undefined

    // Create new session
    const interviewSession = await db.interviewSession.create({
      data: {
        feedback: "",
        duration: 0,
        sessionContext,
        interview: {
          connect: {
            id: interviewId,
          },
        },
        user: {
          connect: {
            id: session.user.id,
          },
        },
      },
    })

    return NextResponse.json(interviewSession)
  } catch (error) {
    return new NextResponse("Internal Error", { status: 500 })
  }
}
