import type { Metadata } from "next"
import { redirect } from "next/navigation"

import { getCurrentUser } from "@/lib/session"
import { Card } from "@/components/ui/card"
import { ChatWithDocuments } from "@/components/chat/chat-with-documents"
import { DashboardHeader } from "@/components/header"
import { DashboardShell } from "@/components/shell"

export const metadata: Metadata = {
  title: "Document Chat",
  description: "Chat with your uploaded documents using RAG.",
}

export default async function DocumentChatPage() {
  const user = await getCurrentUser()

  if (!user) {
    redirect("/login")
  }

  return (
    <DashboardShell>
      <DashboardHeader
        heading="Document Chat"
        text="Ask questions grounded in your resume, JDs and notes."
      />
      <Card className="h-[calc(100vh-12rem)] overflow-hidden bg-background p-0">
        <ChatWithDocuments />
      </Card>
    </DashboardShell>
  )
}
