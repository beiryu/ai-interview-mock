import { createGateway, type LanguageModel } from "ai"

import { env } from "@/env.mjs"
import { AI_TASKS, type AiTask, type AiTaskName } from "@/config/defaults/ai"

import { parseModelId } from "./model-spec"

/**
 * The one place that knows how models are reached: every call goes through
 * the Vercel AI Gateway, so a model is just a gateway id from
 * config/defaults/ai.ts and no provider SDK or key lives in the app.
 */

const gateway = createGateway({ apiKey: env.AI_GATEWAY_API_KEY })

export function languageModel(id: string): LanguageModel {
  parseModelId(id) // fail fast on a malformed id
  return gateway(id)
}

/** Remaining AI Gateway credit balance + total spent (USD strings). */
export function getGatewayCredits() {
  return gateway.getCredits()
}

/**
 * Request options for a task: gateway routing (fallbacks, caching, usage
 * tags) plus provider-specific settings for whichever provider serves it.
 * `model` differs from the task's when an eval overrides it; fallbacks only
 * apply to the configured model so an eval measures the model it names.
 */
export function providerOptions(name: AiTaskName, model: string) {
  const task: AiTask = AI_TASKS[name]
  const fallback = model === task.model ? task.fallback : undefined
  return {
    gateway: {
      caching: "auto" as const,
      tags: [`task:${name}`],
      ...(fallback?.length ? { models: [...fallback] } : {}),
      // Pin hosts only for the configured model (an eval may name another)
      ...(model === task.model && task.providers?.length
        ? { order: [...task.providers] }
        : {}),
    },
    // Applied only if the request is served by OpenAI (primary or fallback)
    openai: {
      store: false,
      ...(task.cacheKey ? { promptCacheKey: task.cacheKey } : {}),
    },
  }
}
