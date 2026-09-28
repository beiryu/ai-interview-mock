import { DocumentType } from "@/lib/generated/prisma/enums"
import { z } from "zod"

export const DocumentSchema = z.object({
  id: z.string(),
  userId: z.string(),
  title: z.string(),
  type: z.nativeEnum(DocumentType),
  content: z.string(),
  metadata: z.record(z.string(), z.any()).optional(),
  fileUrl: z.string().optional(),
  openaiFileId: z.string().optional().nullable(),
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
  metadata: z.record(z.string(), z.any()).optional(),
})

export type CreateDocumentRequest = z.infer<typeof CreateDocumentRequestSchema>

export const UpdateDocumentRequestSchema = z.object({
  title: z.string().max(200).optional(),
  content: z.string().optional(),
  metadata: z.record(z.string(), z.any()).optional(),
})

export type UpdateDocumentRequest = z.infer<typeof UpdateDocumentRequestSchema>
