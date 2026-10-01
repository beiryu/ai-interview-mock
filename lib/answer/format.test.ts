import { describe, expect, it } from "vitest"

import { isAssumedStory, splitAnswer, splitTags } from "./format"

describe("splitAnswer", () => {
  it("parses headline, tagged points and the spoken answer", () => {
    expect(
      splitAnswer(
        "Caching cut DB load\n- Multi-level caching on Stellar [P3]\n- DAX + ElastiCache [P3, S2]\n- Measured with CloudWatch\n---\nAt Stellar I added…"
      )
    ).toEqual({
      headline: "Caching cut DB load",
      assumed: false,
      points: [
        { text: "Multi-level caching on Stellar", tags: ["P3"] },
        { text: "DAX + ElastiCache", tags: ["P3", "S2"] },
        { text: "Measured with CloudWatch", tags: [] },
      ],
      script: "At Stellar I added…",
    })
  })

  it("still reads answers without a headline", () => {
    expect(
      splitAnswer(
        "- Led the payment migration\n- Cut latency 40%\n---\nIn my last role…"
      )
    ).toMatchObject({
      headline: "",
      points: [
        { text: "Led the payment migration" },
        { text: "Cut latency 40%" },
      ],
      script: "In my last role…",
    })
  })

  it("shows the headline and points while streaming", () => {
    expect(splitAnswer("Honest: no Kafka yet")).toEqual({
      headline: "Honest: no Kafka yet",
      assumed: false,
      points: [],
      script: "",
    })
    expect(
      splitAnswer("Honest: no Kafka yet\n- Ran RabbitMQ at Rock")
    ).toMatchObject({
      headline: "Honest: no Kafka yet",
      points: [{ text: "Ran RabbitMQ at Rock", tags: [] }],
    })
  })

  it("falls back to plain text when the model ignores the format", () => {
    expect(splitAnswer("I would use a token bucket.")).toEqual({
      headline: "",
      assumed: false,
      points: [],
      script: "I would use a token bucket.",
    })
  })

  it("flags assumed examples marked with ✎", () => {
    expect(
      splitAnswer(
        "✎ Data first, then a trial\n- Shared load test results [P1]\n---\nOn Claynosaurs…"
      )
    ).toMatchObject({ headline: "Data first, then a trial", assumed: true })
  })
})

describe("splitTags", () => {
  it("only treats evidence ids as tags", () => {
    expect(splitTags("Uses [fill in: your district]")).toEqual({
      text: "Uses [fill in: your district]",
      tags: [],
    })
    expect(splitTags("Say it honestly [ ]")).toEqual({
      text: "Say it honestly",
      tags: [],
    })
    expect(splitTags("Locks rows up front [general knowledge]")).toEqual({
      text: "Locks rows up front",
      tags: [],
    })
    expect(splitTags("Matchmaking on Redis [P1] [S2]")).toEqual({
      text: "Matchmaking on Redis",
      tags: ["P1", "S2"],
    })
  })
})

describe("isAssumedStory", () => {
  const answer = (tags: string) =>
    splitAnswer(
      `Disagreement\n- Proposed a simpler path ${tags}\n---\nAt DZNS I…`
    )

  it("treats a behavioral answer without a prep story as assumed", () => {
    expect(isAssumedStory(answer("[P7]"), "behavioral")).toBe(true)
    expect(isAssumedStory(answer("[S3]"), "behavioral")).toBe(false)
    expect(isAssumedStory(answer("[P7]"), "technical")).toBe(false)
  })
})
