import mammoth from "mammoth"
import { extractText } from "unpdf"

/**
 * Turns an uploaded file into plain text for a document (CV, JD, notes).
 * Runs on the server; the user reviews the text before it is saved.
 */

export const EXTRACTABLE = [".pdf", ".docx", ".txt", ".md"] as const
export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024

export class UnsupportedFileError extends Error {
  constructor() {
    super("Upload a PDF, DOCX, TXT or MD file")
  }
}

export function extensionOf(name: string) {
  const dot = name.lastIndexOf(".")
  return dot === -1 ? "" : name.slice(dot).toLowerCase()
}

/** "Nguyen_CV-2026.pdf" → "Nguyen CV-2026" */
export function titleFromFileName(name: string) {
  const ext = extensionOf(name)
  const base = ext ? name.slice(0, -ext.length) : name
  return base.replace(/[_]+/g, " ").replace(/\s+/g, " ").trim() || "Untitled"
}

/** CRLF → LF, no trailing spaces, at most one blank line in a row. */
export function normalizeText(text: string) {
  return text
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t ]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
}

export async function extractDocumentText({
  name,
  bytes,
}: {
  name: string
  bytes: Uint8Array
}) {
  const ext = extensionOf(name)
  let text: string
  switch (ext) {
    case ".pdf": {
      // unpdf transfers the buffer to its worker, so give it a copy
      const { text: merged } = await extractText(new Uint8Array(bytes), {
        mergePages: true,
      })
      text = merged
      break
    }
    case ".docx": {
      const { value } = await mammoth.extractRawText({
        buffer: Buffer.from(bytes),
      })
      text = value
      break
    }
    case ".txt":
    case ".md":
      text = new TextDecoder("utf-8").decode(bytes)
      break
    default:
      throw new UnsupportedFileError()
  }
  return { title: titleFromFileName(name), content: normalizeText(text) }
}
