import { INTERVIEW_DEFAULTS } from "./interview"
import { STT_DEFAULTS } from "./stt"

/**
 * One user-facing knob for turn-taking. Each pace sets the turn engine's
 * timing and Soniox's endpointing together, so they can't drift apart.
 */
export const TURN_PACES = ["fast", "balanced", "patient"] as const
export type TurnPace = (typeof TURN_PACES)[number]

export const DEFAULT_TURN_PACE: TurnPace = "balanced"

type Interview = typeof INTERVIEW_DEFAULTS
type Stt = typeof STT_DEFAULTS

interface PacePreset {
  label: string
  description: string
  interview: Pick<
    Interview,
    "pauseMs" | "completeCommitMs" | "turnMaxSilenceMs"
  >
  stt: Pick<Stt, "endpointMaxDelayMs" | "endpointSensitivity">
}

export const TURN_PACE_PRESETS: Record<TurnPace, PacePreset> = {
  fast: {
    label: "Fast",
    description: "Answers as soon as a question sounds finished.",
    interview: { pauseMs: 250, completeCommitMs: 500, turnMaxSilenceMs: 1500 },
    stt: { endpointMaxDelayMs: 1000, endpointSensitivity: 0.5 },
  },
  balanced: {
    label: "Balanced",
    description: "Default. Waits out short thinking pauses.",
    interview: {
      pauseMs: INTERVIEW_DEFAULTS.pauseMs,
      completeCommitMs: INTERVIEW_DEFAULTS.completeCommitMs,
      turnMaxSilenceMs: INTERVIEW_DEFAULTS.turnMaxSilenceMs,
    },
    stt: {
      endpointMaxDelayMs: STT_DEFAULTS.endpointMaxDelayMs,
      endpointSensitivity: STT_DEFAULTS.endpointSensitivity,
    },
  },
  patient: {
    label: "Patient",
    description: "For interviewers who pause mid-question a lot.",
    interview: { pauseMs: 400, completeCommitMs: 1000, turnMaxSilenceMs: 3000 },
    stt: { endpointMaxDelayMs: 2500, endpointSensitivity: 0 },
  },
}

/** Applies a pace on top of the interview/STT defaults. */
export function applyTurnPace<T extends { interview: object; stt: object }>(
  config: T,
  pace: TurnPace
): T {
  const preset = TURN_PACE_PRESETS[pace]
  return {
    ...config,
    interview: { ...config.interview, ...preset.interview },
    stt: { ...config.stt, ...preset.stt },
  }
}
