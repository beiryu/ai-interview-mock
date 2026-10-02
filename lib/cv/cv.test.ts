import { describe, expect, it } from "vitest"

import type { Fact } from "@/lib/prep/schema"

import { checkCv, mergeCv, unsourcedTerms } from "./check"
import { pendingStretches, type TailoredCv } from "./schema"

const facts: Fact[] = [
  {
    id: "P2",
    title: "EPCAS",
    organization: "One Tech Stop",
    period: "7/2026 - now",
    role: "Full Stack Developer",
    stack: ["Next.js"],
    highlights: ["Built cost review UIs"],
  },
  {
    id: "P16",
    title: "Nytnorge",
    organization: "Netpower",
    period: "6/2023 - 9/2023",
    role: "Fullstack",
    stack: ["Java", "Spring"],
    highlights: ["Optimized queries, 15% faster"],
  },
]
const documents =
  "One Tech Stop EPCAS Next.js React Netpower Nytnorge Java Spring PostgreSQL 15% faster"

const bullet = (text: string, factIds: string[]) => ({
  id: "",
  text,
  factIds,
  stretch: null,
})
const cv = (over: Partial<TailoredCv> = {}): TailoredCv => ({
  headline: "Full-stack Developer",
  summary: "…",
  summaryStretch: null,
  skills: [{ group: "Backend", items: ["Java", "Spring", "Kafka"] }],
  experience: [
    {
      id: "",
      company: "One Tech Stop",
      role: "Full Stack Developer",
      period: "7/2026 - now",
      bullets: [bullet("Built Next.js cost UIs for 3 teams", ["P2"])],
    },
    {
      id: "",
      company: "Netpower",
      role: "Fullstack",
      period: "2023",
      bullets: [bullet("Spring REST APIs, 15% faster queries", ["P16", "P99"])],
    },
    {
      id: "",
      company: "Invented Corp",
      role: "Lead",
      period: "2025",
      bullets: [bullet("Led 20 engineers", ["P2"])],
    },
  ],
  education: [],
  learning: [],
  ...over,
})

describe("checkCv", () => {
  const checked = checkCv(cv(), facts, documents)

  it("drops invented companies and unknown fact ids", () => {
    expect(checked.experience.map((e) => e.company)).toEqual([
      "One Tech Stop",
      "Netpower",
    ])
    expect(checked.experience[1].bullets[0].factIds).toEqual(["P16"])
  })

  it("flags numbers your documents don't have, keeps the ones they do", () => {
    expect(checked.experience[0].bullets[0].stretch?.note).toContain("3")
    expect(checked.experience[1].bullets[0].stretch).toBeNull()
  })

  it("moves skills your documents never mention to learning", () => {
    expect(checked.skills[0].items).toEqual(["Java", "Spring"])
    expect(checked.learning).toEqual(["Kafka"])
  })

  it("never lists something your documents already show as learning", () => {
    const withLearning = checkCv(
      cv({ learning: ["PostgreSQL", "Rust"] }),
      facts,
      documents
    )
    expect(withLearning.learning).toEqual(["Rust", "Kafka"])
  })

  it("counts an unapproved summary stretch as pending", () => {
    const stretched = cv({
      summaryStretch: { note: "Boot", defense: "", approved: false },
    })
    expect(pendingStretches(checkCv(stretched, facts, documents))).toHaveLength(
      2
    )
  })

  it("counts stretches waiting for approval", () => {
    expect(pendingStretches(checked)).toHaveLength(1)
  })
})

describe("mergeCv", () => {
  it("keeps your locked bullets and approved stretches, renumbers ids", () => {
    const previous = mergeCv(
      null,
      cv({ experience: cv().experience.slice(0, 2) })
    )
    previous.experience[0].bullets[0] = {
      ...previous.experience[0].bullets[0],
      text: "My own wording",
      locked: true,
    }
    previous.experience[1].bullets[0] = {
      ...previous.experience[1].bullets[0],
      stretch: { note: "Boot", defense: "I used Spring", approved: true },
    }
    const regenerated = cv({ experience: cv().experience.slice(0, 2) })
    regenerated.experience[1].bullets[0].stretch = {
      note: "Boot",
      defense: "I used Spring",
      approved: false,
    }

    const merged = mergeCv(previous, regenerated)
    expect(merged.experience[0].bullets.map((b) => b.text)).toEqual([
      "My own wording",
      "Built Next.js cost UIs for 3 teams",
    ])
    expect(merged.experience[1].bullets[0].stretch?.approved).toBe(true)
    expect(
      merged.experience.flatMap((e) => e.bullets.map((b) => b.id))
    ).toEqual(["B1", "B2", "B3"])
  })
})

describe("unsourcedTerms", () => {
  const docs = "java spring postgresql next.js react websocket mysql"
  it("catches tech words your documents never mention", () => {
    expect(
      unsourcedTerms("Worked on a Java Spring Boot project", docs)
    ).toEqual(["Boot"])
    expect(unsourcedTerms("Built Next.js UIs with WebSockets", docs)).toEqual(
      []
    )
  })

  it("flags an unmarked stretch in a bullet and in the summary", () => {
    const checked = checkCv(
      cv({
        summary: "Strong in Spring Boot.",
        experience: [
          {
            id: "",
            company: "Netpower",
            role: "Fullstack",
            period: "2023",
            bullets: [bullet("Shipped Spring Boot APIs", ["P16"])],
          },
        ],
      }),
      facts,
      documents
    )
    expect(checked.experience[0].bullets[0].stretch?.note).toContain("Boot")
    expect(checked.summaryStretch?.note).toContain("Boot")
  })
})
