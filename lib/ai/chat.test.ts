import { describe, expect, it, vi } from "vitest"

vi.mock("./run", () => ({ runStream: vi.fn(), runObject: vi.fn() }))

const { withTranscript } = await import("./chat")

describe("withTranscript", () => {
  it("prefixes the newest user message with the live transcript", () => {
    const out = withTranscript(
      [
        { role: "user", content: "hi" },
        { role: "assistant", content: "hello" },
        {
          role: "user",
          content: [{ type: "text", text: "What did they just ask?" }],
        },
      ],
      [{ role: "interviewer", content: "Why Go?" }],
      1000
    )
    expect(out[0]).toEqual({ role: "user", content: "hi" })
    expect(out[2]).toEqual({
      role: "user",
      content:
        "LIVE TRANSCRIPT (most recent last):\nINTERVIEWER: Why Go?\n\nMY MESSAGE: What did they just ask?",
    })
  })

  it("leaves messages alone without a transcript", () => {
    const messages = [{ role: "user" as const, content: "hi" }]
    expect(withTranscript(messages, [], 1000)).toBe(messages)
  })
})
