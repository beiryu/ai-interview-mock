import { NextRequest, NextResponse } from "next/server"

import { db } from "@/lib/db"
import { getCurrentUser } from "@/lib/session"
import { UpdateDocumentRequestSchema } from "@/lib/validations/document"

interface Params {
  params: Promise<{
    id: string
  }>
}

/**
 * GET /api/documents/[id]
 * Get a specific document
 */
export async function GET(req: NextRequest, props: Params) {
  const params = await props.params
  try {
    const user = await getCurrentUser()
    if (!user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const document = await db.document.findFirst({
      where: {
        id: params.id,
        userId: user.id,
      },
    })

    if (!document) {
      return new NextResponse("Document not found", { status: 404 })
    }

    return NextResponse.json(document)
  } catch (error) {
    console.error("Error fetching document:", error)
    return new NextResponse("Failed to fetch document", { status: 500 })
  }
}

/**
 * DELETE /api/documents/[id]
 * Delete a document
 */
export async function DELETE(req: NextRequest, props: Params) {
  const params = await props.params
  try {
    const user = await getCurrentUser()
    if (!user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const document = await db.document.findFirst({
      where: {
        id: params.id,
        userId: user.id,
      },
      select: { id: true },
    })

    if (!document) {
      return NextResponse.json({ error: "Document not found" }, { status: 404 })
    }

    await db.document.delete({
      where: { id: params.id },
    })

    return NextResponse.json({
      success: true,
      message: "Document deleted successfully",
    })
  } catch (error) {
    console.error("Error deleting document:", error)
    return NextResponse.json(
      { error: "Failed to delete document" },
      { status: 500 }
    )
  }
}

/**
 * PUT /api/documents/[id]
 * Update any of title, type and content (JSON)
 */
export async function PUT(req: NextRequest, props: Params) {
  const params = await props.params
  const user = await getCurrentUser()
  if (!user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const parsed = UpdateDocumentRequestSchema.safeParse(
    await req.json().catch(() => null)
  )
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid document" },
      { status: 400 }
    )
  }

  const { count } = await db.document.updateMany({
    where: { id: params.id, userId: user.id },
    data: parsed.data,
  })
  if (count === 0) {
    return NextResponse.json({ error: "Document not found" }, { status: 404 })
  }
  return NextResponse.json({ success: true })
}
