import { beforeEach, describe, expect, it } from "vitest"

import { INTERVIEW_DEFAULTS } from "@/config/defaults/interview"

import { TurnEngine, type CommittedTurn } from "./turn-engine"

const LOUD = 0.1
const QUIET = 0.001

/** Drives the engine like the app does: 120 ms audio chunks + 100 ms ticks. */
class Harness {
  now = 0
  commits: CommittedTurn[] = []
  speculations: string[] = []
  cancels = 0
  finalizes = 0
  candidateTurns: string[] = []
  engine = new TurnEngine(INTERVIEW_DEFAULTS, {
    onCommit: (turn) => this.commits.push(turn),
    onSpeculate: (text) => this.speculations.push(text),
    onCancelSpeculation: () => this.cancels++,
    onFinalizeRequest: () => this.finalizes++,
    onCandidateTurn: (text) => this.candidateTurns.push(text),
  })

  /** Advance time, feeding audio levels for both roles every 20 ms. */
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

  it("commits a complete question ~700 ms after the interviewer stops", () => {
    h.advance(1500, { interviewer: LOUD })
    h.say("interviewer", "Can you walk me through your last project?")
    h.advance(1000, {})

    expect(h.commits).toHaveLength(1)
    expect(h.commits[0]).toMatchObject({
      text: "Can you walk me through your last project?",
      reason: "complete-pause",
      amends: false,
    })
    expect(h.commits[0].silenceMs).toBeLessThanOrEqual(800)
    // it speculated at the first pause and asked the STT to finalize
    expect(h.speculations).toEqual([
      "Can you walk me through your last project?",
    ])
    expect(h.finalizes).toBe(1)
  })

  it("does not cut a question at a mid-sentence thinking pause", () => {
    h.advance(1000, { interviewer: LOUD })
    h.say("interviewer", "Tell me about a time when you and")
    h.advance(1500, {}) // thinking pause, below the 2 s max
    expect(h.commits).toHaveLength(0)
    expect(h.speculations).toHaveLength(0) // incomplete text is not speculated

    h.advance(800, { interviewer: LOUD })
    h.say("interviewer", " your team disagreed?")
    h.advance(1000, {})
    expect(h.commits).toHaveLength(1)
    expect(h.commits[0].text).toBe(
      "Tell me about a time when you and your team disagreed?"
    )
  })

  it("commits on Soniox <end> when the text is not incomplete", () => {
    h.advance(1000, { interviewer: LOUD })
    h.say("interviewer", "Okay so tell me more", "en")
    h.advance(200, {})
    h.engine.onEndpoint("interviewer")
    h.advance(100, {})
    expect(h.commits).toHaveLength(1)
    expect(h.commits[0].reason).toBe("endpoint")
  })

  it("commits when the candidate starts answering", () => {
    h.advance(1000, { interviewer: LOUD })
    h.say("interviewer", "Okay great")
    h.advance(400, {})
    h.advance(400, { candidate: LOUD })
    expect(h.commits).toHaveLength(1)
    expect(h.commits[0].reason).toBe("candidate-started")
  })

  it("falls back to max silence for ambiguous text", () => {
    h.advance(1000, { interviewer: LOUD })
    h.say("interviewer", "Okay great")
    h.advance(1900, {})
    expect(h.commits).toHaveLength(0)
    h.advance(300, {})
    expect(h.commits).toHaveLength(1)
    expect(h.commits[0].reason).toBe("max-silence")
  })

  it("cancels the speculative answer when the interviewer resumes", () => {
    h.advance(1000, { interviewer: LOUD })
    h.say("interviewer", "Okay great")
    h.advance(500, {})
    expect(h.speculations).toHaveLength(1)
    h.advance(300, { interviewer: LOUD })
    expect(h.cancels).toBe(1)
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
    expect(h.commits[1].amends).toBe(true)
    expect(h.commits[1].text).toBe(
      "Em đã làm việc với Kubernetes chưa Cụ thể là trên production nhé"
    )
    expect(h.commits[1].language).toBe("vi")
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
