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

export const CreateDocumentRequestSchema = z.object({
  title: z
    .string()
    .min(1, "Title is required")
    .max(200, "Title must be less than 200 characters"),
  type: z.nativeEnum(DocumentType),
  content: z.string(),
})

export type CreateDocumentRequest = z.infer<typeof CreateDocumentRequestSchema>

export const UpdateDocumentRequestSchema = z.object({
  title: z.string().max(200).optional(),
  content: z.string().optional(),
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
    value: DocumentType.JOB_DESCRIPTION,
    label: "Job Description",
    description: "Target position details and requirements",
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
