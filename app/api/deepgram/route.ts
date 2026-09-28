import { NextResponse } from "next/server"

import { env } from "@/env.mjs"
import { getCurrentUser } from "@/lib/session"

export async function GET() {
  const user = await getCurrentUser()
  if (!user) {
    return new Response("Unauthorized", { status: 401 })
  }

  return NextResponse.json({ key: env.DEEPGRAM_API_KEY })
}
