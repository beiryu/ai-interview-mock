import { db } from "@/lib/db"

/**
 * Persist a user + assistant exchange for a RAG conversation.
 */
export async function saveChatInteraction(
  conversationId: string,
  input: string,
  output: string,
  sources: unknown[] = []
) {
  try {
    await db.$transaction([
      db.chatMessage.create({
        data: { conversationId, role: "user", content: input },
      }),
      db.chatMessage.create({
        data: {
          conversationId,
          role: "assistant",
          content: output,
          sources: sources as object[],
        },
      }),
      db.chatConversation.update({
        where: { id: conversationId },
        data: { updatedAt: new Date() },
      }),
    ])
  } catch (error) {
    console.error("Error saving chat interaction:", error)
  }
}
