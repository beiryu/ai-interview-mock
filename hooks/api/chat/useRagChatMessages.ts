import type { ChatMessage } from "@/lib/generated/prisma/client"
import { useQuery } from "@tanstack/react-query"

// Fetch messages for a conversation
const getSessionMessages = async (
  sessionId?: string
): Promise<ChatMessage[]> => {
  if (!sessionId) return []

  const response = await fetch(`/api/chat/conversations/${sessionId}/messages`)

  if (!response.ok) {
    throw new Error("Failed to fetch messages")
  }

  return response.json()
}

// Hook for fetching messages
export function useRagChatMessages(sessionId?: string) {
  return useQuery({
    queryKey: ["chatMessages", sessionId],
    queryFn: () => getSessionMessages(sessionId),
    enabled: !!sessionId,
    refetchOnWindowFocus: true,
    refetchOnMount: true,
    staleTime: 0, // Consider data always stale, so it refetches
  })
}

export interface OptimisticMessage extends ChatMessage {
  error?: boolean
}

export interface Source {
  documentId: string
  documentTitle: string
  // Legacy Pinecone fields (kept optional for backward compat)
  content?: string
  score?: number
  chunkId?: string
  // OpenAI file_search fields
  quote?: string
  fileId?: string
}
