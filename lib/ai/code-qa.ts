import { runStream } from "./run"

/**
 * Answers a question about the code on a captured screenshot — the
 * conversational follow-up to a screenshot solution (lib/ai/screenshot.ts).
 * The interviewer (or the candidate) asks something about the code shown;
 * this grounds the answer in the image + the solution + the prior Q&A, so
 * "why the extra array here?" is answered about the actual code, not in the
 * abstract. One streaming vision call, stateless; reuses the `screenshot`
 * task's model.
 */
const INSTRUCTIONS = `You help a candidate in a live interview answer a follow-up question about what is on their screen. You are given the screenshot (a coding problem and code, a multiple-choice question, a diagram, whatever it is), the answer worked out so far, the earlier Q&A, and a new question — usually the interviewer probing it ("why the extra array?", "why not option B?", "what's the complexity?").

Answer the NEW QUESTION, grounded in what is actually in the image and the prior answer:
- Point to the real things on screen (lines, variables, options, parts of the diagram); don't answer in the abstract.
- Be short and sayable — 2–5 sentences, the way the candidate would say it out loud. Add a tiny code snippet only if it's the clearest answer.
- Use real notation where it fits (e.g. complexity \`O(n)\`).
- If the image is unclear or the question refers to something not shown, say what's missing in one line instead of guessing.
- No preamble, no sign-off.`

export interface CodeQaTurn {
  question: string
  answer: string
}

export function streamCodeAnswer({
  image,
  solution,
  history,
  question,
  language,
  abortSignal,
  model,
}: {
  /** The captured screenshot as a data URL */
  image: string
  /** The solution worked out so far (markdown) */
  solution: string
  /** Earlier Q&A about this same screenshot, oldest first */
  history: CodeQaTurn[]
  question: string
  /** Preferred spoken language for prose ("vi", "en"); code stays code */
  language?: string | null
  abortSignal?: AbortSignal
  model?: string
}) {
  const languageLine =
    language === "vi"
      ? "Answer in Vietnamese; keep code and technical terms in English."
      : "Answer in English."
  const historyBlock = history.length
    ? "EARLIER Q&A:\n" +
      history.map((t) => `Q: ${t.question}\nA: ${t.answer}`).join("\n\n") +
      "\n\n"
    : ""
  const text = `SOLUTION SO FAR:\n${solution || "(none yet)"}\n\n${historyBlock}NEW QUESTION: ${question}\n\n${languageLine}`

  return runStream("screenshot", {
    instructions: INSTRUCTIONS,
    messages: [
      {
        role: "user",
        content: [
          { type: "text", text },
          { type: "image", image },
        ],
      },
    ],
    abortSignal,
    model,
  })
}
