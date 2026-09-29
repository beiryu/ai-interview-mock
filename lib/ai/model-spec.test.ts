import { describe, expect, it } from "vitest"

import { parseModelSpec } from "./model-spec"

describe("parseModelSpec", () => {
  it("splits provider and model", () => {
    expect(parseModelSpec("openai:gpt-4.1-mini")).toEqual({
      provider: "openai",
      modelId: "gpt-4.1-mini",
    })
  })

  it("keeps colons inside the model id", () => {
    expect(parseModelSpec("openai:ft:gpt-4.1-mini:acme").modelId).toBe(
      "ft:gpt-4.1-mini:acme"
    )
  })

  it("rejects malformed specs and unknown providers", () => {
    expect(() => parseModelSpec("gpt-4.1-mini")).toThrow(/provider:model/)
    expect(() => parseModelSpec("openai:")).toThrow(/provider:model/)
    expect(() => parseModelSpec("anthropic:claude-haiku-4-5")).toThrow(
      /not set up/
    )
  })
})
