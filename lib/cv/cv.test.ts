import { describe, expect, it } from "vitest"

import { checkCv, mergeCv, unsourcedTerms } from "./check"
import { EMPTY_CONTACT, pendingStretches, type CvContent } from "./schema"

// The source CV's bullet ids
const source = ["B2", "B16"]
const documents =
  "One Tech Stop EPCAS Next.js React Netpower Nytnorge Java Spring PostgreSQL 15% faster"

const bullet = (text: string, sourceIds: string[]) => ({
  id: "",
  text,
  sourceIds,
  stretch: null,
})
const cv = (over: Partial<CvContent> = {}): CvContent => ({
  contact: EMPTY_CONTACT,
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
      bullets: [bullet("Built Next.js cost UIs for 3 teams", ["B2"])],
    },
    {
      id: "",
      company: "Netpower",
      role: "Fullstack",
      period: "2023",
      bullets: [bullet("Spring REST APIs, 15% faster queries", ["B16", "B99"])],
    },
    {
      id: "",
      company: "Invented Corp",
      role: "Lead",
      period: "2025",
      bullets: [bullet("Led 20 engineers", ["B2"])],
    },
  ],
  education: [],
  learning: [],
  ...over,
})

describe("checkCv", () => {
  const checked = checkCv(cv(), { ids: source, text: documents })

  it("drops invented companies and unknown source bullets", () => {
    expect(checked.experience.map((e) => e.company)).toEqual([
      "One Tech Stop",
      "Netpower",
    ])
    expect(checked.experience[1].bullets[0].sourceIds).toEqual(["B16"])
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
    const withLearning = checkCv(cv({ learning: ["PostgreSQL", "Rust"] }), {
      ids: source,
      text: documents,
    })
    expect(withLearning.learning).toEqual(["Rust", "Kafka"])
  })

  it("counts an unapproved summary stretch as pending", () => {
    const stretched = cv({
      summaryStretch: { note: "Boot", defense: "", approved: false },
    })
    expect(
      pendingStretches(checkCv(stretched, { ids: source, text: documents }))
    ).toHaveLength(2)
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
  it("skips the first word of every sentence", () => {
    expect(
      unsourcedTerms(
        "Built web apps with Spring Boot. Passionate about fintech.",
        "spring"
      )
    ).toEqual(["Boot"])
  })

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
            bullets: [bullet("Shipped Spring Boot APIs", ["B16"])],
          },
        ],
      }),
      { ids: source, text: documents }
    )
    expect(checked.experience[0].bullets[0].stretch?.note).toContain("Boot")
    expect(checked.summaryStretch?.note).toContain("Boot")
  })
})
