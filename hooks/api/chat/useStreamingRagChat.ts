import { useCallback, useRef, useState } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { v4 as uuidv4 } from "uuid"

import { RagChatRequest } from "@/lib/validations/chat-message"

import { OptimisticMessage } from "./useRagChatMessages"

export interface StreamingChunk {
  type: "content" | "complete" | "error"
  content?: string
  message?: any
  conversationId?: string
  error?: string
}

export interface UseStreamingChatOptions {
  onChunkReceived?: (chunk: string) => void
  onComplete?: (message: any) => void
  onError?: (error: string) => void
}

export function useStreamingRagChat(options?: UseStreamingChatOptions) {
  const [isStreaming, setIsStreaming] = useState(false)
  const [currentStreamContent, setCurrentStreamContent] = useState("")
  const [streamingMessageId, setStreamingMessageId] = useState<string | null>(
    null
  )
  const [hasStartedStreaming, setHasStartedStreaming] = useState(false)

  const abortControllerRef = useRef<AbortController | null>(null)
  const queryClient = useQueryClient()

  const sendStreamingMessage = useCallback(
    async (request: RagChatRequest) => {
      // Create temporary ID for optimistic UI
      const tempId = uuidv4()
      const streamingTempId = uuidv4()

      setStreamingMessageId(streamingTempId)
      setCurrentStreamContent("")
      setIsStreaming(true)
      setHasStartedStreaming(false)

      // Create abort controller for cancellation
      const abortController = new AbortController()
      abortControllerRef.current = abortController

      // Track if we've added the streaming message
      let streamingMessageAdded = false

      try {
        // Add optimistic user message immediately
        const optimisticUserMessage = {
          id: tempId,
          content: request.message,
          role: "user",
          createdAt: new Date(),
          conversationId: request.sessionId,
        }

        // Cancel any outgoing refetches
        await queryClient.cancelQueries({
          queryKey: ["chatMessages", request.sessionId],
        })

        // Update cache with only the user message initially
        queryClient.setQueryData(
          ["chatMessages", request.sessionId],
          (old: OptimisticMessage[] = []) => {
            return [...old, optimisticUserMessage]
          }
        )

        // Start streaming request
        const response = await fetch("/api/chat/rag/stream", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(request),
          signal: abortController.signal,
        })

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`)
        }

        if (!response.body) {
          throw new Error("No response body for streaming")
        }

        // Process streaming response
        const reader = response.body.getReader()
        const decoder = new TextDecoder()
        let accumulatedContent = ""

        while (true) {
          const { done, value } = await reader.read()

          if (done) {
            break
          }

          const chunk = decoder.decode(value, { stream: true })
          // Parse SSE data
          const lines = chunk.split("\n")
          for (const line of lines) {
            if (line.startsWith("data: ")) {
              try {
                const data: StreamingChunk = JSON.parse(line.slice(6))
                if (data.type === "content" && data.content) {
                  accumulatedContent += data.content
                  setCurrentStreamContent(accumulatedContent)

                  // Create the streaming message only when we receive the first content chunk
                  if (!streamingMessageAdded) {
                    streamingMessageAdded = true
                    setHasStartedStreaming(true)

                    // Add the assistant message to cache with the first content
                    queryClient.setQueryData(
                      ["chatMessages", request.sessionId],
                      (old: OptimisticMessage[] = []) => {
                        const optimisticStreamingMessage = {
                          id: streamingTempId,
                          content: accumulatedContent,
                          role: "assistant",
                          createdAt: new Date(),
                          conversationId: request.sessionId,
                          streaming: true,
                        }
                        return [...old, optimisticStreamingMessage]
                      }
                    )
                  } else {
                    // Update the existing streaming message with accumulated content
                    queryClient.setQueryData(
                      ["chatMessages", request.sessionId],
                      (old: OptimisticMessage[] = []) => {
                        return old.map((msg) => {
                          if (msg.id === streamingTempId) {
                            return { ...msg, content: accumulatedContent }
                          }
                          return msg
                        })
                      }
                    )
                  }

                  options?.onChunkReceived?.(data.content)
                }

                if (data.type === "complete" && data.message) {
                  // Replace streaming message with final message
                  queryClient.setQueryData(
                    ["chatMessages", request.sessionId],
                    (old: OptimisticMessage[] = []) => {
                      return old.map((msg) => {
                        if (msg.id === streamingTempId) {
                          return {
                            ...data.message,
                            streaming: false,
                          }
                        }
                        return msg
                      })
                    }
                  )

                  options?.onComplete?.(data.message)

                  // Return the final message for the mutation
                  return data.message
                }

                if (data.type === "error") {
                  throw new Error(data.error || "Streaming error occurred")
                }
              } catch (e) {
                console.error("Error parsing streaming chunk:", e)
              }
            }
          }
        }
      } catch (error) {
        console.error("Streaming error:", error)

        // Remove streaming message on error (only if it was created)
        if (streamingMessageAdded) {
          queryClient.setQueryData(
            ["chatMessages", request.sessionId],
            (old: OptimisticMessage[] = []) => {
              return old.filter((msg) => msg.id !== streamingTempId)
            }
          )
        }

        options?.onError?.(
          error instanceof Error ? error.message : "Unknown error"
        )
        throw error
      } finally {
        setIsStreaming(false)
        setCurrentStreamContent("")
        setStreamingMessageId(null)
        setHasStartedStreaming(false)
        abortControllerRef.current = null
      }
    },
    [queryClient, options]
  )

  const mutation = useMutation({
    mutationFn: sendStreamingMessage,
  })

  const cancelStream = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
      setIsStreaming(false)
      setCurrentStreamContent("")
      setStreamingMessageId(null)
      setHasStartedStreaming(false)
    }
  }, [])

  return {
    sendMessage: mutation.mutate,
    isStreaming,
    currentStreamContent,
    streamingMessageId,
    hasStartedStreaming,
    cancelStream,
    error: mutation.error,
    isLoading: mutation.isPending,
  }
}
