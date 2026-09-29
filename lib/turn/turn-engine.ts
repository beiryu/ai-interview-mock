import { scoreCompleteness } from "./completeness"

/**
 * Decides when the interviewer has finished a question, from three signals:
 *  - voice activity per stream (RMS from the capture worklet)
 *  - streaming transcript + Soniox's semantic `<end>` endpoint per stream
 *  - the candidate starting to talk (headphones keep the mic stream clean)
 *
 * Framework-free and clock-injected (`now` arguments + `tick`) so it can be
 * unit-tested with fake time. See lib/turn/turn-engine.test.ts.
 *
 * Interviewer lifecycle:
 *   speaking ──pause──► speculate (answer generated hidden)
 *        ▲                  │ commit rules (see tick)
 *        └──resume/cancel───┤
 *                           ▼
 *                       committed ──resume within amendWindow──► amend
 */

export type Role = "interviewer" | "candidate"

export interface TurnThresholds {
  pauseMs: number
  completeCommitMs: number
  turnMaxSilenceMs: number
  candidateBargeInMs: number
  amendWindowMs: number
}

export type CommitReason =
  | "endpoint"
  | "complete-pause"
  | "candidate-started"
  | "max-silence"

export interface CommittedTurn {
  text: string
  language: string | null
  reason: CommitReason
  /** Interviewer silence when the turn was committed */
  silenceMs: number
  /** True when this extends the previous committed question */
  amends: boolean
}

export interface TurnEngineCallbacks {
  /** Live text for a role changed (final + partial) */
  onLive?: (role: Role, text: string, language: string | null) => void
  /** Ask the STT stream to finalize pending words now */
  onFinalizeRequest?: (role: Role) => void
  /** Interviewer paused: start generating an answer for `text`, hidden */
  onSpeculate?: (text: string, language: string | null) => void
  /** Interviewer resumed before commit: drop the speculative answer */
  onCancelSpeculation?: () => void
  /** The interviewer's question is done */
  onCommit?: (turn: CommittedTurn) => void
  /** The candidate finished an utterance (for the transcript only) */
  onCandidateTurn?: (text: string, language: string | null) => void
}

// RMS level above which a 120 ms chunk counts as speech. Speech is usually
// 0.02–0.2; headphone mic noise floors sit well under 0.01.
const SPEECH_RMS = 0.015

interface Stream {
  finalText: string
  partial: string
  languageChars: Record<string, number>
  speaking: boolean
  speechStartedAt: number | null
  lastSpeechAt: number
  endpointSeen: boolean
}

function emptyStream(): Stream {
  return {
    finalText: "",
    partial: "",
    languageChars: {},
    speaking: false,
    speechStartedAt: null,
    lastSpeechAt: 0,
    endpointSeen: false,
  }
}

function joinText(a: string, b: string) {
  return `${a}${b}`.replace(/\s+/g, " ").trim()
}

function dominantLanguage(chars: Record<string, number>) {
  let best: string | null = null
  let bestCount = 0
  for (const [language, count] of Object.entries(chars)) {
    if (count > bestCount) {
      best = language
      bestCount = count
    }
  }
  return best
}

function normalizeForCompare(text: string) {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, "")
    .replace(/\s+/g, " ")
    .trim()
}

export class TurnEngine {
  private streams: Record<Role, Stream> = {
    interviewer: emptyStream(),
    candidate: emptyStream(),
  }
  private finalizeSent = false
  private speculatedText: string | null = null
  private lastCommit: { text: string; at: number } | null = null
  private amending = false

  constructor(
    private thresholds: TurnThresholds,
    private readonly callbacks: TurnEngineCallbacks = {}
  ) {}

  setThresholds(thresholds: TurnThresholds) {
    this.thresholds = thresholds
  }

  reset() {
    this.streams = { interviewer: emptyStream(), candidate: emptyStream() }
    this.finalizeSent = false
    this.speculatedText = null
    this.lastCommit = null
    this.amending = false
  }

  /** Current interviewer text (final + partial) not yet committed. */
  get pendingInterviewerText() {
    const s = this.streams.interviewer
    return joinText(s.finalText, s.partial)
  }

  // ─── Inputs ────────────────────────────────────────────────────────────────

  /** One capture chunk's level for a role. */
  onAudioLevel(role: Role, rms: number, now: number) {
    const stream = this.streams[role]
    const speaking = rms >= SPEECH_RMS
    if (speaking) {
      if (!stream.speaking) stream.speechStartedAt = now
      stream.lastSpeechAt = now
    } else {
      stream.speechStartedAt = null
    }
    stream.speaking = speaking

    if (role === "interviewer" && speaking) this.onInterviewerActivity(now)
    if (role === "candidate" && speaking) this.onCandidateActivity()
  }

  /** Transcript update from the role's STT stream. */
  onTranscript(
    role: Role,
    update: {
      finalChunk: string
      partial: string
      languageChars: Record<string, number>
    },
    now: number
  ) {
    const stream = this.streams[role]
    const before = joinText(stream.finalText, stream.partial)

    stream.finalText += update.finalChunk
    stream.partial = update.partial
    for (const [language, count] of Object.entries(update.languageChars)) {
      stream.languageChars[language] =
        (stream.languageChars[language] ?? 0) + count
    }

    const after = joinText(stream.finalText, stream.partial)
    this.callbacks.onLive?.(role, after, dominantLanguage(stream.languageChars))

    // New words (not just a finalization of the same words) mean speech
    const grew =
      normalizeForCompare(after).length > normalizeForCompare(before).length
    if (grew) {
      stream.lastSpeechAt = Math.max(stream.lastSpeechAt, now)
      stream.endpointSeen = false
      if (role === "interviewer") this.onInterviewerActivity(now)
      if (role === "candidate") this.onCandidateActivity()
    }
  }

  /** Soniox `<end>`: the speaker likely finished an utterance. */
  onEndpoint(role: Role) {
    this.streams[role].endpointSeen = true
    if (role === "candidate") this.flushCandidate()
  }

  // ─── Clock ─────────────────────────────────────────────────────────────────

  /** Evaluate timing rules; call every ~100 ms. */
  tick(now: number) {
    const s = this.streams.interviewer
    const text = joinText(s.finalText, s.partial)
    if (!text) return

    const silence = s.speaking ? 0 : now - s.lastSpeechAt
    const t = this.thresholds
    const completeness = scoreCompleteness(text)

    if (silence >= t.pauseMs) {
      if (!this.finalizeSent) {
        this.finalizeSent = true
        this.callbacks.onFinalizeRequest?.("interviewer")
      }
      if (
        completeness !== "incomplete" &&
        (this.speculatedText === null ||
          normalizeForCompare(this.speculatedText) !==
            normalizeForCompare(text))
      ) {
        if (this.speculatedText !== null) this.callbacks.onCancelSpeculation?.()
        this.speculatedText = text
        this.callbacks.onSpeculate?.(text, dominantLanguage(s.languageChars))
      }
    }

    const candidate = this.streams.candidate
    const candidateTalking =
      candidate.speaking &&
      candidate.speechStartedAt !== null &&
      now - candidate.speechStartedAt >= t.candidateBargeInMs

    let reason: CommitReason | null = null
    if (s.endpointSeen && completeness !== "incomplete" && silence > 0) {
      reason = "endpoint"
    } else if (completeness === "complete" && silence >= t.completeCommitMs) {
      reason = "complete-pause"
    } else if (candidateTalking && silence >= t.pauseMs) {
      reason = "candidate-started"
    } else if (silence >= t.turnMaxSilenceMs) {
      reason = "max-silence"
    }

    if (reason) this.commit(text, reason, silence, now)
  }

  // ─── Internals ─────────────────────────────────────────────────────────────

  private onInterviewerActivity(now: number) {
    // Resumed after a pause: the speculative answer is for a partial question
    if (this.speculatedText !== null) {
      this.speculatedText = null
      this.callbacks.onCancelSpeculation?.()
    }
    this.finalizeSent = false

    // Speaking again right after a commit: treat it as the same question
    if (
      !this.amending &&
      this.lastCommit &&
      this.streams.interviewer.finalText === "" &&
      now - this.lastCommit.at <= this.thresholds.amendWindowMs
    ) {
      this.amending = true
    }

    // The candidate's utterance is over once the interviewer talks
    this.flushCandidate()
  }

  private commit(
    text: string,
    reason: CommitReason,
    silenceMs: number,
    now: number
  ) {
    const s = this.streams.interviewer
    const language = dominantLanguage(s.languageChars)
    const amends = this.amending && this.lastCommit !== null
    const fullText = amends ? joinText(`${this.lastCommit!.text} `, text) : text

    this.callbacks.onCommit?.({
      text: fullText,
      language,
      reason,
      silenceMs,
      amends,
    })

    this.lastCommit = { text: fullText, at: now }
    this.amending = false
    this.speculatedText = null
    this.finalizeSent = false
    this.streams.interviewer = {
      ...emptyStream(),
      speaking: s.speaking,
      lastSpeechAt: s.lastSpeechAt,
    }
    this.callbacks.onLive?.("interviewer", "", null)
  }

  private onCandidateActivity() {
    // Once the candidate starts answering, further interviewer speech is a
    // new question rather than an extension of the last one
    this.lastCommit = null
  }

  private flushCandidate() {
    const c = this.streams.candidate
    const text = joinText(c.finalText, c.partial)
    if (!text) return
    this.callbacks.onCandidateTurn?.(text, dominantLanguage(c.languageChars))
    this.streams.candidate = {
      ...emptyStream(),
      speaking: c.speaking,
      speechStartedAt: c.speechStartedAt,
      lastSpeechAt: c.lastSpeechAt,
    }
    this.callbacks.onLive?.("candidate", "", null)
  }
}
