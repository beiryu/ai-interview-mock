"use client"

import { useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { useChatDocumentStore } from "@/stores/chat-document-store"
import { Paperclip, Send, Square, X } from "lucide-react"

import { cn } from "@/lib/utils"
import { Source, useRagChatMessages } from "@/hooks/api/chat/useRagChatMessages"
import { useStreamingRagChat } from "@/hooks/api/chat/useStreamingRagChat"
import { useGetDocuments } from "@/hooks/api/document/useGetDocuments"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Textarea } from "@/components/ui/textarea"
import { ChatMessage } from "@/components/chat/chat-message"
import DocumentSelector from "@/components/chat/document-selector"

import { Icons } from "../icons"
import { toast } from "../ui/use-toast"

export default function StreamingChat() {
  const {
    selectedDocuments,
    deselectDocument,
    activeSessionId,
    setActiveSession,
  } = useChatDocumentStore()

  const { documents } = useGetDocuments()
  const selectedDocumentDetails =
    documents?.filter((doc) => selectedDocuments.includes(doc.id)) || []

  const scrollAreaRef = useRef<HTMLDivElement>(null)
  const [message, setMessage] = useState("")

  const router = useRouter()

  // Use the existing hook for fetching messages
  const {
    data: messages = [],
    isLoading: isLoadingMessages,
    refetch: refetchMessages,
  } = useRagChatMessages(activeSessionId)

  // Use the new streaming hook
  const {
    sendMessage: sendStreamingMessage,
    isStreaming,
    currentStreamContent,
    streamingMessageId,
    hasStartedStreaming,
    cancelStream,
  } = useStreamingRagChat({
    onChunkReceived: (chunk) => {
      // Auto-scroll on new chunk
      if (scrollAreaRef.current) {
        const scrollContainer = scrollAreaRef.current.querySelector(
          "[data-radix-scroll-area-viewport]"
        )
        if (scrollContainer) {
          scrollContainer.scrollTop = scrollContainer.scrollHeight
        }
      }
    },
    onComplete: (completedMessage) => {
      // Set the session ID if this is a new conversation
      if (!activeSessionId && completedMessage.conversationId) {
        setActiveSession(completedMessage.conversationId)
        router.push(`?sessionId=${completedMessage.conversationId}`)
      }
    },
    onError: (error) => {
      toast({
        title: "Streaming error",
        description: error,
        variant: "destructive",
      })
    },
  })

  // Combined loading state
  const isLoading = isLoadingMessages || isStreaming

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    if (scrollAreaRef.current) {
      const scrollContainer = scrollAreaRef.current.querySelector(
        "[data-radix-scroll-area-viewport]"
      )
      if (scrollContainer) {
        scrollContainer.scrollTop = scrollContainer.scrollHeight
      }
    }
  }, [messages, isStreaming, currentStreamContent])

  // Ensure messages are up-to-date when activeSessionId changes
  useEffect(() => {
    if (activeSessionId) {
      refetchMessages()
    }
  }, [activeSessionId, refetchMessages])

  const handleSendMessage = () => {
    if (!message.trim() || isLoading) return

    const trimmedMessage = message.trim()
    setMessage("")

    sendStreamingMessage({
      message: trimmedMessage,
      selectedDocuments,
      sessionId: activeSessionId,
    })
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSendMessage()
    }
  }

  const handleCancelStream = () => {
    cancelStream()
    toast({
      title: "Stream cancelled",
      description: "The AI response was cancelled.",
    })
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* Header — aligned with Transcription / Meeting room / AI Suggestions */}
      <div className="flex h-11 shrink-0 items-center justify-between border-b px-4">
        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Document chat
        </span>
        <span className="text-xs text-muted-foreground">
          {selectedDocuments.length === 0
            ? "No documents selected"
            : `${selectedDocuments.length} document${
                selectedDocuments.length !== 1 ? "s" : ""
              } selected`}
        </span>
      </div>

      {/* Conversation Area with ScrollArea */}
      <ScrollArea ref={scrollAreaRef} className="min-h-0 flex-1 p-4">
        <div className="mx-auto max-w-4xl w-full space-y-1">
          {messages.length === 0 && (
            <div className="flex h-64 flex-col items-center justify-center rounded-lg border border-dashed border-border/80 bg-muted/20 p-8 text-center">
              <p className="text-sm font-medium text-foreground">
                {selectedDocuments.length === 0
                  ? "Ask anything about your interview"
                  : "Ready when you are"}
              </p>
              <p className="mt-2 max-w-md text-xs text-muted-foreground">
                {selectedDocuments.length === 0
                  ? "Use the paperclip to attach documents for answers grounded in your files."
                  : `${selectedDocuments.length} document${
                      selectedDocuments.length > 1 ? "s are" : " is"
                    } attached. Ask questions to get AI-powered insights.`}
              </p>
            </div>
          )}

          {/* Display chat messages */}
          {messages.map((msg) =>
            msg.role === "user" ? (
              <ChatMessage key={msg.id} isUser={true}>
                <p>{msg.content}</p>
              </ChatMessage>
            ) : (
              <ChatMessage
                key={msg.id}
                isUser={false}
                content={msg.content}
                sources={msg.sources as unknown as Source[]}
              />
            )
          )}

          {/* Show streaming indicator with response when started */}
          {isStreaming && !hasStartedStreaming && (
            <div className="flex items-center justify-between py-2">
              <div className="flex items-center space-x-2">
                <Icons.spinner className="size-4 animate-spin" />
                <span className="text-sm text-muted-foreground">
                  AI is thinking...
                </span>
              </div>
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Chat Input */}
      <div className="shrink-0 border-t border-border p-4">
        <div className="mx-auto">
          {/* Selected Documents Context */}
          {selectedDocuments.length > 0 && (
            <div className="flex flex-wrap gap-1.5 pb-2">
              {selectedDocumentDetails.map((doc) => (
                <Badge
                  key={doc.id}
                  variant="outline"
                  className="flex h-6 items-center gap-1 bg-muted/50 py-0.5 pl-2 pr-1 text-xs"
                >
                  <span className="max-w-[120px] truncate">{doc.title}</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="size-4 p-0 ml-1 hover:bg-transparent hover:text-foreground rounded-full"
                    onClick={() => deselectDocument(doc.id)}
                  >
                    <X className="size-3" />
                    <span className="sr-only">Remove {doc.title}</span>
                  </Button>
                </Badge>
              ))}
            </div>
          )}

          <div className="relative rounded-lg border bg-background transition-colors focus-within:ring-1 focus-within:ring-ring">
            <Textarea
              className={cn(
                "w-full resize-none border-0 focus-visible:ring-0 focus-visible:ring-offset-0",
                "min-h-10 p-3"
              )}
              placeholder={
                selectedDocuments.length === 0
                  ? "Ask anything..."
                  : "Ask questions about your documents..."
              }
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={isLoading}
            />

            {/* Input Actions */}
            <div className="flex items-center justify-between gap-2 p-2 pt-0">
              <div className="flex items-center">
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="size-8 p-0 rounded-full text-muted-foreground"
                      title="Select documents"
                    >
                      <Paperclip className="size-4" />
                      <span className="sr-only">Select documents</span>
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent
                    side="top"
                    align="start"
                    className="w-72 p-0"
                    sideOffset={8}
                  >
                    <DocumentSelector />
                  </PopoverContent>
                </Popover>
              </div>
              <Button
                variant={isStreaming ? "destructive" : "default"}
                size="sm"
                className={cn("h-8 px-3", !message.trim() && "opacity-80")}
                onClick={isStreaming ? handleCancelStream : handleSendMessage}
              >
                {isStreaming ? (
                  <>
                    <Square className="size-3" />
                    Cancel
                  </>
                ) : (
                  <>
                    <Send className="size-4 mr-1.5" />
                    Send
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
