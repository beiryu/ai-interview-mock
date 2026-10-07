import { normalizeText } from "./similarity"

/**
 * Free checks run before any LLM call, so acknowledgements and filler never
 * cost a judge call or show an answer card.
 */

// Whole-utterance acknowledgements / backchannels (normalized form)
const BACKCHANNELS = new Set([
  // English
  "ok",
  "okay",
  "ok great",
  "okay great",
  "great",
  "cool",
  "nice",
  "good",
  "yes",
  "yeah",
  "yep",
  "right",
  "sure",
  "alright",
  "all right",
  "i see",
  "got it",
  "mm hm",
  "mhm",
  "uh huh",
  "hmm",
  "um",
  "uh",
  "thanks",
  "thank you",
  "interesting",
  "makes sense",
  "that makes sense",
  "perfect",
  "awesome",
  // Vietnamese
  "ừ",
  "ừm",
  "ờ",
  "à",
  "vâng",
  "dạ",
  "ok em",
  "được",
  "được rồi",
  "đúng rồi",
  "đúng",
  "hay",
  "hay đấy",
  "tốt",
  "tốt lắm",
  "cảm ơn",
  "cảm ơn em",
  "cảm ơn bạn",
  "ok cảm ơn em",
  "ừ được",
  "à ok",
  "à vâng",
  "à ừ",
])

// Words that make even a short utterance a likely question
const QUESTION_WORDS = [
  "what",
  "why",
  "how",
  "when",
  "where",
  "which",
  "who",
  "tell",
  "describe",
  "explain",
  "gì",
  "sao",
  "nào",
  "đâu",
  "ai",
  "không",
  "chưa",
  "bao",
  "tại",
  "kể",
  "giải",
  "thế",
]

// Every word that appears in a backchannel phrase ("yeah", "right", "ừ", …)
const BACKCHANNEL_WORDS = new Set(
  [...BACKCHANNELS].flatMap((phrase) => phrase.split(" "))
)

/** The whole utterance is acknowledgement words ("Yeah, right", "Ừ được"). */
export function isBackchannel(text: string) {
  const normalized = normalizeText(text)
  if (!normalized) return true
  if (BACKCHANNELS.has(normalized)) return true
  const words = normalized.split(" ")
  // "You see?" / "Is that right?" read as questions even if every word
  // could be an acknowledgement
  if (text.includes("?") && words.length > 1) return false
  return words.every((word) => BACKCHANNEL_WORDS.has(word))
}

/** Worth an LLM judge call: substantive, or clearly question-shaped. */
export function worthJudging(text: string) {
  if (isBackchannel(text)) return false
  if (text.includes("?")) return true
  const words = normalizeText(text).split(" ").filter(Boolean)
  if (words.length >= 4) return true
  return words.some((word) => QUESTION_WORDS.includes(word))
}
