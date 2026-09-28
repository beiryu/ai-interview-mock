export const INTERVIEW_DEFAULTS = {
  silenceThresholdMs: 5000,
  silenceCheckIntervalMs: 1000,
} as const

export type InterviewDefaults = typeof INTERVIEW_DEFAULTS
