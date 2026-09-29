import { useQuery } from "@tanstack/react-query"

import type {
  ChatConversation,
  ChatMessage,
} from "@/lib/generated/prisma/client"

export type Conversation = ChatConversation & {
  messages: ChatMessage[]
  _count: {
    messages: number
  }
}

// For future conversation management
const getConversations = async (): Promise<Conversation[]> => {
  const response = await fetch("/api/chat/conversations")

  if (!response.ok) {
    throw new Error("Failed to fetch conversations")
  }

  return response.json()
}

export function useConversations() {
  return useQuery({
    queryKey: ["conversations"],
    queryFn: getConversations,
    refetchOnWindowFocus: true,
  })
}
