export const OPENAI_DEFAULTS = {
  chat: {
    model: "gpt-4.1-mini",
    temperature: 0.2,
    maxTokens: 2000,
  },
  // Decides whether the interviewer asked something and what exactly.
  // gpt-4.1-mini over nano: same flags on the eval set, but it resolves
  // follow-ups ("Why?" → "Why did you choose Go?"); ~80 ms slower.
  judge: {
    model: "gpt-4.1-mini",
    maxTokens: 160,
    timeoutMs: 2500,
    // Rolling transcript sent with each call (smaller input = faster)
    maxContextChars: 1500,
  },
  agent: {
    answerCoachModel: "gpt-4.1-mini",
    // 3 key points + 1–3 spoken sentences; a cap keeps tail latency bounded
    maxTokens: 260,
    // Interview brief (CV, JD, notes) in the instructions; ~8k tokens max
    maxBriefChars: 32_000,
  },
} as const

export type OpenAIDefaults = typeof OPENAI_DEFAULTS
