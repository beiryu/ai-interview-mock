// Every LLM call goes through the Vercel AI Gateway (one key, one bill).
// Models are gateway ids "provider/model"; switching a task's model is a
// change here. DeepSeek by default; another model only when `pnpm ai:eval`
// shows DeepSeek failing a task (latency, JSON, quality).

export interface AiTask {
  model: string
  /** Gateway tries these, in order, when the primary model errors */
  fallback?: string[]
  maxTokens: number
  temperature?: number
  /** Whole-call deadline (non-streaming tasks) */
  timeoutMs?: number
  /** Prompt-cache routing key for a stable prefix (OpenAI-style providers) */
  cacheKey?: string
}

export const AI_TASKS = {
  // Live: is the interviewer done, and what exactly did they ask? On any
  // failure the turn engine falls back to its own heuristics.
  judge: {
    model: "deepseek/deepseek-v4.1-flash",
    maxTokens: 160,
    temperature: 0,
    timeoutMs: 2500,
  },
  // Live: 3 key points + 1–3 spoken sentences; the cap bounds tail latency
  coach: {
    model: "deepseek/deepseek-v4.1-flash",
    fallback: ["openai/gpt-4.1-mini"],
    maxTokens: 260,
    cacheKey: "answer-coach",
  },
  // Scores answers in `pnpm ai:eval`; must be another model family than
  // the ones it grades (self-preference bias)
  grader: {
    model: "openai/gpt-5.5",
    maxTokens: 800,
    temperature: 0,
    timeoutMs: 60_000,
  },
} as const satisfies Record<string, AiTask>

export type AiTaskName = keyof typeof AI_TASKS

// Rolling transcript sent to the judge (smaller input = faster)
export const JUDGE_CONTEXT_CHARS = 1500

// Interview brief (CV, JD, notes) in the coach's instructions; ~8k tokens
export const BRIEF_MAX_CHARS = 32_000

// Document Chat (OpenAI SDK + hosted vector store) until it is replaced by
// the in-interview chat
export const DOCUMENT_CHAT = {
  model: "gpt-4.1-mini",
  temperature: 0.2,
  maxTokens: 2000,
}
