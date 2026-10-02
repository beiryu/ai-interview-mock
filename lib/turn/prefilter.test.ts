import { describe, expect, it } from "vitest"

import { isBackchannel, worthJudging } from "./prefilter"
import { textSimilarity } from "./similarity"

describe("prefilter", () => {
  it.each([
    "Okay.",
    "Yeah, right",
    "Got it!",
    "Ừ.",
    "Dạ",
    "Cảm ơn em",
    "OK, cảm ơn em",
  ])("backchannel: %s", (text) => {
    expect(isBackchannel(text)).toBe(true)
    expect(worthJudging(text)).toBe(false)
  })

  it.each([
    "Why?",
    "Tại sao?",
    "Tell me more",
    "Em kể đi",
    "Can you walk me through it",
    "Hệ thống đó scale thế nào",
    "You see what I mean?",
  ])("worth judging: %s", (text) => {
    expect(worthJudging(text)).toBe(true)
  })

  it.each(["Okay great", "Nice one", "Được rồi"])(
    "not worth judging: %s",
    (text) => {
      expect(worthJudging(text)).toBe(false)
    }
  )
})

describe("textSimilarity", () => {
  it("ignores punctuation and casing added on finalization", () => {
    expect(
      textSimilarity(
        "tell me about your last project",
        "Tell me about your last project?"
      )
    ).toBe(1)
  })

  it("treats a few changed words as the same question", () => {
    expect(
      textSimilarity(
        "em kể về dự án gần nhất của em",
        "Em kể về dự án gần nhất của em đi"
      )
    ).toBeGreaterThanOrEqual(0.75)
  })

  it("separates different questions", () => {
    expect(
      textSimilarity("Why did you choose Go?", "How do you test your services?")
    ).toBeLessThan(0.3)
  })
})
