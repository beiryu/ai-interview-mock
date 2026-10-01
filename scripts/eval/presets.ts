import { AI_TASKS } from "../../config/defaults/ai"

/**
 * Named coach setups to compare. `brief` says what the coach reads:
 * "raw" = the documents as text (lib/interview/brief.ts).
 */
export interface Preset {
  coachModel: string
  brief: "raw"
}

export const PRESETS: Record<string, Preset> = {
  // The configured coach (config/defaults/ai.ts)
  current: { coachModel: AI_TASKS.coach.model, brief: "raw" },
  // Coach before the gateway / DeepSeek switch, as the reference point
  baseline: { coachModel: "openai/gpt-4.1-mini", brief: "raw" },
  "deepseek-raw": { coachModel: "deepseek/deepseek-v4.1-flash", brief: "raw" },
  "haiku-raw": { coachModel: "anthropic/claude-haiku-4.5", brief: "raw" },
  "gpt-5.4-mini-raw": { coachModel: "openai/gpt-5.4-mini", brief: "raw" },
}
