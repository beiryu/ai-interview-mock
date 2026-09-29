import { describe, expect, it } from "vitest"

import { buildInterviewBrief } from "./brief"

const interview = {
  companyName: "Acme",
  jobTitle: "Backend Engineer",
  notes: "Panel of two.\n\n\n\nEmphasize Go.",
}

describe("buildInterviewBrief", () => {
  it("includes the interview and documents, JD first", () => {
    const brief = buildInterviewBrief(
      interview,
      [
        { title: "My CV", type: "RESUME", content: "5 years of Go" },
        { title: "Acme JD", type: "JOB_DESCRIPTION", content: "Kafka, Go" },
      ],
      10_000
    )
    expect(brief).toContain("Role: Backend Engineer")
    expect(brief).toContain("Company: Acme")
    expect(brief).toContain("Panel of two.\n\nEmphasize Go.")
    expect(brief.indexOf("Acme JD (Job description)")).toBeLessThan(
      brief.indexOf("My CV (Resume)")
    )
    expect(brief).not.toContain("truncated")
  })

  it("is empty with nothing to say", () => {
    expect(
      buildInterviewBrief(
        { companyName: null, jobTitle: null, notes: null },
        [{ title: "Empty", type: "NOTES", content: "  \n " }],
        1000
      )
    ).toBe("")
  })

  it("fits the budget, letting short documents keep everything", () => {
    const brief = buildInterviewBrief(
      { companyName: null, jobTitle: null, notes: null },
      [
        { title: "Short", type: "NOTES", content: "a".repeat(100) },
        { title: "Long", type: "PORTFOLIO", content: "b".repeat(5000) },
      ],
      1000
    )
    expect(brief).toContain("a".repeat(100))
    expect(brief).toContain("b".repeat(900))
    expect(brief).not.toContain("b".repeat(901))
    expect(brief).toContain("[…truncated]")
  })
})
