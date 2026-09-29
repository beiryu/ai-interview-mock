import { beforeEach, describe, expect, it } from "vitest"

import { INTERVIEW_DEFAULTS } from "@/config/defaults/interview"

import { TurnEngine, type CommittedTurn, type TurnStatus } from "./turn-engine"

const LOUD = 0.1
const QUIET = 0.001

/** Drives the engine like the app: audio levels every 20 ms, ticks every 100 ms. */
class Harness {
  now = 0
  commits: CommittedTurn[] = []
  pauses: string[] = []
  resumes = 0
  finalizes = 0
  candidateTurns: string[] = []
  statuses: TurnStatus[] = []
  engine = new TurnEngine(INTERVIEW_DEFAULTS, {
    onCommit: (turn) => this.commits.push(turn),
    onPause: (text) => this.pauses.push(text),
    onResume: () => this.resumes++,
    onFinalizeRequest: () => this.finalizes++,
    onCandidateTurn: (text) => this.candidateTurns.push(text),
    onStatus: (status) => this.statuses.push(status),
  })

  advance(ms: number, levels: { interviewer?: number; candidate?: number }) {
    const end = this.now + ms
    while (this.now < end) {
      this.now += 20
      this.engine.onAudioLevel(
        "interviewer",
        levels.interviewer ?? QUIET,
        this.now
      )
      this.engine.onAudioLevel("candidate", levels.candidate ?? QUIET, this.now)
      if (this.now % 100 === 0) this.engine.tick(this.now)
    }
  }

  say(role: "interviewer" | "candidate", text: string, language = "en") {
    this.engine.onTranscript(
      role,
      {
        finalChunk: text,
        partial: "",
        languageChars: { [language]: text.length },
      },
      this.now
    )
  }
}

describe("TurnEngine", () => {
  let h: Harness
  beforeEach(() => {
    h = new Harness()
  })

  it("commits on Soniox <end> as soon as it arrives", () => {
    h.advance(1000, { interviewer: LOUD })
    h.say("interviewer", "Okay so tell me more about the migration")
    h.advance(400, {})
    expect(h.pauses).toHaveLength(1) // judge + draft started at the pause
    expect(h.finalizes).toBe(1)
    h.engine.onEndpoint("interviewer", 420)
    h.advance(100, {})

    expect(h.commits).toHaveLength(1)
    expect(h.commits[0]).toMatchObject({
      reason: "endpoint",
      answerable: true,
      endpointLagMs: 420,
    })
  })

  it("commits a complete-sounding question after the stable window", () => {
    h.advance(1500, { interviewer: LOUD })
    h.say("interviewer", "Can you walk me through your last project?")
    h.advance(800, {})
    expect(h.commits).toHaveLength(0)
    h.advance(200, {})
    expect(h.commits).toHaveLength(1)
    expect(h.commits[0].reason).toBe("stable")
  })

  it("holds while the judge says the question isn't finished", () => {
    h.advance(1000, { interviewer: LOUD })
    h.say("interviewer", "So our system uses Kafka for payments")
    h.advance(400, {})
    h.engine.onJudge("So our system uses Kafka for payments", {
      isAsk: true,
      complete: false,
    })
    h.engine.onEndpoint("interviewer") // Soniox thinks they're done
    h.advance(1500, {})
    expect(h.commits).toHaveLength(0)
    expect(h.statuses).toContain("waiting")

    h.advance(700, { interviewer: LOUD })
    h.say("interviewer", " how would you scale it?")
    h.advance(1000, {})
    expect(h.commits).toHaveLength(1)
    expect(h.commits[0].text).toBe(
      "So our system uses Kafka for payments how would you scale it?"
    )
  })

  it("ignores a verdict for text the interviewer has since extended", () => {
    h.advance(1000, { interviewer: LOUD })
    h.say("interviewer", "Tell me about")
    h.advance(400, {})
    h.advance(600, { interviewer: LOUD })
    h.say(
      "interviewer",
      " your biggest production incident and what you learned"
    )
    // stale verdict for the short fragment
    h.engine.onJudge("Tell me about", { isAsk: true, complete: false })
    h.advance(1000, {})
    expect(h.commits).toHaveLength(1)
  })

  it("does not cut at a mid-sentence thinking pause", () => {
    h.advance(1000, { interviewer: LOUD })
    h.say("interviewer", "Tell me about a time when you and")
    h.advance(2000, {}) // under the 2.5 s safety net
    expect(h.commits).toHaveLength(0)

    h.advance(800, { interviewer: LOUD })
    h.say("interviewer", " your team disagreed?")
    h.advance(1000, {})
    expect(h.commits).toHaveLength(1)
    expect(h.commits[0].text).toBe(
      "Tell me about a time when you and your team disagreed?"
    )
  })

  it("records acknowledgements without answering or judging them", () => {
    h.advance(600, { interviewer: LOUD })
    h.say("interviewer", "Okay, cảm ơn em", "vi")
    h.advance(400, {})
    h.engine.onEndpoint("interviewer")
    h.advance(100, {})
    expect(h.pauses).toHaveLength(0)
    expect(h.commits).toHaveLength(1)
    expect(h.commits[0].answerable).toBe(false)
  })

  it("commits when the candidate starts answering", () => {
    h.advance(1000, { interviewer: LOUD })
    h.say("interviewer", "Okay what about testing then")
    h.advance(400, {})
    h.advance(400, { candidate: LOUD })
    expect(h.commits).toHaveLength(1)
    expect(h.commits[0].reason).toBe("candidate-started")
  })

  it("falls back to the safety net for ambiguous text", () => {
    h.advance(1000, { interviewer: LOUD })
    h.say("interviewer", "Okay so the next part is about teamwork")
    h.advance(2300, {})
    expect(h.commits).toHaveLength(0)
    h.advance(300, {})
    expect(h.commits).toHaveLength(1)
    expect(h.commits[0].reason).toBe("max-silence")
  })

  it("signals resume when the interviewer keeps talking after a pause", () => {
    h.advance(1000, { interviewer: LOUD })
    h.say("interviewer", "Okay so tell me more")
    h.advance(500, {})
    expect(h.pauses).toHaveLength(1)
    h.advance(300, { interviewer: LOUD })
    expect(h.resumes).toBe(1)
  })

  it("forceCommit answers the current text immediately", () => {
    h.advance(1000, { interviewer: LOUD })
    h.say("interviewer", "And your opinion on")
    expect(h.engine.forceCommit(h.now)).toBe(true)
    expect(h.commits[0]).toMatchObject({ reason: "manual", answerable: true })
    expect(h.engine.forceCommit(h.now)).toBe(false) // nothing pending
  })

  it("amends the previous question when the interviewer adds to it", () => {
    h.advance(1000, { interviewer: LOUD })
    h.say("interviewer", "Em đã làm việc với Kubernetes chưa", "vi")
    h.advance(1000, {})
    expect(h.commits).toHaveLength(1)

    h.advance(800, { interviewer: LOUD })
    h.say("interviewer", "Cụ thể là trên production nhé", "vi")
    h.advance(1000, {})
    expect(h.commits).toHaveLength(2)
    expect(h.commits[1]).toMatchObject({
      amends: true,
      text: "Em đã làm việc với Kubernetes chưa Cụ thể là trên production nhé",
      language: "vi",
    })
  })

  it("starts a new question if the candidate answered in between", () => {
    h.advance(1000, { interviewer: LOUD })
    h.say("interviewer", "Why did you choose Go?")
    h.advance(1000, {})
    h.advance(600, { candidate: LOUD })
    h.say("candidate", "Mostly for the concurrency model")
    h.engine.onEndpoint("candidate")
    h.advance(800, { interviewer: LOUD })
    h.say("interviewer", "And what about Rust?")
    h.advance(1000, {})

    expect(h.candidateTurns).toEqual(["Mostly for the concurrency model"])
    expect(h.commits).toHaveLength(2)
    expect(h.commits[1]).toMatchObject({
      text: "And what about Rust?",
      amends: false,
    })
  })
})
