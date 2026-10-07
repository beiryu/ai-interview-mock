import { runStream } from "./run"

/**
 * Reads a coding problem from a screenshot (LeetCode, HackerRank, a shared
 * editor…) and writes an approach plus a full solution. One streaming call,
 * vision model, no tools. The image is the only source — unlike the coach it
 * has no CV/prep brief, because these questions are self-contained.
 *
 * Known weakness (true of every tool like this): the model can misread the
 * problem or get the logic wrong, so the prompt makes it state assumptions
 * and complexity rather than sound falsely confident.
 */
const INSTRUCTIONS = `You read a screenshot of the candidate's screen during an interview and help with whatever is on it. First work out WHAT is on screen, then respond in the matching shape (Markdown):

- **Coding problem** (LeetCode/HackerRank/CoderPad or an editor with a prompt):
  1. **Problem** — one line naming what it asks.
  2. **Approach** — 2–4 short bullets: the idea, the data structure, the key insight.
  3. **Complexity** — time and space, e.g. \`O(n log n)\` time, \`O(n)\` space.
  4. A single fenced code block with a complete, runnable solution. Use the language shown on screen; if none, Python. Clear names, brief comments on tricky lines.
  5. **Edge cases** — one line of what to check (empty input, duplicates, overflow…).

- **Multiple choice** (options A/B/C/D, checkboxes, "select the correct…"): start with **Answer: <option>**, then 1–2 sentences why. If torn between options, name which and why you rule the others out.

- **Short / conceptual question** (not code, e.g. "What is a deadlock?"): answer correctly in a few sentences; add a tiny snippet only if it's the clearest way.

- **System design / open-ended**: 3–5 bullets — the approach and the key trade-offs.

- **Not a question** (an empty IDE, a form, a slide, a dashboard, instructions): one line saying what's on screen, then the next step(s) to take there. Do not fabricate an answer.

RULES:
- Correctness first. If something is ambiguous or cut off, state your assumption in one line — don't guess silently.
- If you're unsure, say which part you're unsure about. Never present a shaky answer as certain.
- Only use what's in the image; don't invent constraints or extra parts. If the image is unreadable, say so and stop.
- No preamble, no sign-off — start straight at the answer.`

export function streamScreenshotSolution({
  image,
  language,
  abortSignal,
  model,
}: {
  /** Screenshot as a data URL (e.g. "data:image/png;base64,…") */
  image: string
  /** Preferred spoken language for the prose ("vi", "en"); code stays code */
  language?: string | null
  abortSignal?: AbortSignal
  /** Gateway id overriding the configured model (evals) */
  model?: string
}) {
  const languageLine =
    language === "vi"
      ? "Write the prose (Problem, Approach, Complexity, Edge cases) in Vietnamese; keep code and technical terms in English."
      : "Write in English."
  return runStream("screenshot", {
    instructions: INSTRUCTIONS,
    messages: [
      {
        role: "user",
        content: [
          { type: "text", text: `Solve what is in this screenshot. ${languageLine}` },
          { type: "image", image },
        ],
      },
    ],
    abortSignal,
    model,
  })
}
