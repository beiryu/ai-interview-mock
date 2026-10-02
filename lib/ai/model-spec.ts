export interface ModelId {
  provider: string
  model: string
}

/** Gateway model id: "deepseek/deepseek-v4.1-flash" → provider + model. */
export function parseModelId(id: string): ModelId {
  const slash = id.indexOf("/")
  const provider = id.slice(0, slash)
  const model = id.slice(slash + 1)
  if (slash <= 0 || !model || !/^[a-z0-9-]+$/.test(provider)) {
    throw new Error(`Model "${id}" must be a gateway id like "provider/model"`)
  }
  return { provider, model }
}
