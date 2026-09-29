import type { AgentInputItem } from "@openai/agents"

export interface StreamAnswerRequest {
  text: string
  language: string | null
  agentHistory: AgentInputItem[]
  context: { role: string; content: string }[]
  sessionContext: string
  selectedDocuments: string[]
  fastMode: boolean
}

export interface StreamAnswerHandlers {
  onDelta: (text: string) => void
  onDone: (updatedHistory: AgentInputItem[]) => void
}

/**
 * Streams an AnswerCoach reply from /api/assistant/question (NDJSON).
 * Resolves when the stream ends; rejects on HTTP errors. Aborting `signal`
 * also cancels the model run on the server.
 */
export async function streamAnswer(
  request: StreamAnswerRequest,
  handlers: StreamAnswerHandlers,
  signal: AbortSignal
) {
  const response = await fetch("/api/assistant/question", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(request),
    signal,
  })

  if (!response.ok || !response.body) {
    throw new Error(
      response.status === 401
        ? "Signed out — reload the page"
        : `Answer failed (${response.status})`
    )
  }

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ""

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split("\n")
    buffer = lines.pop() ?? ""

    for (const line of lines) {
      if (!line.trim()) continue
      const event = JSON.parse(line)
      if (event.type === "delta") handlers.onDelta(event.text)
      else if (event.type === "done") handlers.onDone(event.updatedHistory)
    }
  }
}

/** Asks the classifier whether a committed interviewer turn is a question. */
export async function classifyQuestion(
  text: string,
  context: { role: string; content: string }[],
  signal: AbortSignal
): Promise<boolean> {
  try {
    const response = await fetch("/api/assistant/classify-question", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, context }),
      signal,
    })
    if (!response.ok) return true // fail open
    const { isQuestion } = (await response.json()) as { isQuestion?: boolean }
    return isQuestion !== false
  } catch {
    return true
  }
}
