import { describe, expect, it, vi } from "vitest"

// Pure prompt builders only; keep the provider (and env) out of unit tests
vi.mock("./models", () => ({
  languageModel: vi.fn(),
  providerOptions: vi.fn(),
}))

const { buildCoachInput, coachInstructions } = await import("./coach")
const { buildJudgeInput, fitContext } = await import("./judge")

describe("fitContext", () => {
  const turns = [
    { role: "interviewer", content: "a".repeat(40) },
    { role: "candidate", content: "b".repeat(40) },
    { role: "interviewer", content: "c".repeat(40) },
  ]

  it("keeps the newest turns that fit, oldest first", () => {
    const text = fitContext(turns, 110)
    expect(text).toBe(
      `CANDIDATE: ${"b".repeat(40)}\nINTERVIEWER: ${"c".repeat(40)}`
    )
  })

  it("is empty when nothing fits", () => {
    expect(fitContext(turns, 10)).toBe("")
  })
})

describe("buildJudgeInput", () => {
  it("adds context and the last answered question when present", () => {
    expect(
      buildJudgeInput({
        text: "Why?",
        context: [{ role: "candidate", content: "I chose Go" }],
        lastAnsweredQuestion: "Which language do you prefer?",
      })
    ).toBe(
      "CONVERSATION SO FAR:\nCANDIDATE: I chose Go\n\n" +
        "LAST ANSWERED QUESTION: Which language do you prefer?\n\n" +
        "INTERVIEWER'S LATEST WORDS: Why?"
    )
  })
})

describe("coach prompts", () => {
  it("puts the question last, after context and language", () => {
    expect(
      buildCoachInput({
        context: [{ role: "interviewer", content: "Hi" }],
        language: "vi",
        text: "Em đã dùng Go chưa?",
      })
    ).toBe(
      "CONVERSATION SO FAR:\nINTERVIEWER: Hi\n\n" +
        "QUESTION LANGUAGE: vi\n" +
        "NEW QUESTION FROM INTERVIEWER: Em đã dùng Go chưa?"
    )
  })

  it("ends the instructions with the brief", () => {
    expect(coachInstructions("Role: SRE")).toMatch(
      /INTERVIEW BRIEF:\nRole: SRE$/
    )
    expect(coachInstructions("")).toMatch(/\(none — .*\)$/)
  })
})
