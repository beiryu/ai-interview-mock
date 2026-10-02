import { describe, expect, it } from "vitest"

import {
  mergeDoNotClaim,
  mergeFacts,
  mergeInterviewPrep,
  mergePersonal,
} from "./merge"
import { renderPrepBrief } from "./render"
import { EMPTY_PERSONAL, type Fact, type ProfilePrep } from "./schema"
import { interviewSourceHash, profileSourceHash } from "./source"

const fact = (over: Partial<Fact>): Fact => ({
  id: "P1",
  title: "Claynosaurs",
  organization: "Gameloft",
  period: "2024–now",
  role: "Backend Engineer",
  stack: ["NestJS", "Redis"],
  highlights: ["Built PvP matchmaking"],
  ...over,
})

describe("merge", () => {
  it("keeps locked facts and renumbers fresh ones after them", () => {
    const previous = [
      fact({
        id: "P1",
        title: "Claynosaurs",
        highlights: ["edited by me"],
        locked: true,
      }),
      fact({ id: "P2", title: "RockExchange" }),
    ]
    const generated = [
      { ...fact({}), title: "Claynosaurs", highlights: ["regenerated"] },
      { ...fact({}), title: "Stellar" },
    ].map(({ id: _id, ...rest }) => rest)

    const merged = mergeFacts(previous, generated)
    expect(merged.map((f) => [f.id, f.title])).toEqual([
      ["P1", "Claynosaurs"],
      ["P2", "Stellar"],
    ])
    expect(merged[0].highlights).toEqual(["edited by me"])
  })

  it("never overwrites personal answers the candidate filled in", () => {
    const merged = mergePersonal(
      { ...EMPTY_PERSONAL, salaryExpectation: "2,500 USD" },
      { ...EMPTY_PERSONAL, salaryExpectation: "guess", intro: "I am…" }
    )
    expect(merged.salaryExpectation).toBe("2,500 USD")
    expect(merged.intro).toBe("I am…")
  })

  it("unions do-not-claim case-insensitively", () => {
    expect(mergeDoNotClaim(["Kafka"], ["kafka", "Rust"])).toEqual([
      "Kafka",
      "Rust",
    ])
  })

  it("keeps locked requirements and questions", () => {
    const merged = mergeInterviewPrep(
      {
        angle: "old",
        requirements: [
          {
            id: "R1",
            text: "Go",
            evidence: ["P1"],
            gap: null,
            bridge: null,
            locked: true,
          },
        ],
        likelyQuestions: [
          { question: "Why us?", points: ["mine"], refs: [], locked: true },
        ],
      },
      {
        angle: "new",
        requirements: [
          { text: "Go", evidence: [], gap: "none", bridge: null },
          { text: "Kafka", evidence: [], gap: "no Kafka", bridge: "RabbitMQ" },
        ],
        likelyQuestions: [
          { question: "Why us?", points: ["generated"], refs: [] },
          { question: "Scale it?", points: [], refs: [] },
        ],
      }
    )
    expect(merged.angle).toBe("new")
    expect(merged.requirements.map((r) => r.id)).toEqual(["R1", "R2"])
    expect(
      merged.likelyQuestions.map((q) => q.points[0] ?? q.question)
    ).toEqual(["mine", "Scale it?"])
  })
})

describe("renderPrepBrief", () => {
  const profile: ProfilePrep = {
    facts: [fact({})],
    stories: [
      {
        id: "S1",
        theme: "conflict",
        title: "Matchmaking priority",
        situation: "s",
        task: "t",
        action: "a",
        result: "r",
        factIds: ["P1"],
      },
    ],
    doNotClaim: ["Kafka in production"],
    personal: { ...EMPTY_PERSONAL, location: "District 7" },
  }

  it("renders ids, blanks and never-claim deterministically", () => {
    const input = {
      interview: { companyName: "Acme", jobTitle: "Backend", notes: null },
      profile,
      interviewPrep: null,
      documents: "",
    }
    const brief = renderPrepBrief(input)
    expect(brief).toContain(
      "P1 Claynosaurs — Gameloft, 2024–now, Backend Engineer"
    )
    expect(brief).toContain("S1 [conflict] Matchmaking priority (P1)")
    expect(brief).toContain("Salary expectation: (blank)")
    expect(brief).toContain("Location / commute: District 7")
    expect(brief).toContain("- Kafka in production")
    expect(renderPrepBrief(input)).toBe(brief)
  })
})

describe("source hashes", () => {
  it("change when a document changes, not when order does", () => {
    const a = { id: "a", updatedAt: "2026-01-01T00:00:00Z" }
    const b = { id: "b", updatedAt: "2026-01-02T00:00:00Z" }
    expect(profileSourceHash([a, b])).toBe(profileSourceHash([b, a]))
    expect(profileSourceHash([a, b])).not.toBe(
      profileSourceHash([a, { ...b, updatedAt: "2026-02-01T00:00:00Z" }])
    )
    const interview = { jobTitle: "x", companyName: null, notes: null }
    expect(
      interviewSourceHash({ interview, jobDocuments: [a], profileHash: "1" })
    ).not.toBe(
      interviewSourceHash({ interview, jobDocuments: [a], profileHash: "2" })
    )
  })
})
