/** Lowercase, NFC, letters/digits only — so punctuation and casing that
 *  Soniox adds on finalization don't make equal questions look different. */
export function normalizeText(text: string) {
  return text
    .normalize("NFC")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
}

/**
 * Token-overlap similarity in [0, 1]: shared words over the longer text's
 * word count. 1 = same words; used to decide whether a draft answer or a
 * judge verdict still applies to the question as it is now.
 */
export function textSimilarity(a: string, b: string) {
  const wordsA = normalizeText(a).split(" ").filter(Boolean)
  const wordsB = normalizeText(b).split(" ").filter(Boolean)
  if (wordsA.length === 0 && wordsB.length === 0) return 1
  if (wordsA.length === 0 || wordsB.length === 0) return 0

  const counts = new Map<string, number>()
  for (const word of wordsA) counts.set(word, (counts.get(word) ?? 0) + 1)
  let shared = 0
  for (const word of wordsB) {
    const left = counts.get(word) ?? 0
    if (left > 0) {
      shared++
      counts.set(word, left - 1)
    }
  }
  return shared / Math.max(wordsA.length, wordsB.length)
}

/** Threshold for "same question" (drafts, judge verdicts). */
export const SAME_QUESTION = 0.75
