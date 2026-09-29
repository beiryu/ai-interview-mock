import { streamText } from "ai"

import { AI_DEFAULTS } from "@/config/defaults/ai"

import { languageModel, providerOptions } from "./models"

/**
 * The live answer coach: one streaming call, no tools, no memory. What it
 * knows comes from the interview brief (lib/interview/brief.ts) and the
 * recent transcript the client sends with each question.
 */

const INSTRUCTIONS = `You are an expert interview coach.
Given an interviewer's question and optionally a conversation history, help the candidate answer it live. They glance at your output mid-conversation, so the first lines must be useful on their own.

Output format (exactly):
- 3 key points, one per line, each starting with "- " and at most 8 words
- a line containing only ---
- 1-3 sentences the candidate can say verbatim: directly address the question, include a concrete example where relevant, and end cleanly

The answer must sound natural when spoken aloud — short sentences, no jargon, no buzzwords. If you would not say a word in normal conversation, do not use it. Aim for clear and direct, not impressive.

If CONVERSATION SO FAR is provided, use it to:
- Avoid suggesting points the candidate already mentioned
- Build naturally on what was already said
- Fill genuine gaps in the candidate's previous answers

Facts about the candidate (employers, projects, numbers, tech they used) come only from the INTERVIEW BRIEF below. Prefer a real example from it over a generic one, and tie it to the role when the brief has a job description.
Keep each fact with the project or employer the brief lists it under, and do not add duties, numbers or scale the brief does not state.
Anything in the brief counts as the candidate's experience, including a bare skills list: if a skill is only listed, say they have used it and keep the details general rather than inventing a project.
Never invent experience. When asked about a technology, company or task that appears nowhere in the brief, do not say they used it: say so honestly and bridge to the closest real experience in the brief (asked about Kafka, brief has RabbitMQ → "Not Kafka in production, but I ran RabbitMQ for…"). With no brief, keep examples general instead of making up employers or numbers.

Language: answer in the language of the question. QUESTION LANGUAGE gives the detected language ("vi" = Vietnamese, "en" = English); if it is missing, match the language the interviewer used. When answering in Vietnamese, the candidate calls themselves "em" (unless the interviewer uses another pronoun pair) and keeps English technical terms (framework names, "microservices", "deploy", …) as a Vietnamese engineer would say them.

No headings, labels, JSON or extra text beyond that format.`

export interface Turn {
  role: string
  content: string
}

/** Rules + brief. Same for a whole interview → a cacheable prefix. */
export function coachInstructions(brief: string) {
  return `${INSTRUCTIONS}

INTERVIEW BRIEF:
${brief || "(none — the candidate added no role, notes or documents)"}`
}

/** Per-question input; the new question goes last. */
export function buildCoachInput({
  context,
  language,
  text,
}: {
  context: Turn[]
  language: string | null
  text: string
}) {
  const contextBlock =
    context.length > 0
      ? "CONVERSATION SO FAR:\n" +
        context
          .map(
            (m) =>
              `${m.role === "interviewer" ? "INTERVIEWER" : "YOU SAID"}: ${
                m.content
              }`
          )
          .join("\n") +
        "\n\n"
      : ""
  const languageLine = language ? `QUESTION LANGUAGE: ${language}\n` : ""
  return `${contextBlock}${languageLine}NEW QUESTION FROM INTERVIEWER: ${text}`
}

export function streamCoachAnswer({
  brief,
  context,
  language,
  text,
  abortSignal,
  model = AI_DEFAULTS.coach.model,
}: {
  brief: string
  context: Turn[]
  language: string | null
  text: string
  abortSignal?: AbortSignal
  /** Override for evals ("provider:model") */
  model?: string
}) {
  return streamText({
    model: languageModel(model),
    instructions: coachInstructions(brief),
    prompt: buildCoachInput({ context, language, text }),
    maxOutputTokens: AI_DEFAULTS.coach.maxTokens,
    abortSignal,
    // Same key → same cache shard, so the brief prefix actually gets reused
    providerOptions: providerOptions(model, { cacheKey: "answer-coach" }),
    onError: ({ error }) => {
      if (!abortSignal?.aborted) console.error("Answer coach error:", error)
    },
  })
}
