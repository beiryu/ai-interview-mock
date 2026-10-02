import { describe, expect, it, vi } from "vitest"

vi.mock("./run", () => ({ runObject: vi.fn() }))

const { EMPTY_LEDGER, mergeLedger, renderLedger } = await import("./ledger")

describe("ledger", () => {
  it("accumulates questions, stories and claims without duplicates", () => {
    const one = mergeLedger(EMPTY_LEDGER, {
      question: "Tell me about a conflict",
      kind: "behavioral",
      storiesUsed: ["S1"],
      newClaims: ["Led matchmaking at Claynosaurs"],
      focus: "Teamwork",
    })
    const two = mergeLedger(one, {
      question: "Scale it 10x?",
      kind: "technical",
      storiesUsed: ["S1"],
      newClaims: [
        "Led matchmaking at Claynosaurs",
        "Prefers Redis sorted sets",
      ],
      focus: "",
    })
    expect(two.storiesUsed).toEqual(["S1"])
    expect(two.claims).toEqual([
      "Led matchmaking at Claynosaurs",
      "Prefers Redis sorted sets",
    ])
    expect(two.focus).toBe("Teamwork")
    expect(renderLedger(two)).toContain(
      "Stories already told (pick another unless asked again): S1"
    )
  })

  it("renders nothing before the first answer", () => {
    expect(renderLedger(EMPTY_LEDGER)).toBe("")
  })
})
