import { NextResponse } from "next/server"

import { renderCvPdf } from "@/lib/cv/pdf"
import { EMPTY_CONTACT, pendingStretches } from "@/lib/cv/schema"
import { getCv } from "@/lib/cv/service"
import { getCurrentUser } from "@/lib/session"

interface Params {
  params: Promise<{ cvId: string }>
}

/**
 * GET: the CV as a PDF. Refused while stretches are unapproved — nothing
 * goes out that you haven't signed off. A practice persona downloads with a
 * "fictional, for practice" line on every page.
 */
export async function GET(_req: Request, props: Params) {
  const user = await getCurrentUser()
  if (!user) return new NextResponse("Unauthorized", { status: 401 })
  const { cvId } = await props.params

  let state
  try {
    state = await getCv(cvId, user.id)
  } catch {
    return new NextResponse("Not found", { status: 404 })
  }
  if (!state.content || !state.cv) {
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

  // A practice persona keeps its fictional contact (never your name or
  // email) and says on every page that it is fictional
  const practice = state.cv.origin === "GENERATED"
  // Fields left blank on your CV fall back to your account
  const contact = practice
    ? { ...EMPTY_CONTACT, ...state.content.contact }
    : {
        ...EMPTY_CONTACT,
        name: user.name || user.email,
        email: user.email,
        ...stripEmpty(state.content.contact),
      }

  const pdf = await renderCvPdf(state.content, contact, { practice })
  const fileName = `${contact.name || "Practice persona"} - ${
    state.cv.job?.company || state.cv.title
  } ${practice ? "practice CV" : "CV"}.pdf`.replace(/[^\p{L}\p{N} ._-]/gu, "")
  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(
        fileName
      )}`,
    },
  })
}

function stripEmpty<T extends Record<string, unknown>>(value: T) {
  return Object.fromEntries(
    Object.entries(value).filter(([, v]) => (Array.isArray(v) ? v.length : v))
  ) as Partial<T>
}
