// Models are "provider:model" (see lib/ai/models.ts); switching model or
// provider is a change here. Run `pnpm ai:eval` before and after.
export const AI_DEFAULTS = {
  // Decides whether the interviewer asked something and what exactly.
  // gpt-4.1-mini over nano: same flags on the eval set, but it resolves
  // follow-ups ("Why?" → "Why did you choose Go?"); ~80 ms slower.
  judge: {
    model: "openai:gpt-4.1-mini",
    maxTokens: 160,
    timeoutMs: 2500,
    // Rolling transcript sent with each call (smaller input = faster)
    maxContextChars: 1500,
  },
  coach: {
    model: "openai:gpt-4.1-mini",
    // 3 key points + 1–3 spoken sentences; a cap keeps tail latency bounded
    maxTokens: 260,
    // Interview brief (CV, JD, notes) in the instructions; ~8k tokens max
    maxBriefChars: 32_000,
  },
  // Document Chat (OpenAI SDK + hosted vector store, not the AI SDK)
  chat: {
    model: "gpt-4.1-mini",
    temperature: 0.2,
    maxTokens: 2000,
  },
} as const
