import { describe, expect, it } from "vitest"

import { parseModelId } from "./model-spec"

describe("parseModelId", () => {
  it("splits provider and model", () => {
    expect(parseModelId("deepseek/deepseek-v4.1-flash")).toEqual({
      provider: "deepseek",
      model: "deepseek-v4.1-flash",
    })
  })

  it("keeps slashes inside the model name", () => {
    expect(parseModelId("openai/ft/gpt-4.1-mini").model).toBe("ft/gpt-4.1-mini")
  })

  it("rejects ids without a provider", () => {
    expect(() => parseModelId("gpt-4.1-mini")).toThrow(/provider\/model/)
    expect(() => parseModelId("openai/")).toThrow(/provider\/model/)
    expect(() => parseModelId("openai:gpt-4.1-mini")).toThrow(/provider\/model/)
  })
})
