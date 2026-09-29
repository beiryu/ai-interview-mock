// Turn-taking thresholds used by lib/turn/turn-engine.ts (all in ms)
export const INTERVIEW_DEFAULTS = {
  // Interviewer silence that counts as a pause: finalize + speculate an answer
  pauseMs: 300,
  // Commit a clearly complete question after this much silence
  completeCommitMs: 700,
  // Commit whatever was said after this much silence
  turnMaxSilenceMs: 2000,
  // Candidate speech this long (after an interviewer pause) ends the question
  candidateBargeInMs: 250,
  // Interviewer speech this soon after a commit extends that question
  amendWindowMs: 3000,
}

export type InterviewDefaults = typeof INTERVIEW_DEFAULTS
