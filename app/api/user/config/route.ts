import { headers } from "next/headers"
import { NextResponse } from "next/server"

import {
  CURRENT_SCHEMA_VERSION,
  UserConfigSchema,
} from "@/config/schemas/user-config.schema"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"

export async function GET() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user?.id) {
    return new Response("Unauthorized", { status: 401 })
  }

  const row = await db.userConfig.findUnique({
    where: { userId: session.user.id },
  })

  // First-time user: return null fields with current schema version
  if (!row) {
    return NextResponse.json({
      schemaVersion: CURRENT_SCHEMA_VERSION,
      chatModel: null,
      chatTemperature: null,
      deepgramModel: null,
      deepgramLanguage: null,
      silenceThresholdMs: null,
      utteranceEndMs: null,
      deepgramEndpointing: null,
    })
  }

  return NextResponse.json(row)
}

export async function PUT(req: Request) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user?.id) {
    return new Response("Unauthorized", { status: 401 })
  }

  const body = await req.json()
  const parsed = UserConfigSchema.safeParse(body)

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid config", issues: parsed.error.issues },
      { status: 400 }
    )
  }

  const data = parsed.data
  const configFields = {
    schemaVersion: data.schemaVersion ?? CURRENT_SCHEMA_VERSION,
    chatModel: data.chatModel ?? null,
    chatTemperature: data.chatTemperature ?? null,
    deepgramModel: data.deepgramModel ?? null,
    deepgramLanguage: data.deepgramLanguage ?? null,
    silenceThresholdMs: data.silenceThresholdMs ?? null,
    utteranceEndMs: data.utteranceEndMs ?? null,
    deepgramEndpointing: data.deepgramEndpointing ?? null,
  }

  const updated = await db.userConfig.upsert({
    where: { userId: session.user.id },
    create: { userId: session.user.id, ...configFields },
    update: configFields,
    select: {
      schemaVersion: true,
      chatModel: true,
      chatTemperature: true,
      deepgramModel: true,
      deepgramLanguage: true,
      silenceThresholdMs: true,
      utteranceEndMs: true,
      deepgramEndpointing: true,
    },
  })

  return NextResponse.json(updated)
}
