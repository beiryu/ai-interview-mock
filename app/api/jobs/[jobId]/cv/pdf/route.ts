import { NextResponse } from "next/server"

import { renderCvPdf } from "@/lib/cv/pdf"
import { pendingStretches } from "@/lib/cv/schema"
import { getTailoredCv } from "@/lib/cv/service"
import { db } from "@/lib/db"
import { EMPTY_CONTACT, ProfilePrepSchema } from "@/lib/prep/schema"
import { getCurrentUser } from "@/lib/session"

interface Params {
  params: Promise<{ jobId: string }>
}

/**
 * GET: the tailored CV as a PDF. Refused while stretches are unapproved —
 * nothing goes to an employer that you haven't signed off.
 */
export async function GET(_req: Request, props: Params) {
  const user = await getCurrentUser()
  if (!user) return new NextResponse("Unauthorized", { status: 401 })
  const { jobId } = await props.params

  let state
  try {
    state = await getTailoredCv(jobId, user.id)
  } catch {
    return new NextResponse("Not found", { status: 404 })
  }
  if (!state.content) {
    return NextResponse.json({ error: "No CV yet" }, { status: 404 })
  }
  const pending = pendingStretches(state.content).length
  if (pending > 0) {
    return NextResponse.json(
      {
        error: `Approve or remove ${pending} stretch${
          pending > 1 ? "es" : ""
        } first`,
      },
      { status: 409 }
    )
  }

  const [prep, job] = await Promise.all([
    db.profilePrep.findUnique({
      where: { userId: user.id },
      select: { content: true },
    }),
    db.job.findFirst({
      where: { id: jobId, userId: user.id },
      select: { company: true },
    }),
  ])
  const saved = ProfilePrepSchema.safeParse(prep?.content)
  const contact = {
    ...EMPTY_CONTACT,
    name: user.name || user.email,
    email: user.email,
    ...(saved.success ? stripEmpty(saved.data.contact ?? {}) : {}),
  }

  const pdf = await renderCvPdf(state.content, contact)
  const fileName = `${contact.name} - ${job?.company || "CV"} CV.pdf`.replace(
    /[^\p{L}\p{N} ._-]/gu,
    ""
  )
  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(
        fileName
      )}`,
    },
  })
}

/** Contact fields you left blank fall back to your account. */
function stripEmpty<T extends Record<string, unknown>>(value: T) {
  return Object.fromEntries(
    Object.entries(value).filter(([, v]) => (Array.isArray(v) ? v.length : v))
  ) as Partial<T>
}
