/** Streams the screenshot solution from /api/assistant/screenshot (NDJSON). */
export async function streamScreenshot(
  request: { image: string; language: string | null },
  handlers: {
    onDelta: (text: string) => void
    onDone?: (model: string | null) => void
  },
  signal: AbortSignal
) {
  const response = await fetch("/api/assistant/screenshot", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(request),
    signal,
  })
  if (!response.ok || !response.body) {
    throw new Error(
      response.status === 401
        ? "Signed out — reload the page"
        : `Screenshot failed (${response.status})`
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
    for (const raw of lines) {
      if (!raw.trim()) continue
      const event = JSON.parse(raw)
      if (event.type === "delta") handlers.onDelta(event.text)
      else if (event.type === "done") handlers.onDone?.(event.model ?? null)
      else if (event.type === "error") throw new Error(event.message)
    }
  }
}

/** Streams a code-Q&A answer from /api/assistant/code-qa (NDJSON). */
export async function streamCodeQa(
  request: {
    image: string
    solution: string
    history: { question: string; answer: string }[]
    question: string
    language: string | null
  },
  handlers: {
    onDelta: (text: string) => void
    onDone?: (model: string | null) => void
  },
  signal: AbortSignal
) {
  const response = await fetch("/api/assistant/code-qa", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(request),
    signal,
  })
  if (!response.ok || !response.body) {
    throw new Error(
      response.status === 401
        ? "Signed out — reload the page"
        : `Code answer failed (${response.status})`
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
    for (const raw of lines) {
      if (!raw.trim()) continue
      const event = JSON.parse(raw)
      if (event.type === "delta") handlers.onDelta(event.text)
      else if (event.type === "done") handlers.onDone?.(event.model ?? null)
      else if (event.type === "error") throw new Error(event.message)
    }
  }
}
