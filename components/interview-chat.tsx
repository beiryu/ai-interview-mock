"use client"

import * as React from "react"
import { useInterviewSessionStore } from "@/stores/interview-session.store"
import { Chat, useChat } from "@ai-sdk/react"
import { useQuery } from "@tanstack/react-query"
import { DefaultChatTransport, type UIMessage } from "ai"
import { ArrowUp, Square } from "lucide-react"

import { cn } from "@/lib/utils"
import { MarkdownMessage } from "@/components/ui/markdown-message"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Icons } from "@/components/icons"

// Turns of the live transcript sent with each message (trimmed server-side)
const TRANSCRIPT_TURNS = 40

const SUGGESTIONS = [
  "Họ vừa hỏi gì vậy?",
  "Gợi ý 2 câu hỏi ngược lại cho họ",
  "Tóm tắt những gì mình đã trả lời",
]

// One chat per session for the page's lifetime, shared by every panel that
// shows it (the playground and the desktop overlay), so both see the same
// thread
const chats = new Map<string, Chat<UIMessage>>()

function getChat(sessionId: string, initialMessages: UIMessage[]) {
  let chat = chats.get(sessionId)
  if (!chat) {
    chat = new Chat({
      id: `session-${sessionId}`,
      messages: initialMessages,
      transport: new DefaultChatTransport({
        api: `/api/interview-sessions/${sessionId}/chat`,
      }),
    })
    chats.set(sessionId, chat)
  }
  return chat
}

const textOf = (message: UIMessage) =>
  message.parts.map((part) => (part.type === "text" ? part.text : "")).join("")

/**
 * The interview's private chat: ask anything mid-interview. Answers use the
 * same prep/brief as the coach plus the live transcript; history is saved
 * per session (needs an active session — press Start first).
 */
export function InterviewChat({
  bare = false,
}: {
  /** Without the "Chat" header (the desktop overlay has its own toolbar) */
  bare?: boolean
}) {
  const sessionId = useInterviewSessionStore((s) => s.currentSessionId)

  const saved = useQuery({
    queryKey: ["session-chat", sessionId],
    enabled: !!sessionId,
    queryFn: async () => {
      const response = await fetch(`/api/interview-sessions/${sessionId}/chat`)
      if (!response.ok) throw new Error("Failed to load chat")
      return (await response.json()) as { messages: UIMessage[] }
    },
    staleTime: Infinity,
  })

  if (!sessionId) {
    return (
      <div className="flex h-full items-center justify-center p-6 text-center text-sm text-muted-foreground">
        Start the session to chat.
      </div>
    )
  }
  if (saved.isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Icons.spinner className="size-5 animate-spin text-muted-foreground" />
      </div>
    )
  }
  return (
    <ChatPanel
      key={sessionId}
      sessionId={sessionId}
      initialMessages={saved.data?.messages ?? []}
      bare={bare}
    />
  )
}

function ChatPanel({
  sessionId,
  initialMessages,
  bare,
}: {
  sessionId: string
  initialMessages: UIMessage[]
  bare: boolean
}) {
  const [input, setInput] = React.useState("")
  const [chat] = React.useState(() => getChat(sessionId, initialMessages))
  const { messages, sendMessage, status, stop, error } = useChat({ chat })
  const busy = status === "submitted" || status === "streaming"

  const bottom = React.useRef<HTMLDivElement>(null)
  React.useEffect(() => {
    bottom.current?.scrollIntoView({ block: "end" })
  }, [messages])

  const send = (text: string) => {
    if (!text.trim() || busy) return
    const transcript = useInterviewSessionStore
      .getState()
      .messages.slice(-TRANSCRIPT_TURNS)
      .map((m) => ({ role: m.role, content: m.content }))
    void sendMessage({ text: text.trim() }, { body: { transcript } })
    setInput("")
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      {!bare && (
        <div className="flex h-11 shrink-0 items-center border-b px-4">
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Chat
          </span>
        </div>
      )}

      <ScrollArea className="min-h-0 flex-1">
        <div className="space-y-3 p-4">
          {messages.length === 0 && (
            <div className="space-y-2 text-sm text-muted-foreground">
              <p>
                Ask anything during the interview — it sees your prep and the
                live transcript.
              </p>
              <div className="flex flex-wrap gap-1.5">
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    className="rounded-full border px-2.5 py-1 text-xs hover:bg-accent"
                    onClick={() => send(s)}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}
          {messages.map((message) => (
            <div
              key={message.id}
              className={cn(
                "text-sm",
                message.role === "user"
                  ? "ml-8 rounded-lg bg-primary px-3 py-2 text-primary-foreground"
                  : "mr-4",
                // Overlay: the chat container already provides the 50% tint,
                // so the user bubble is the only extra layer (and goes /50);
                // the AI reply stays unboxed on top of it
                bare && message.role === "user" && "bg-primary/50"
              )}
            >
              {message.role === "user" ? (
                <p className="whitespace-pre-wrap">{textOf(message)}</p>
              ) : (
                <MarkdownMessage
                  content={textOf(message)}
                  className={cn(bare && "border-0 bg-transparent p-0 shadow-none")}
                />
              )}
            </div>
          ))}
          {status === "submitted" && (
            <Icons.spinner className="size-4 animate-spin text-muted-foreground" />
          )}
          {error && (
            <p className="text-xs text-destructive">
              Something went wrong — try again.
            </p>
          )}
          <div ref={bottom} />
        </div>
      </ScrollArea>

      {/* One line: the send button sits inside the field */}
      <form
        className={cn("shrink-0", bare ? "p-1.5" : "border-t p-3")}
        onSubmit={(e) => {
          e.preventDefault()
          send(input)
        }}
      >
        <div
          className={cn(
            "flex h-9 items-center gap-1 rounded-md border pl-3 pr-1 focus-within:ring-1 focus-within:ring-ring",
            // See-through in the desktop overlay
            bare ? "bg-background/50" : "bg-background/90"
          )}
        >
          <input
            value={input}
            placeholder="Ask anything…"
            // The overlay opens the chat to type in it (⌘⇧C)
            autoFocus={bare}
            className="h-full min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            onChange={(e) => setInput(e.target.value)}
          />
          {busy ? (
            <button
              type="button"
              title="Stop"
              className="flex size-7 shrink-0 items-center justify-center rounded-sm bg-muted text-foreground hover:bg-accent"
              onClick={stop}
            >
              <Square className="size-3" />
            </button>
          ) : (
            <button
              type="submit"
              title="Send (Enter)"
              className="flex size-7 shrink-0 items-center justify-center rounded-sm bg-primary text-primary-foreground transition-opacity hover:bg-primary/90 disabled:opacity-40"
              disabled={!input.trim()}
            >
              <ArrowUp className="size-3.5" />
            </button>
          )}
        </div>
      </form>
    </div>
  )
}
