import { NextResponse } from "next/server"
import { z } from "zod"

import { createUploadedCv, listCvs } from "@/lib/cv/service"
import { getCurrentUser } from "@/lib/session"

const UploadSchema = z.object({
  title: z.string().trim().min(1).max(120),
  rawText: z
    .string()
    .trim()
    .min(200, "This doesn't look like a whole CV")
    .max(100_000),
})

/** GET: all your CVs · POST: upload a CV (its text), parsed in the background */

export async function GET() {
  const user = await getCurrentUser()
  if (!user) return new NextResponse("Unauthorized", { status: 401 })
  return NextResponse.json(await listCvs(user.id))
}

export async function POST(req: Request) {
  const user = await getCurrentUser()
  if (!user) return new NextResponse("Unauthorized", { status: 401 })
  const parsed = UploadSchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid CV" },
      { status: 422 }
    )
  }
  const cv = await createUploadedCv(user.id, parsed.data)
  return NextResponse.json({ id: cv.id }, { status: 202 })
}
