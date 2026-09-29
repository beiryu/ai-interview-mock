import { describe, expect, it } from "vitest"

import { INTERVIEW_DEFAULTS } from "./interview"
import { STT_DEFAULTS } from "./stt"
import { TURN_PACE_PRESETS, applyTurnPace } from "./turn-pace"

const base = { interview: { ...INTERVIEW_DEFAULTS }, stt: { ...STT_DEFAULTS } }

describe("applyTurnPace", () => {
  it("balanced equals the defaults", () => {
    expect(applyTurnPace(base, "balanced")).toEqual(base)
  })

  it("patient waits longer on both the turn engine and Soniox", () => {
    const patient = applyTurnPace(base, "patient")
    expect(patient.interview.completeCommitMs).toBeGreaterThan(
      base.interview.completeCommitMs
    )
    expect(patient.interview.turnMaxSilenceMs).toBeGreaterThan(
      base.interview.turnMaxSilenceMs
    )
    expect(patient.stt.endpointMaxDelayMs).toBeGreaterThan(
      base.stt.endpointMaxDelayMs
    )
    // untouched settings survive
    expect(patient.interview.amendWindowMs).toBe(
      INTERVIEW_DEFAULTS.amendWindowMs
    )
    expect(patient.stt.languageHints).toEqual(STT_DEFAULTS.languageHints)
  })

  it("keeps every preset within Soniox and engine limits", () => {
    for (const preset of Object.values(TURN_PACE_PRESETS)) {
      expect(preset.stt.endpointMaxDelayMs).toBeGreaterThanOrEqual(500)
      expect(preset.stt.endpointMaxDelayMs).toBeLessThanOrEqual(3000)
      expect(Math.abs(preset.stt.endpointSensitivity)).toBeLessThanOrEqual(1)
      expect(preset.interview.pauseMs).toBeLessThan(
        preset.interview.completeCommitMs
      )
      expect(preset.interview.completeCommitMs).toBeLessThan(
        preset.interview.turnMaxSilenceMs
      )
    }
  })
})
