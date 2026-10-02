import { describe, expect, it } from "vitest"

import { EMPTY_CONTACT, type CvContent } from "@/lib/cv/schema"

import { notInDocuments } from "./claims"
import { mergeDoNotClaim, mergeJobPrep, mergeStories } from "./merge"
import { renderJobBrief } from "./render"
import { EMPTY_ANSWERS, type JobPrep, type Story } from "./schema"
import { jobCvHash, jobPrepHash } from "./source"

const story = (over: Partial<Story>): Story => ({
  id: "S1",
  theme: "impact",
  title: "Matchmaking",
  situation: "s",
  task: "t",
  action: "a",
  result: "r",
  sourceIds: ["B1"],
  ...over,
})

const cv: CvContent = {
  contact: EMPTY_CONTACT,
  headline: "Full-stack Developer",
  summary: "Builds web apps.",
  summaryStretch: {
    note: "Spring Boot not in your CV",
    defense: "I used Spring; Boot is what I'd use today.",
    approved: true,
  },
  skills: [{ group: "Backend", items: ["NestJS", "Spring"] }],
  experience: [
    {
      id: "E1",
      company: "Gameloft",
      role: "Backend Engineer (Claynosaurs)",
      period: "2024–now",
      bullets: [
        {
          id: "B1",
          text: "Built PvP matchmaking",
          sourceIds: ["B7"],
          stretch: null,
        },
      ],
    },
  ],
  education: [],
  learning: ["Kafka"],
}

const prep: JobPrep = {
  angle: "Backend fit.",
  intro: "I'm a backend engineer.",
  requirements: [
    { id: "R1", text: "NestJS", evidence: ["B1"], gap: null, bridge: null },
  ],
  stories: [story({})],
  likelyQuestions: [{ question: "Why us?", points: ["Growth"], refs: ["R1"] }],
  doNotClaim: ["Kafka"],
}

describe("merge", () => {
  it("keeps locked stories and renumbers fresh ones after them", () => {
    const merged = mergeStories(
      [
        story({ id: "S1", title: "Matchmaking", locked: true }),
        story({ id: "S2", title: "Old" }),
      ],
      [
        { ...story({}), title: "matchmaking!" },
        { ...story({}), title: "Deadline" },
      ].map(({ id: _, ...s }) => s)
    )
    expect(merged.map((s) => `${s.id} ${s.title}`)).toEqual([
      "S1 Matchmaking",
      "S2 Deadline",
    ])
  })

  it("unions do-not-claim case-insensitively", () => {
    expect(mergeDoNotClaim(["Kafka"], ["kafka", "Rust"])).toEqual([
      "Kafka",
      "Rust",
    ])
  })

  it("keeps locked requirements and questions", () => {
    const merged = mergeJobPrep(
      {
        ...prep,
        requirements: [{ ...prep.requirements[0], text: "Go", locked: true }],
        likelyQuestions: [
          { question: "Why us?", points: ["mine"], refs: [], locked: true },
        ],
      },
      {
        angle: "new",
        intro: "hi",
        requirements: [
          { text: "Go", evidence: [], gap: "none", bridge: null },
          { text: "Kafka", evidence: [], gap: "no Kafka", bridge: "RabbitMQ" },
        ],
        stories: [],
        likelyQuestions: [
          { question: "Why us?", points: ["generated"], refs: [] },
          { question: "Scale it?", points: [], refs: [] },
        ],
        doNotClaim: [],
      }
    )
    expect(merged.angle).toBe("new")
    expect(merged.requirements.map((r) => r.id)).toEqual(["R1", "R2"])
    expect(
      merged.likelyQuestions.map((q) => q.points[0] ?? q.question)
    ).toEqual(["mine", "Scale it?"])
  })
})

describe("renderJobBrief", () => {
  const job = {
    company: "Acme",
    title: "Backend",
    notes: null,
    jdText: "Go, Kafka",
  }

  it("renders the CV, prep, answers and never-claim deterministically", () => {
    const input = {
      job,
      cv,
      prep,
      answers: { ...EMPTY_ANSWERS, salaryExpectation: "2000 USD" },
    }
    const brief = renderJobBrief(input)
    expect(brief).toMatch(/^## Interview\nRole: Backend\nCompany: Acme/)
    expect(brief).toContain("## Candidate CV (sent to this employer")
    expect(brief).toContain("  B1 Built PvP matchmaking (from B7)")
    expect(brief).toContain("if asked: I used Spring")
    expect(brief).toContain("R1 NestJS → B1")
    expect(brief).toContain("S1 [impact] Matchmaking (B1)")
    expect(brief).toContain("30-second intro: I'm a backend engineer.")
    expect(brief).toContain("Salary expectation: 2000 USD")
    expect(brief).toContain("Why this company: (blank)")
    expect(brief).toContain(
      "## Never claim (not in the candidate's experience)\n- Kafka"
    )
    expect(brief).not.toContain("## Job description")
    expect(renderJobBrief(input)).toBe(brief)
  })

  it("marks a practice persona, and shows the JD while there is no prep", () => {
    const brief = renderJobBrief({
      job,
      cv,
      practice: true,
      prep: null,
      answers: null,
    })
    expect(brief).toContain("## Candidate CV (a practice persona")
    expect(brief).toContain("## Job description\nGo, Kafka")
  })
})

describe("source hashes", () => {
  const job = { title: "x", company: "", notes: null, jdText: "Go" }
  const cvA = { id: "a", updatedAt: "2026-01-01T00:00:00Z" }

  it("change with the JD and with the CV they were built from", () => {
    expect(jobCvHash(job, cvA)).toBe(jobCvHash({ ...job }, { ...cvA }))
    expect(jobCvHash(job, cvA)).not.toBe(
      jobCvHash({ ...job, jdText: "Go, Kafka" }, cvA)
    )
    expect(jobPrepHash(job, cvA)).not.toBe(
      jobPrepHash(job, { ...cvA, updatedAt: "2026-02-01T00:00:00Z" })
    )
    expect(jobCvHash(job, null)).not.toBe(jobCvHash(job, cvA))
  })
})

describe("notInDocuments", () => {
  it("drops never-claim entries the CV mentions, and notes", () => {
    const text =
      "Skills: Spring, Angular, Go. Nytnorge: Java, Spring, PostgreSQL, Angular."
    expect(
      notInDocuments(
        [
          "Spring",
          "Angular",
          "Go",
          "Kafka",
          "Rust",
          "Team size for X (not specified)",
          "gRPC",
        ],
        text
      )
    ).toEqual(["Kafka", "Rust", "gRPC"])
  })
})
