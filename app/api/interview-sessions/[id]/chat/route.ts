import { NextResponse } from "next/server"
import { convertToModelMessages, type UIMessage } from "ai"
import { z } from "zod"

import {
  CHAT_HISTORY_MESSAGES,
  CHAT_TRANSCRIPT_CHARS,
} from "@/config/defaults/ai"
import { streamChat, withTranscript } from "@/lib/ai/chat"
import { db } from "@/lib/db"
import { loadCoachContext } from "@/lib/interview/load-brief"
import { getCurrentUser } from "@/lib/session"

interface Params {
  params: Promise<{ id: string }>
}

const RequestSchema = z.object({
  messages: z.array(z.custom<UIMessage>()).min(1),
  /** Recent live transcript, oldest first */
  transcript: z
    .array(z.object({ role: z.string(), content: z.string() }))
    .default([]),
})

const textOf = (message: UIMessage) =>
  message.parts.map((part) => (part.type === "text" ? part.text : "")).join("")

/** Resolve the session (owned by the user) to its id + jobId. */
async function ownedSession(props: Params) {
  const user = await getCurrentUser()
  if (!user) return null
  const { id } = await props.params
  const session = await db.interviewSession.findFirst({
    where: { id, userId: user.id },
    select: { id: true, jobId: true },
  })
  return session
    ? { userId: user.id, sessionId: session.id, jobId: session.jobId }
    : undefined
}

/** GET: this session's saved chat, as UI messages. */
export async function GET(_req: Request, props: Params) {
  const ctx = await ownedSession(props)
  if (ctx === null) return new NextResponse("Unauthorized", { status: 401 })
  if (!ctx) return new NextResponse("Not found", { status: 404 })

  const conversation = await db.chatConversation.findUnique({
    where: { sessionId: ctx.sessionId },
    select: {
      messages: {
        orderBy: { createdAt: "asc" },
        select: { id: true, role: true, content: true },
      },
    },
  })
  const messages: UIMessage[] = (conversation?.messages ?? [])
    .filter((m) => m.role !== "system")
    .map((m) => ({
      id: m.id,
      role: m.role as "user" | "assistant",
      parts: [{ type: "text", text: m.content }],
    }))
  return NextResponse.json({ messages })
}

/** POST: answer the newest message (AI SDK UI message stream). */
export async function POST(req: Request, props: Params) {
  const ctx = await ownedSession(props)
  if (ctx === null) return new NextResponse("Unauthorized", { status: 401 })
  if (!ctx) return new NextResponse("Not found", { status: 404 })

  const parsed = RequestSchema.safeParse(await req.json())
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues }, { status: 422 })
  }
  const { messages, transcript } = parsed.data
  const latest = messages.at(-1)!

  const conversation = await db.chatConversation.upsert({
    where: { sessionId: ctx.sessionId },
    create: {
      userId: ctx.userId,
      sessionId: ctx.sessionId,
      jobId: ctx.jobId,
    },
    update: {},
    select: { id: true },
  })
  if (latest.role === "user" && textOf(latest).trim()) {
    await db.chatMessage.create({
      data: {
        conversationId: conversation.id,
        role: "user",
        content: textOf(latest),
      },
    })
  }

  const { brief } = await loadCoachContext(ctx.jobId, ctx.userId)
  const history = await convertToModelMessages(
    messages.slice(-CHAT_HISTORY_MESSAGES)
  )
  const result = streamChat({
    brief,
    messages: withTranscript(history, transcript, CHAT_TRANSCRIPT_CHARS),
    abortSignal: req.signal,
  })

  return result.toUIMessageStreamResponse({
    originalMessages: messages,
    onFinish: async ({ messages: all, isAborted }) => {
      const reply = all.at(-1)
      if (isAborted || reply?.role !== "assistant" || !textOf(reply).trim())
        return
      await db.chatMessage.create({
        data: {
          conversationId: conversation.id,
          role: "assistant",
          content: textOf(reply),
        },
      })
    },
  })
}
