import type { ModelMessage } from "ai"

import { fitContext, type Turn } from "./judge"
import { runStream } from "./run"

/**
 * The chat panel inside an interview: the candidate types a question
 * (often mid-interview) and gets a short answer grounded in the same brief
 * the coach uses plus the live transcript. Memory is the chat history the
 * client sends (persisted in Postgres), never provider-side state.
 */

const INSTRUCTIONS = `You are the candidate's private assistant during (or right before) a job interview. They type short questions while the interview runs, so answer fast and scannable: a direct answer first, then at most a few short bullets. No preamble.

You can: recall what the interviewer asked or said (from the LIVE TRANSCRIPT), suggest how to answer or rephrase, explain a concept quickly, suggest questions to ask back, and help with anything in the INTERVIEW BRIEF.

Truth rules: facts about the candidate (experience, projects, numbers, personal details) come only from the INTERVIEW BRIEF or what they said in the transcript. Never invent experience, numbers or personal details. When the brief lacks something, still give a complete answer the candidate can say right away — an honest angle or a short generic example marked "(ví dụ giả định)" — never blanks or "[fill in]" placeholders. Keep English suggestions in short, simple sentences.

Reply in the language the candidate writes in. Markdown is fine (short lists, code when useful).`

export function chatInstructions(brief: string) {
  return `${INSTRUCTIONS}

INTERVIEW BRIEF:
${brief || "(none — no role, notes or documents yet)"}`
}

/**
 * Puts the live transcript in front of the newest user message: it changes
 * on every message, so it must sit after the cached instructions.
 */
export function withTranscript(
  messages: ModelMessage[],
  transcript: Turn[],
  maxChars: number
): ModelMessage[] {
  const live = fitContext(transcript, maxChars)
  if (!live) return messages
  const last = messages.findLastIndex((m) => m.role === "user")
  if (last === -1) return messages
  const message = messages[last]
  const text =
    typeof message.content === "string"
      ? message.content
      : message.content
          .map((part) => (part.type === "text" ? part.text : ""))
          .join("")
  const next = [...messages]
  next[last] = {
    role: "user",
    content: `LIVE TRANSCRIPT (most recent last):\n${live}\n\nMY MESSAGE: ${text}`,
  }
  return next
}

export function streamChat({
  brief,
  messages,
  abortSignal,
}: {
  brief: string
  messages: ModelMessage[]
  abortSignal?: AbortSignal
}) {
  return runStream("chat", {
    instructions: chatInstructions(brief),
    messages,
    abortSignal,
  })
}
