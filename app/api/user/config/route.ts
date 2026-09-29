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
      turnPace: null,
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

  // Partial update: only fields present in the request change
  const data = parsed.data
  const fields = ["turnPace"] as const
  const configFields: Record<string, unknown> = {
    schemaVersion: data.schemaVersion ?? CURRENT_SCHEMA_VERSION,
  }
  for (const field of fields) {
    if (field in body) configFields[field] = data[field] ?? null
  }

  const updated = await db.userConfig.upsert({
    where: { userId: session.user.id },
    create: { userId: session.user.id, ...configFields },
    update: configFields,
    select: {
      schemaVersion: true,
      turnPace: true,
    },
  })

  return NextResponse.json(updated)
}
