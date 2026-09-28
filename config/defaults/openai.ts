export const OPENAI_DEFAULTS = {
  chat: {
    model: "gpt-4.1-mini",
    temperature: 0.2,
    maxTokens: 2000,
    presencePenalty: 0.1,
    frequencyPenalty: 0.2,
  },
  classify: {
    model: "gpt-4o-mini",
    maxTokens: 20,
    temperature: 0,
    timeoutMs: 2000,
  },
  agent: {
    answerCoachModel: "gpt-4.1-mini",
  },
  cache: {
    prevResponseTtlSec: 86400,
  },
} as const

export type OpenAIDefaults = typeof OPENAI_DEFAULTS
