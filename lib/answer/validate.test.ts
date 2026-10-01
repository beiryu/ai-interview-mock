import { describe, expect, it } from "vitest"

import { validateAnswer } from "./validate"

const source = `P1 Claynosaurs — Gameloft, 2024–now
  - Improved development speed by 30%
P3 Stellar
  - Multi-level caching with DAX and ElastiCache reduced database load by 60%
RabbitMQ at RockExchange`

const check = (answer: string, knownIds = new Set(["P1", "P3", "S1"])) =>
  validateAnswer({
    answer,
    knownIds,
    source,
    doNotClaim: ["Kafka in production", "Rust"],
  })

describe("validateAnswer", () => {
  it("passes a grounded answer", () => {
    expect(
      check(
        "Caching cut DB load\n- Multi-level caching on Stellar [P3]\n- 60% less database load [P3]\n---\nAt Stellar I added caching that cut database load by about 60%."
      )
    ).toEqual([])
  })

  it("flags invented numbers from past evals", () => {
    const issues = check(
      "Mức lương mong muốn\n- Phù hợp thị trường\n---\nEm mong muốn khoảng 30-40 triệu một tháng."
    )
    expect(issues.map((i) => i.kind)).toContain("unsupported-number")
  })

  it("ignores numbers inside fill-in placeholders", () => {
    expect(check("Commute\n---\nEm ở [fill in: 7 km away].")).toEqual([])
  })

  it("flags ids that are not in the prep", () => {
    expect(check("X\n- Did something [S9]\n---\nI did.")).toEqual([
      { kind: "unknown-id", detail: "S9 is not in your prep" },
    ])
    // No prep loaded: any id is made up
    expect(check("X\n- Did something [S9]\n---\nI did.", new Set())).toEqual([
      {
        kind: "unknown-id",
        detail: "S9: no prep loaded, so this evidence is made up",
      },
    ])
  })

  it("flags never-claim items unless negated", () => {
    expect(
      check(
        "Yes\n- Built pipelines\n---\nI ran Kafka in production at Gameloft."
      )
    ).toEqual([
      {
        kind: "never-claim",
        detail: "mentions Kafka in production (on your never-claim list)",
      },
    ])
    expect(
      check(
        "Honest answer\n- Happy to learn Kafka; concepts carry over\n---\nI haven't used Kafka in production, but I ran RabbitMQ, so I'd pick Kafka up quickly."
      )
    ).toEqual([])
  })
})
