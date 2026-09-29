import { NextRequest } from "next/server"
import { z } from "zod"

import { OPENAI_DEFAULTS } from "@/config/defaults/openai"
import { saveChatInteraction } from "@/lib/chat/persistence"
import { db } from "@/lib/db"
import {
  FileSearchSource,
  streamDocumentChatWithoutFileSearch,
  streamWithFileSearch,
} from "@/lib/openai/file-search-stream"
import {
  getOrCreateVectorStore,
  getUserDocs,
} from "@/lib/openai/vector-store-service"
import { getCurrentUser } from "@/lib/session"
import { RagChatRequestSchema } from "@/lib/validations/chat-message"

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user?.id) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      })
    }

    const body = await req.json()
    const { message, selectedDocuments, sessionId } =
      RagChatRequestSchema.parse(body)

    // Create or retrieve the chat conversation
    let conversationId = sessionId

    if (!conversationId) {
      const conversationTitle =
        message.length > 100 ? `${message.substring(0, 100)}...` : message

      const conversation = await db.chatConversation.create({
        data: {
          userId: user.id,
          title: conversationTitle,
          documentIds: selectedDocuments || [],
        },
      })
      conversationId = conversation.id
    }

    const encoder = new TextEncoder()
    let fullResponse = ""
    let sources: FileSearchSource[] = []

    const hasDocSelection =
      Array.isArray(selectedDocuments) && selectedDocuments.length > 0

    let vectorStoreId = ""
    let userDocs: Awaited<ReturnType<typeof getUserDocs>> = []

    if (hasDocSelection) {
      ;[vectorStoreId, userDocs] = await Promise.all([
        getOrCreateVectorStore(user.id),
        getUserDocs(user.id, selectedDocuments),
      ])
    }

    const conversation = await db.chatConversation.findUnique({
      where: { id: conversationId },
      select: { previousResponseId: true },
    })
    const previousResponseId = conversation?.previousResponseId ?? null

    const fileIdToTitle = new Map(
      userDocs
        .filter((d) => d.openaiFileId)
        .map((d) => [d.openaiFileId!, { documentId: d.id, title: d.title }])
    )

    const stream = new ReadableStream({
      async start(controller) {
        try {
          // Send an immediate "thinking" signal so the UI can show a typing indicator
          // before the OpenAI file_search round-trip completes (~400-1500ms)
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({
                type: "thinking",
                conversationId,
              })}\n\n`
            )
          )

          // With selected docs: file_search on vector store; otherwise general chat (no RAG).
          let newResponseId: string | undefined
          const modelArgs = {
            model: OPENAI_DEFAULTS.chat.model,
            temperature: OPENAI_DEFAULTS.chat.temperature,
            maxOutputTokens: OPENAI_DEFAULTS.chat.maxTokens,
          }
          const streamIterator = hasDocSelection
            ? streamWithFileSearch(
                message,
                vectorStoreId,
                previousResponseId ?? undefined,
                selectedDocuments,
                fileIdToTitle,
                modelArgs
              )
            : streamDocumentChatWithoutFileSearch(
                message,
                previousResponseId ?? undefined,
                modelArgs
              )

          for await (const chunk of streamIterator) {
            if (chunk.responseId) {
              newResponseId = chunk.responseId
            }

            if (chunk.sources) {
              sources = chunk.sources
            }

            if (chunk.content) {
              fullResponse += chunk.content

              const data = JSON.stringify({
                type: "content",
                content: chunk.content,
                conversationId,
              })

              controller.enqueue(encoder.encode(`data: ${data}\n\n`))
            }
          }

          const finalData = JSON.stringify({
            type: "complete",
            message: {
              content: fullResponse,
              role: "assistant",
              conversationId,
              sources,
            },
          })

          // Store the response id before closing so the next turn can chain
          // off it; the message rows are written after the client is unblocked.
          if (newResponseId) {
            await db.chatConversation.update({
              where: { id: conversationId },
              data: { previousResponseId: newResponseId },
            })
          }

          controller.enqueue(encoder.encode(`data: ${finalData}\n\n`))
          controller.close()

          saveChatInteraction(conversationId!, message, fullResponse, sources)
        } catch (error) {
          console.error("Error in streaming:", error)
          const errorData = JSON.stringify({
            type: "error",
            error: "Failed to process chat request",
            message: error instanceof Error ? error.message : "Unknown error",
          })
          controller.enqueue(encoder.encode(`data: ${errorData}\n\n`))
          controller.close()
        }
      },
    })

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
        // Prevents nginx/CDN from buffering SSE chunks — critical for low TTFT
        "X-Accel-Buffering": "no",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
      },
    })
  } catch (error) {
    console.error("Error in RAG streaming endpoint:", error)

    if (error instanceof z.ZodError) {
      return new Response(
        JSON.stringify({
          error: "Invalid request data",
          details: error.issues,
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      )
    }

    return new Response(
      JSON.stringify({
        error: "Failed to process chat request",
        message: error instanceof Error ? error.message : "Unknown error",
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    )
  }
}
