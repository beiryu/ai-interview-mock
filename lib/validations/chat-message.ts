import * as z from "zod"

export const RagChatRequestSchema = z.object({
  message: z.string().min(1, "Message is required"),
  selectedDocuments: z.array(z.string().min(1)).default([]),
  sessionId: z.string().optional(),
})

export type RagChatRequest = z.infer<typeof RagChatRequestSchema>
