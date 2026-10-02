import { describe, expect, it } from "vitest"

import { buildInterviewBrief } from "./brief"

const job = {
  company: "Acme",
  title: "Backend Engineer",
  notes: "Panel of two.\n\n\n\nEmphasize Go.",
  jdText: "Kafka, Go",
}

describe("buildInterviewBrief", () => {
  it("includes the job, its JD first, then documents", () => {
    const brief = buildInterviewBrief(
      job,
      [{ title: "My CV", type: "RESUME", content: "5 years of Go" }],
      10_000
    )
    expect(brief).toContain("Role: Backend Engineer")
    expect(brief).toContain("Company: Acme")
    expect(brief).toContain("Panel of two.\n\nEmphasize Go.")
    expect(brief.indexOf("Job description (Job description)")).toBeLessThan(
      brief.indexOf("My CV (Resume)")
    )
    expect(brief).not.toContain("truncated")
  })

  it("is empty with nothing to say", () => {
    expect(
      buildInterviewBrief(
        { company: "", title: "", notes: null, jdText: "" },
        [{ title: "Empty", type: "NOTES", content: "  \n " }],
        1000
      )
    ).toBe("")
  })

  it("fits the budget, letting short documents keep everything", () => {
    const brief = buildInterviewBrief(
      { company: "", title: "", notes: null, jdText: "" },
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
