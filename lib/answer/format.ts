/**
 * The coach answers as:
 *   headline (≤ 6 words)
 *   - key point [P2, S1]      ← evidence ids from the prep pack, optional
 *   ---
 *   1–3 sentences to say
 * Parses partial (still streaming) output too, and older answers without a
 * headline.
 */

export interface KeyPoint {
  text: string
  /** Evidence ids cited by the point (P*, S*, R*) */
  tags: string[]
}

export interface ParsedAnswer {
  headline: string
  points: KeyPoint[]
  script: string
}

const BULLET = /^[-•*]\s/
const ID = /^[PSR]\d+$/

/** "Cut DB load 60% [P3] [S1, R2]" → text + ["P3", "S1", "R2"] */
export function splitTags(line: string): KeyPoint {
  let text = line.trim()
  const tags: string[] = []
  for (;;) {
    const match = text.match(/\s*\[([^\]]+)\]\s*$/)
    if (!match) break
    const ids = match[1].split(/[,\s]+/).filter(Boolean)
    if (ids.length === 0 || !ids.every((id) => ID.test(id))) break
    tags.unshift(...ids)
    text = text.slice(0, match.index).trimEnd()
  }
  return { text, tags }
}

function cleanHeadline(line: string) {
  return line
    .replace(/^#+\s*/, "")
    .replace(/^\*\*(.*)\*\*$/, "$1")
    .trim()
}

export function splitAnswer(text: string): ParsedAnswer {
  const [head, ...rest] = text.split(/\n\s*---\s*\n?/)
  const hasSeparator = rest.length > 0
  const lines = head
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
  const firstBullet = lines.findIndex((line) => BULLET.test(line))
  const script = rest.join("\n").trim()

  if (!hasSeparator && firstBullet === -1) {
    // Either a headline still streaming, or the model ignored the format
    const single = lines.length === 1 && lines[0].split(/\s+/).length <= 8
    return single && !/[.!?]$/.test(lines[0])
      ? { headline: cleanHeadline(lines[0]), points: [], script: "" }
      : { headline: "", points: [], script: text.trim() }
  }

  const headerLines = firstBullet === -1 ? lines : lines.slice(0, firstBullet)
  const pointLines = firstBullet === -1 ? [] : lines.slice(firstBullet)
  return {
    headline: cleanHeadline(headerLines.join(" ")),
    points: pointLines
      .filter((line) => BULLET.test(line))
      .map((line) => splitTags(line.replace(BULLET, ""))),
    script,
  }
}
