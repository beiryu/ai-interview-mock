import { z } from "zod"

import { DocumentType } from "@/lib/generated/prisma/enums"

export const DocumentSchema = z.object({
  id: z.string(),
  userId: z.string(),
  title: z.string(),
  type: z.nativeEnum(DocumentType),
  content: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
})

export type Document = z.infer<typeof DocumentSchema>

// A CV is ~25k characters; anything this long is likely a mistake
export const MAX_DOCUMENT_CHARS = 200_000

const title = z
  .string()
  .trim()
  .min(1, "Title is required")
  .max(200, "Title must be less than 200 characters")
const content = z
  .string()
  .trim()
  .min(1, "Content is required")
  .max(MAX_DOCUMENT_CHARS, "Document is too long (max 200,000 characters)")

export const CreateDocumentRequestSchema = z.object({
  title,
  type: z.nativeEnum(DocumentType),
  content,
})

export type CreateDocumentRequest = z.infer<typeof CreateDocumentRequestSchema>

export const UpdateDocumentRequestSchema = z.object({
  title: title.optional(),
  type: z.nativeEnum(DocumentType).optional(),
  content: content.optional(),
})

export type UpdateDocumentRequest = z.infer<typeof UpdateDocumentRequestSchema>

/** Document types offered in the upload/edit forms, with display text. */
export const DOCUMENT_TYPE_OPTIONS = [
  {
    value: DocumentType.RESUME,
    label: "Resume",
    description: "Your professional background and experience",
  },
  {
    value: DocumentType.PORTFOLIO,
    label: "Portfolio",
    description: "Projects, accomplishments, and work samples",
  },
  {
    value: DocumentType.PROJECT_DOCUMENTATION,
    label: "Project Docs",
    description: "Architecture, READMEs and write-ups of your projects",
  },
  {
    value: DocumentType.COVER_LETTER,
    label: "Cover Letter",
    description: "Personalized cover letter for specific roles",
  },
  {
    value: DocumentType.NOTES,
    label: "Notes",
    description: "Custom talking points and personal insights",
  },
] as const
