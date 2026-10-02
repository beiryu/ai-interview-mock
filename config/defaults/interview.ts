// Turn-taking thresholds used by lib/turn/turn-engine.ts (all in ms).
// Timing comes mostly from Soniox's semantic <end>; these are the local
// signals and safety nets around it.
export const INTERVIEW_DEFAULTS = {
  // Interviewer silence that counts as a pause: finalize, judge + draft
  pauseMs: 300,
  // Commit after this much silence when the question looks complete
  // (judge said complete, or the heuristic did while the judge is pending)
  stableMs: 900,
  // Commit whatever was said after this much silence (safety net)
  maxSilenceMs: 2500,
  // Candidate speech this long (after an interviewer pause) ends the question
  candidateBargeInMs: 250,
  // Interviewer speech this soon after a commit extends that question
  amendWindowMs: 3000,
}

export type InterviewDefaults = typeof INTERVIEW_DEFAULTS
