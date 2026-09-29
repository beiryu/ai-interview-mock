import { createOpenAI } from "@ai-sdk/openai"
import type { LanguageModel } from "ai"

import { env } from "@/env.mjs"

import { parseModelSpec, type ModelSpec } from "./model-spec"

/**
 * The one place that knows about AI providers. Everything else asks for a
 * model by "provider:model" (config/defaults/ai.ts). To add a provider:
 * install its @ai-sdk package, add it to PROVIDERS in ./model-spec.ts and
 * to the two switches below.
 */

const openai = createOpenAI({
  apiKey: env.OPENAI_API_KEY,
  baseURL: env.OPENAI_BASE_URL,
})

export function languageModel(spec: string): LanguageModel {
  const { provider, modelId } = parseModelSpec(spec)
  switch (provider) {
    case "openai":
      return openai(modelId)
  }
}

/**
 * Per-provider request options: prompt caching for a stable prefix (e.g.
 * the coach's brief) and no server-side storage of interview content.
 */
export function providerOptions(
  spec: string,
  opts: { cacheKey?: string } = {}
) {
  const { provider }: ModelSpec = parseModelSpec(spec)
  switch (provider) {
    case "openai":
      return {
        openai: {
          store: false,
          ...(opts.cacheKey ? { promptCacheKey: opts.cacheKey } : {}),
        },
      }
  }
}
