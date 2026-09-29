import { ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

import { Conversation } from "@/hooks/api/chat/useChatMessages"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatChatSessionDate(d: Date) {
  const date = new Date(d)
  const now = new Date()

  // If it's today, just show the time
  if (date.toDateString() === now.toDateString()) {
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
  }

  // If it's this year, show month and day
  if (date.getFullYear() === now.getFullYear()) {
    return date.toLocaleDateString([], { month: "short", day: "numeric" })
  }

  // Otherwise show full date
  return date.toLocaleDateString([], {
    month: "short",
    day: "numeric",
    year: "numeric",
  })
}

export function formatChatSessionTitle(session: Conversation) {
  // Always use the conversation title from the database
  // This will be the first message that started the conversation
  if (session.title) {
    return session.title.length > 20
      ? `${session.title.substring(0, 20)}...`
      : session.title
  }

  return "New Conversation"
}
