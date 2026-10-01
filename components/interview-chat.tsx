"use client"

import * as React from "react"
import { useInterviewSessionStore } from "@/stores/interview-session.store"
import { useChat } from "@ai-sdk/react"
import { useQuery } from "@tanstack/react-query"
import { DefaultChatTransport, type UIMessage } from "ai"
import { ArrowUp, Square } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { MarkdownMessage } from "@/components/ui/markdown-message"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Textarea } from "@/components/ui/textarea"
import { Icons } from "@/components/icons"

// Turns of the live transcript sent with each message (trimmed server-side)
const TRANSCRIPT_TURNS = 40

const SUGGESTIONS = [
  "Họ vừa hỏi gì vậy?",
  "Gợi ý 2 câu hỏi ngược lại cho họ",
  "Tóm tắt những gì mình đã trả lời",
]

const textOf = (message: UIMessage) =>
  message.parts.map((part) => (part.type === "text" ? part.text : "")).join("")

/**
 * The interview's private chat: ask anything mid-interview. Answers use the
 * same prep/brief as the coach plus the live transcript; history is saved
 * per interview.
 */
export function InterviewChat({ interviewId }: { interviewId: string }) {
  const saved = useQuery({
    queryKey: ["interview-chat", interviewId],
    queryFn: async () => {
      const response = await fetch(`/api/interviews/${interviewId}/chat`)
      if (!response.ok) throw new Error("Failed to load chat")
      return (await response.json()) as { messages: UIMessage[] }
    },
    staleTime: Infinity,
  })

  if (saved.isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Icons.spinner className="size-5 animate-spin text-muted-foreground" />
      </div>
    )
  }
  return (
    <ChatPanel
      key={interviewId}
      interviewId={interviewId}
      initialMessages={saved.data?.messages ?? []}
    />
  )
}

function ChatPanel({
  interviewId,
  initialMessages,
}: {
  interviewId: string
  initialMessages: UIMessage[]
}) {
  const [input, setInput] = React.useState("")
  const { messages, sendMessage, status, stop, error } = useChat({
    id: `interview-${interviewId}`,
    messages: initialMessages,
    transport: new DefaultChatTransport({
      api: `/api/interviews/${interviewId}/chat`,
    }),
  })
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
      <div className="flex h-11 shrink-0 items-center border-b px-4">
        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Chat
        </span>
      </div>

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
                  : "mr-4"
              )}
            >
              {message.role === "user" ? (
                <p className="whitespace-pre-wrap">{textOf(message)}</p>
              ) : (
                <MarkdownMessage content={textOf(message)} />
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

      <form
        className="flex items-end gap-2 border-t p-3"
        onSubmit={(e) => {
          e.preventDefault()
          send(input)
        }}
      >
        <Textarea
          value={input}
          rows={1}
          placeholder="Ask… (Enter to send)"
          className="max-h-32 min-h-9 resize-none text-sm"
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (
              e.key === "Enter" &&
              !e.shiftKey &&
              !e.nativeEvent.isComposing
            ) {
              e.preventDefault()
              send(input)
            }
          }}
        />
        {busy ? (
          <Button
            type="button"
            size="icon"
            variant="outline"
            className="size-9 shrink-0"
            onClick={stop}
          >
            <Square className="size-3.5" />
          </Button>
        ) : (
          <Button
            type="submit"
            size="icon"
            className="size-9 shrink-0"
            disabled={!input.trim()}
          >
            <ArrowUp className="size-4" />
          </Button>
        )}
      </form>
    </div>
  )
}
