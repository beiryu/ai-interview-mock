import { describe, expect, it } from "vitest"

import { splitAnswer } from "./format"

describe("splitAnswer", () => {
  it("splits key points from the spoken answer", () => {
    expect(
      splitAnswer(
        "- Led the payment migration\n- Cut latency 40%\n- Zero downtime\n---\nIn my last role I led…"
      )
    ).toEqual({
      points: ["Led the payment migration", "Cut latency 40%", "Zero downtime"],
      script: "In my last role I led…",
    })
  })

  it("shows points while the answer is still streaming", () => {
    expect(splitAnswer("- Led the payment")).toEqual({
      points: ["Led the payment"],
      script: "",
    })
  })

  it("falls back to plain text when the model ignores the format", () => {
    expect(splitAnswer("I would use a token bucket.")).toEqual({
      points: [],
      script: "I would use a token bucket.",
    })
  })
})
