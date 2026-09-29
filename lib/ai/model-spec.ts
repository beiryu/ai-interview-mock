export const PROVIDERS = ["openai"] as const
export type Provider = (typeof PROVIDERS)[number]

export interface ModelSpec {
  provider: Provider
  modelId: string
}

/** "openai:gpt-4.1-mini" → { provider: "openai", modelId: "gpt-4.1-mini" } */
export function parseModelSpec(spec: string): ModelSpec {
  const at = spec.indexOf(":")
  const provider = spec.slice(0, at)
  const modelId = spec.slice(at + 1)
  if (at <= 0 || !modelId) {
    throw new Error(`Model "${spec}" must look like "provider:model"`)
  }
  if (!(PROVIDERS as readonly string[]).includes(provider)) {
    throw new Error(
      `Provider "${provider}" is not set up (have: ${PROVIDERS.join(", ")}); ` +
        "install its @ai-sdk package and add it to lib/ai/models.ts"
    )
  }
  return { provider: provider as Provider, modelId }
}
