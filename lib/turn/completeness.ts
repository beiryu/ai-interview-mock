/**
 * Cheap text heuristics for "has the interviewer finished the question?".
 * Used alongside silence timing and Soniox's semantic <end> token; it never
 * commits a turn on its own.
 */

export type Completeness = "complete" | "incomplete" | "unknown"

// Endings that mean the speaker is mid-thought
const INCOMPLETE_ENDINGS = [
  // English
  "and",
  "but",
  "or",
  "so",
  "because",
  "like",
  "the",
  "a",
  "an",
  "to",
  "of",
  "with",
  "for",
  "about",
  "if",
  "when",
  "that",
  "which",
  "um",
  "uh",
  "er",
  "hmm",
  "you know",
  "i mean",
  // Vietnamese
  "và",
  "với",
  "nhưng",
  "hoặc",
  "hay là",
  "thì",
  "là",
  "mà",
  "của",
  "cho",
  "để",
  "khi",
  "nếu",
  "vì",
  "bởi vì",
  "rồi",
  "kiểu",
  "kiểu như",
  "ờ",
  "ừm",
  "à thì",
  "cái",
  "những",
  "các",
]

// Vietnamese question particles / phrases that close a question
const VI_QUESTION_ENDINGS = [
  "không",
  "chưa",
  "à",
  "ạ",
  "nhỉ",
  "nhé",
  "hả",
  "hở",
  "sao",
  "gì",
  "nào",
  "đâu",
  "ai",
  "thế nào",
  "như thế nào",
  "ra sao",
  "bao nhiêu",
  "bao giờ",
  "khi nào",
  "được không",
  "phải không",
  "đúng không",
  "có không",
  "chứ",
]

// Openers of questions / requests (checked at the start of the utterance)
const QUESTION_OPENERS = [
  // English wh-words and auxiliary inversion
  "what",
  "why",
  "how",
  "when",
  "where",
  "which",
  "who",
  "whom",
  "whose",
  "can you",
  "could you",
  "would you",
  "will you",
  "do you",
  "did you",
  "does",
  "have you",
  "has",
  "are you",
  "is there",
  "is it",
  "were you",
  "should",
  // English imperatives interviewers use
  "tell me",
  "tell us",
  "describe",
  "explain",
  "walk me through",
  "walk us through",
  "give me",
  "share",
  "talk about",
  "talk me through",
  // Vietnamese requests
  "hãy",
  "em hãy",
  "bạn hãy",
  "anh hãy",
  "chị hãy",
  "kể",
  "em kể",
  "bạn kể",
  "giải thích",
  "em giải thích",
  "mô tả",
  "cho anh biết",
  "cho chị biết",
  "cho mình biết",
  "cho tôi biết",
  "em có thể",
  "bạn có thể",
  "tại sao",
  "vì sao",
  "làm sao",
  "làm thế nào",
]

function normalize(text: string) {
  return text
    .toLowerCase()
    .replace(/[“”"'`]/g, "")
    .replace(/\s+/g, " ")
    .trim()
}

function endsWithPhrase(text: string, phrases: string[]) {
  const words = text.replace(/[.!…]+$/, "").trim()
  return phrases.some(
    (phrase) => words === phrase || words.endsWith(` ${phrase}`)
  )
}

function startsWithPhrase(text: string, phrases: string[]) {
  return phrases.some(
    (phrase) => text === phrase || text.startsWith(`${phrase} `)
  )
}

export function scoreCompleteness(raw: string): Completeness {
  const text = normalize(raw)
  if (!text) return "unknown"

  // Trailing comma / dash / ellipsis: clearly mid-sentence
  if (/[,;:\-–—]$/.test(text) || /(\.\.\.|…)$/.test(text)) return "incomplete"
  if (endsWithPhrase(text.replace(/[?.!]+$/, ""), INCOMPLETE_ENDINGS)) {
    return "incomplete"
  }

  if (text.endsWith("?")) return "complete"
  if (endsWithPhrase(text, VI_QUESTION_ENDINGS)) return "complete"

  // A question/request opener plus enough words to carry the content
  const wordCount = text.split(" ").length
  if (wordCount >= 4 && startsWithPhrase(text, QUESTION_OPENERS)) {
    return "complete"
  }

  return "unknown"
}
