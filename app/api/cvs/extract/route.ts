import { NextResponse } from "next/server"

import {
  MAX_UPLOAD_BYTES,
  UnsupportedFileError,
  extractDocumentText,
} from "@/lib/files/extract"
import { getCurrentUser } from "@/lib/session"

/**
 * POST multipart { file }: returns the file's text ({ title, content }) for
 * you to review before using it as a CV or a job description. Nothing is saved here.
 */
export async function POST(req: Request) {
  const user = await getCurrentUser()
  if (!user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const form = await req.formData().catch(() => null)
  const file = form?.get("file")
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 })
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return NextResponse.json(
      { error: "File is larger than 10 MB" },
      { status: 413 }
    )
  }

  try {
    const result = await extractDocumentText({
      name: file.name,
      bytes: new Uint8Array(await file.arrayBuffer()),
    })
    return NextResponse.json(result)
  } catch (error) {
    if (error instanceof UnsupportedFileError) {
      return NextResponse.json({ error: error.message }, { status: 415 })
    }
    console.error("Document extraction failed:", error)
    return NextResponse.json(
      { error: "Couldn't read this file — paste the text instead" },
      { status: 422 }
    )
  }
}
