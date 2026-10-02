import { splitAnswer } from "./format"

/**
 * Cheap, deterministic checks on a finished answer (no model call, ~0 ms):
 * flags what the candidate should double-check before saying it.
 */

export interface AnswerIssue {
  kind: "unknown-id" | "unsupported-number" | "never-claim"
  detail: string
}

const NEGATION =
  /\b(not|never|no|haven't|hasn't|didn't|don't|without|yet to|chưa|không|chẳng)\b/i

// Numbers worth checking: percentages, amounts, counts with units, years
const NUMBER =
  /(\d+(?:[.,]\d+)?)\s?(%|x\b|lần|triệu|tr\b|k\b|m\b|million|users?|người|requests?|rps|ms\b|giây|seconds?|years?|năm|months?|tháng|members?|engineers?)|\b(19|20)\d{2}\b/gi

function withoutPlaceholders(text: string) {
  return text.replace(/\[(?:fill in|điền)[^\]]*\]/gi, " ")
}

/** "60" appears in the source as a standalone number. */
function sourceHasNumber(source: string, value: string) {
  const escaped = value.replace(/[.,]/g, "[.,]")
  return new RegExp(`(^|[^\\d.,])${escaped}(?![\\d])`).test(source)
}

/** First word of a never-claim entry: "Kafka in production" → "Kafka". */
function claimKeyword(entry: string) {
  return entry.trim().split(/[\s,(/]+/)[0] ?? ""
}

export function validateAnswer({
  answer,
  knownIds,
  source,
  doNotClaim,
}: {
  answer: string
  /** Ids in the prep pack; empty = no prep, skip the id check */
  knownIds: Set<string>
  /** Everything the answer may draw facts from (brief, conversation, question) */
  source: string
  doNotClaim: string[]
}): AnswerIssue[] {
  const issues: AnswerIssue[] = []
  const { points } = splitAnswer(answer)

  if (knownIds.size > 0) {
    const unknown = new Set(
      points.flatMap((p) => p.tags).filter((id) => !knownIds.has(id))
    )
    for (const id of unknown) {
      issues.push({ kind: "unknown-id", detail: `${id} is not in your prep` })
    }
  }

  const text = withoutPlaceholders(answer)
  const seen = new Set<string>()
  for (const match of text.matchAll(NUMBER)) {
    const value = match[1] ?? match[0]
    if (seen.has(value)) continue
    seen.add(value)
    if (!sourceHasNumber(source, value)) {
      issues.push({
        kind: "unsupported-number",
        detail: `"${match[0].trim()}" isn't in your documents`,
      })
    }
  }

  const sentences = text.split(/(?<=[.!?\n])\s+/)
  for (const entry of doNotClaim) {
    const keyword = claimKeyword(entry)
    if (keyword.length < 2) continue
    const pattern = new RegExp(
      `\\b${keyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`,
      "i"
    )
    const claimed = sentences.some((s) => pattern.test(s) && !NEGATION.test(s))
    if (claimed) {
      issues.push({
        kind: "never-claim",
        detail: `mentions ${entry} (on your never-claim list)`,
      })
    }
  }

  return issues
}
