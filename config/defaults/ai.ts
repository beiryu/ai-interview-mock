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
  /**
   * Model "thinking". DeepSeek thinks by default and spends the whole
   * output budget on it, so live tasks must say "none".
   */
  reasoning?: "none" | "low" | "medium" | "high" | "provider-default"
  /**
   * Gateway providers to try first, in order. A model like DeepSeek is
   * served by many hosts; rotating between them misses the prompt cache
   * (cached 0 / 512 / 8192 tokens on the same brief), pinning keeps it warm.
   */
  providers?: string[]
}

// Hosts for DeepSeek V4.1 Flash, fastest first in our runs; the gateway
// falls back to others if both fail
const DEEPSEEK_FLASH_PROVIDERS = ["baseten", "fireworks"]

export const AI_TASKS = {
  // Live: is the interviewer done, and what exactly did they ask? On any
  // failure the turn engine falls back to its own heuristics.
  judge: {
    providers: DEEPSEEK_FLASH_PROVIDERS,
    reasoning: "none",
    model: "deepseek/deepseek-v4.1-flash",
    maxTokens: 160,
    temperature: 0,
    timeoutMs: 2500,
  },
  // New job: company and title read from the pasted JD (you can fix them)
  jobInfo: {
    providers: DEEPSEEK_FLASH_PROVIDERS,
    reasoning: "none",
    model: "deepseek/deepseek-v4.1-flash",
    maxTokens: 120,
    temperature: 0,
    timeoutMs: 8000,
  },
  // Live: 3 key points + 1–3 spoken sentences; the cap bounds tail latency
  coach: {
    // Pro over Flash (same 6 real-CV questions): honest about "Spring, not
    // Spring Boot", no rule text leaking into answers, better salary
    // answer; first token p50 1.69 s vs 1.56 s, a few cents more per
    // interview thanks to the cached brief
    reasoning: "none",
    model: "deepseek/deepseek-v4-pro",
    fallback: ["openai/gpt-4.1-mini"],
    maxTokens: 260,
    cacheKey: "answer-coach",
  },
  // Live: the chat panel in the interview (you type; latency-tolerant)
  chat: {
    reasoning: "none",
    model: "deepseek/deepseek-v4-pro",
    fallback: ["openai/gpt-4.1-mini"],
    maxTokens: 1200,
    temperature: 0.3,
    cacheKey: "interview-chat",
  },
  // Background, after each answered question: updates the session ledger
  ledger: {
    providers: DEEPSEEK_FLASH_PROVIDERS,
    reasoning: "none",
    model: "deepseek/deepseek-v4.1-flash",
    maxTokens: 400,
    temperature: 0,
    timeoutMs: 15_000,
  },
  // Before the interview: digests documents into the prep pack (facts,
  // STAR stories, JD mapping). Quality over speed; runs in the background.
  prep: {
    // Thinking on, DeepSeek V4 Pro spent all 8000 tokens reasoning and
    // returned nothing (67 s); off, a CV extracts cleanly in ~20 s
    reasoning: "none",
    model: "deepseek/deepseek-v4-pro",
    maxTokens: 12_000,
    temperature: 0.2,
    timeoutMs: 180_000,
  },

  // Scores answers in `pnpm ai:eval`; must be another model family than
  // the ones it grades (self-preference bias)
  grader: {
    reasoning: "low",
    model: "openai/gpt-5.5",
    maxTokens: 800,
    temperature: 0,
    timeoutMs: 60_000,
  },
} as const satisfies Record<string, AiTask>

export type AiTaskName = keyof typeof AI_TASKS

// Rolling transcript sent to the judge (smaller input = faster)
export const JUDGE_CONTEXT_CHARS = 1500

// Transcript and chat history sent with each chat message
export const CHAT_TRANSCRIPT_CHARS = 6000
export const CHAT_HISTORY_MESSAGES = 20

// Interview brief (CV, JD, notes) in the coach's instructions; ~8k tokens
export const BRIEF_MAX_CHARS = 32_000

// Documents given to the prep model (it can read much more than the coach)
export const PREP_MAX_DOC_CHARS = 60_000
