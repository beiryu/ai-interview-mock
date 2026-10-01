import { NextRequest, NextResponse } from "next/server"

import { db } from "@/lib/db"
import { getCurrentUser } from "@/lib/session"

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
 * Update a document's title and/or content
 */
export async function PUT(req: NextRequest, props: Params) {
  const params = await props.params
  try {
    const user = await getCurrentUser()
    if (!user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const existingDocument = await db.document.findFirst({
      where: {
        id: params.id,
        userId: user.id,
      },
    })

    if (!existingDocument) {
      return NextResponse.json({ error: "Document not found" }, { status: 404 })
    }

    const contentType = req.headers.get("content-type") || ""
    let newTitle: string = existingDocument.title
    let newContent: string = existingDocument.content

    if (contentType.includes("multipart/form-data")) {
      const formData = await req.formData()
      newTitle = (formData.get("title") as string) || existingDocument.title
      const file = formData.get("file") as File

      if (!file) {
        return NextResponse.json({ error: "No file provided" }, { status: 400 })
      }

      const buffer = Buffer.from(await file.arrayBuffer())
      newContent = buffer.toString("utf-8")
    } else {
      const body = await req.json()
      newTitle = body.title || existingDocument.title
      newContent = body.content || existingDocument.content
    }

    await db.document.update({
      where: { id: params.id },
      data: { title: newTitle, content: newContent },
    })

    return NextResponse.json({
      success: true,
      message: "Document updated successfully",
    })
  } catch (error) {
    console.error("Error updating document:", error)
    return NextResponse.json(
      { error: "Failed to update document" },
      { status: 500 }
    )
  }
}
