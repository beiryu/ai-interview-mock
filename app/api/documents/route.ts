import { NextResponse } from "next/server"

import { db } from "@/lib/db"
import { getCurrentUser } from "@/lib/session"
import { CreateDocumentRequestSchema } from "@/lib/validations/document"

/** POST: save a document (JSON; files are turned into text by /extract first). */
export async function POST(req: Request) {
  const user = await getCurrentUser()
  if (!user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const parsed = CreateDocumentRequestSchema.safeParse(
    await req.json().catch(() => null)
  )
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid document" },
      { status: 400 }
    )
  }

  const document = await db.document.create({
    data: { userId: user.id, ...parsed.data },
  })
  return NextResponse.json({ documentId: document.id }, { status: 201 })
}

/** GET: the user's documents, most recently updated first. */
export async function GET() {
  const user = await getCurrentUser()
  if (!user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const documents = await db.document.findMany({
    where: { userId: user.id },
    orderBy: { updatedAt: "desc" },
  })
  return NextResponse.json(documents)
}
