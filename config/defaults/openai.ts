export const OPENAI_DEFAULTS = {
  chat: {
    model: "gpt-4.1-mini",
    temperature: 0.2,
    maxTokens: 2000,
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
} as const

export type OpenAIDefaults = typeof OPENAI_DEFAULTS
