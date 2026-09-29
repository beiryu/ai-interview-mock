import { scoreCompleteness } from "./completeness"
import { isBackchannel, worthJudging } from "./prefilter"
import { SAME_QUESTION, textSimilarity } from "./similarity"

/**
 * Decides WHEN the interviewer has finished speaking. WHAT they asked is the
 * LLM judge's job (see stores/interview-session.store.ts); its verdicts come
 * back through `onJudge` and can hold a turn open ("not complete yet").
 *
 * Signals:
 *  - voice activity per stream (RMS from the capture worklet)
 *  - streaming transcript + Soniox's semantic `<end>` per stream
 *  - the candidate starting to talk (headphones keep the mic stream clean)
 *
 * Framework-free and clock-injected (`now` + `tick`) so it can be unit-tested
 * with fake time. See lib/turn/turn-engine.test.ts.
 *
 *   listening ──pause──► onPause (judge + hidden draft)
 *       ▲                  │ judge: incomplete ──► waiting (hold)
 *       └──interviewer─────┤ commit rules (see tick)
 *          resumes         ▼
 *                      committed ──resume within amendWindow──► amend
 */

export type Role = "interviewer" | "candidate"

export interface TurnThresholds {
  pauseMs: number
  stableMs: number
  maxSilenceMs: number
  candidateBargeInMs: number
  amendWindowMs: number
}

export type CommitReason =
  | "endpoint"
  | "stable"
  | "candidate-started"
  | "max-silence"
  | "manual"

export type TurnStatus = "idle" | "listening" | "waiting"

/** What the engine needs from a judge verdict */
export interface TurnVerdict {
  isAsk: boolean
  complete: boolean
}

export interface CommittedTurn {
  text: string
  language: string | null
  reason: CommitReason
  /** Interviewer silence when the turn was committed */
  silenceMs: number
  /** True when this extends the previous committed question */
  amends: boolean
  /** False for acknowledgements/filler: record it, don't answer it */
  answerable: boolean
  /** Soniox `<end>` lag for this turn, if an endpoint was seen */
  endpointLagMs: number | null
}

export interface TurnEngineCallbacks {
  /** Live text for a role changed (final + partial) */
  onLive?: (role: Role, text: string, language: string | null) => void
  /** Ask the STT stream to finalize pending words now */
  onFinalizeRequest?: (role: Role) => void
  /** Interviewer paused on something worth answering: judge it + draft */
  onPause?: (text: string, language: string | null) => void
  /** Interviewer resumed: the paused text is stale (drop judge + draft) */
  onResume?: () => void
  /** The interviewer's turn is done */
  onCommit?: (turn: CommittedTurn) => void
  /** The candidate finished an utterance (for the transcript only) */
  onCandidateTurn?: (text: string, language: string | null) => void
  onStatus?: (status: TurnStatus) => void
}

// RMS level above which a 120 ms chunk counts as speech. Speech is usually
// 0.02–0.2; headphone mic noise floors sit well under 0.01.
export const SPEECH_RMS = 0.015

interface Stream {
  finalText: string
  partial: string
  languageChars: Record<string, number>
  speaking: boolean
  speechStartedAt: number | null
  lastSpeechAt: number
  endpointSeen: boolean
  endpointLagMs: number | null
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
    endpointLagMs: null,
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

export class TurnEngine {
  private streams: Record<Role, Stream> = {
    interviewer: emptyStream(),
    candidate: emptyStream(),
  }
  private finalizeSent = false
  /** Text last handed to onPause (null = no pause in progress) */
  private pausedText: string | null = null
  private verdict: { forText: string; verdict: TurnVerdict } | null = null
  private lastCommit: { text: string; at: number } | null = null
  private amending = false
  private status: TurnStatus = "idle"

  constructor(
    private readonly thresholds: TurnThresholds,
    private readonly callbacks: TurnEngineCallbacks = {}
  ) {}

  reset() {
    this.streams = { interviewer: emptyStream(), candidate: emptyStream() }
    this.finalizeSent = false
    this.pausedText = null
    this.verdict = null
    this.lastCommit = null
    this.amending = false
    this.setStatus("idle")
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

    if (speaking && role === "interviewer") this.onInterviewerActivity(now)
    if (speaking && role === "candidate") this.onCandidateActivity()
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

    // New words (not just re-punctuation of the same words) mean speech
    if (textSimilarity(before, after) < 1 && after.length > before.length) {
      stream.lastSpeechAt = Math.max(stream.lastSpeechAt, now)
      stream.endpointSeen = false
      if (role === "interviewer") this.onInterviewerActivity(now)
      if (role === "candidate") this.onCandidateActivity()
    }
  }

  /** Soniox `<end>`: the speaker likely finished an utterance. */
  onEndpoint(role: Role, lagMs: number | null = null) {
    const stream = this.streams[role]
    stream.endpointSeen = true
    stream.endpointLagMs = lagMs
    if (role === "candidate") this.flushCandidate()
  }

  /** Judge verdict for `forText`; ignored if the question moved on. */
  onJudge(forText: string, verdict: TurnVerdict) {
    const current = this.pendingInterviewerText
    if (!current || textSimilarity(forText, current) < SAME_QUESTION) return
    this.verdict = { forText, verdict }
  }

  /** "Answer now": commit whatever the interviewer has said. */
  forceCommit(now: number) {
    const text = this.pendingInterviewerText
    if (!text) return false
    const s = this.streams.interviewer
    this.commit(text, "manual", s.speaking ? 0 : now - s.lastSpeechAt, now)
    return true
  }

  // ─── Clock ─────────────────────────────────────────────────────────────────

  /** Evaluate timing rules; call every ~100 ms. */
  tick(now: number) {
    const s = this.streams.interviewer
    const text = joinText(s.finalText, s.partial)
    if (!text) {
      this.setStatus("idle")
      return
    }

    const silence = s.speaking ? 0 : now - s.lastSpeechAt
    const t = this.thresholds

    if (silence >= t.pauseMs) {
      if (!this.finalizeSent) {
        this.finalizeSent = true
        this.callbacks.onFinalizeRequest?.("interviewer")
      }
      if (
        worthJudging(text) &&
        (this.pausedText === null ||
          textSimilarity(this.pausedText, text) < SAME_QUESTION)
      ) {
        this.pausedText = text
        this.callbacks.onPause?.(text, dominantLanguage(s.languageChars))
      }
    }

    // Judge verdict for this text, if one arrived; otherwise the heuristic
    const verdict =
      this.verdict &&
      textSimilarity(this.verdict.forText, text) >= SAME_QUESTION
        ? this.verdict.verdict
        : null
    const heuristic = scoreCompleteness(text)
    const holding =
      verdict !== null
        ? verdict.isAsk && !verdict.complete
        : heuristic === "incomplete"
    const looksComplete =
      verdict !== null
        ? !verdict.isAsk || verdict.complete
        : heuristic === "complete"

    this.setStatus(silence >= t.pauseMs && holding ? "waiting" : "listening")

    const candidate = this.streams.candidate
    const candidateTalking =
      candidate.speaking &&
      candidate.speechStartedAt !== null &&
      now - candidate.speechStartedAt >= t.candidateBargeInMs

    let reason: CommitReason | null = null
    if (s.endpointSeen && !holding && silence > 0) {
      reason = "endpoint"
    } else if (looksComplete && silence >= t.stableMs) {
      reason = "stable"
    } else if (candidateTalking && silence >= t.pauseMs) {
      reason = "candidate-started"
    } else if (silence >= t.maxSilenceMs) {
      reason = "max-silence"
    }

    if (reason) this.commit(text, reason, silence, now)
  }

  // ─── Internals ─────────────────────────────────────────────────────────────

  private onInterviewerActivity(now: number) {
    // Resumed after a pause: the judged/drafted text is now partial
    if (this.pausedText !== null) {
      this.pausedText = null
      this.callbacks.onResume?.()
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

  private onCandidateActivity() {
    // Once the candidate starts answering, further interviewer speech is a
    // new question rather than an extension of the last one
    this.lastCommit = null
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
    const answerable =
      reason === "manual" || (!isBackchannel(text) && worthJudging(fullText))

    this.callbacks.onCommit?.({
      text: fullText,
      language,
      reason,
      silenceMs,
      amends,
      answerable,
      endpointLagMs: s.endpointSeen ? s.endpointLagMs : null,
    })

    if (answerable) this.lastCommit = { text: fullText, at: now }
    this.amending = false
    this.pausedText = null
    this.verdict = null
    this.finalizeSent = false
    this.streams.interviewer = {
      ...emptyStream(),
      speaking: s.speaking,
      lastSpeechAt: s.lastSpeechAt,
    }
    this.callbacks.onLive?.("interviewer", "", null)
    this.setStatus("idle")
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

  private setStatus(status: TurnStatus) {
    if (status === this.status) return
    this.status = status
    this.callbacks.onStatus?.(status)
  }
}
