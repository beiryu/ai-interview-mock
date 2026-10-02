import { NextResponse } from "next/server"

import { env } from "@/env.mjs"
import { getCurrentUser } from "@/lib/session"

/**
 * Issues a short-lived, single-use Soniox key for one browser WebSocket.
 * The permanent SONIOX_API_KEY never leaves the server.
 */
export async function POST() {
  const user = await getCurrentUser()
  if (!user) {
    return new Response("Unauthorized", { status: 401 })
  }

  if (!env.SONIOX_API_KEY) {
    return NextResponse.json(
      { error: "SONIOX_API_KEY is not configured on the server" },
      { status: 503 }
    )
  }

  const response = await fetch(
    "https://api.soniox.com/v1/auth/temporary-api-key",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.SONIOX_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        usage_type: "transcribe_websocket",
        expires_in_seconds: 60,
        single_use: true,
        client_reference_id: user.id,
      }),
    }
  )

  if (!response.ok) {
    console.error("Soniox temporary key error:", await response.text())
    return NextResponse.json(
      { error: "Could not create a transcription key" },
      { status: 502 }
    )
  }

  const { api_key } = (await response.json()) as { api_key: string }
  return NextResponse.json({ key: api_key })
}
