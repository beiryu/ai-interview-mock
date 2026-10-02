import { NextResponse } from "next/server"

import { ProfilePrepSchema } from "@/lib/prep/schema"
import {
  getProfilePrep,
  saveProfilePrep,
  startProfilePrep,
} from "@/lib/prep/service"
import { getCurrentUser } from "@/lib/session"

/** GET: status + content · POST: (re)generate in the background · PUT: save edits */

export async function GET() {
  const user = await getCurrentUser()
  if (!user) return new NextResponse("Unauthorized", { status: 401 })
  return NextResponse.json(await getProfilePrep(user.id))
}

export async function POST() {
  const user = await getCurrentUser()
  if (!user) return new NextResponse("Unauthorized", { status: 401 })
  const result = await startProfilePrep(user.id)
  return NextResponse.json(result, { status: result.blocked ? 409 : 202 })
}

export async function PUT(req: Request) {
  const user = await getCurrentUser()
  if (!user) return new NextResponse("Unauthorized", { status: 401 })
  const parsed = ProfilePrepSchema.safeParse(await req.json())
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues }, { status: 422 })
  }
  await saveProfilePrep(user.id, parsed.data)
  return NextResponse.json(await getProfilePrep(user.id))
}
