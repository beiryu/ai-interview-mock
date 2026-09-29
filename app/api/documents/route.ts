import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"

import { db } from "@/lib/db"
import { DocumentType } from "@/lib/generated/prisma/enums"
import {
  addFileToVectorStore,
  getOrCreateVectorStore,
} from "@/lib/openai/vector-store-service"
import { getCurrentUser } from "@/lib/session"
import { CreateDocumentRequestSchema } from "@/lib/validations/document"

// Define request schema for document upload via form data
const DocumentUploadSchema = z.object({
  title: z.string().min(1, "Title is required"),
  type: z.nativeEnum(DocumentType),
})

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Check content-type to determine how to process the request
    const contentType = req.headers.get("content-type") || ""

    let title: string
    let type: DocumentType
    let textContent: string

    // Handle multipart form data (file upload)
    if (contentType.includes("multipart/form-data")) {
      const formData = await req.formData()
      title = formData.get("title") as string
      type = formData.get("type") as DocumentType
      const file = formData.get("file") as File

      if (!file) {
        return NextResponse.json({ error: "No file provided" }, { status: 400 })
      }

      DocumentUploadSchema.parse({ title, type })

      const buffer = Buffer.from(await file.arrayBuffer())
      textContent = buffer.toString("utf-8")
    } else {
      // Handle JSON request (direct content)
      const body = await req.json()
      const parsed = CreateDocumentRequestSchema.parse(body)
      title = parsed.title
      type = parsed.type
      textContent = parsed.content
    }

    // Create document record
    const document = await db.document.create({
      data: {
        userId: user.id,
        title,
        type,
        content: textContent,
      },
    })

    // Upload to OpenAI Files API and attach to user's vector store
    const vectorStoreId = await getOrCreateVectorStore(user.id)
    const openaiFileId = await addFileToVectorStore(
      textContent,
      title,
      document.id,
      vectorStoreId
    )

    // Store the OpenAI file ID on the document record
    await db.document.update({
      where: { id: document.id },
      data: { openaiFileId },
    })

    return NextResponse.json({
      success: true,
      documentId: document.id,
      message: "Document processed successfully",
    })
  } catch (error) {
    console.error("Error processing document:", error)

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid request data", details: error.issues },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}

export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const documents = await db.document.findMany({
      where: {
        userId: user.id,
      },
      orderBy: {
        updatedAt: "desc",
      },
    })

    return NextResponse.json(documents)
  } catch (error) {
    console.error("Error fetching documents:", error)
    return NextResponse.json(
      { error: "Failed to fetch documents" },
      { status: 500 }
    )
  }
}
