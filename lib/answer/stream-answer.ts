export interface StreamAnswerRequest {
  /** The server builds the coach's brief (CV, JD, notes) from it */
  interviewId: string
  text: string
  language: string | null
  context: { role: string; content: string }[]
}

export interface StreamAnswerHandlers {
  onDelta: (text: string) => void
  /** Stream finished; `model` is the model that actually answered */
  onDone?: (meta: { model: string | null }) => void
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
      else if (event.type === "done")
        handlers.onDone?.({ model: event.model ?? null })
    }
  }
}

export interface JudgeVerdict {
  isAsk: boolean
  complete: boolean
  /** Self-contained question to answer (merged / follow-up resolved) */
  question: string
  duplicate: boolean
  judgeMs: number
}

export type JudgeResult = JudgeVerdict | { unavailable: true; judgeMs: number }

/**
 * Asks the LLM judge whether the interviewer's latest words are a finished
 * question and what exactly to answer. Never throws: on any failure the
 * caller gets `{ unavailable: true }` and falls back to heuristics.
 */
export async function judgeTurn(
  request: {
    text: string
    context: { role: string; content: string }[]
    lastAnsweredQuestion: string | null
  },
  signal: AbortSignal
): Promise<JudgeResult> {
  const started = performance.now()
  const unavailable = () => ({
    unavailable: true as const,
    judgeMs: Math.round(performance.now() - started),
  })
  try {
    const response = await fetch("/api/assistant/judge", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(request),
      signal,
    })
    if (!response.ok) return unavailable()
    return (await response.json()) as JudgeResult
  } catch {
    return unavailable()
  }
}
