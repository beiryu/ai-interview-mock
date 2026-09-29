/**
 * The coach answers as "- point" lines, then "---", then a spoken answer.
 * Parses partial (still streaming) output too.
 */
export function splitAnswer(text: string) {
  const [head, ...rest] = text.split(/\n\s*---\s*\n?/)
  const hasSeparator = rest.length > 0
  const pointLines = head
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
  const looksLikePoints = pointLines.every((line) => /^[-•*]\s/.test(line))

  if (!hasSeparator && !looksLikePoints) {
    // Model ignored the format: show it all as the spoken answer
    return { points: [], script: text.trim() }
  }
  return {
    points: pointLines.map((line) => line.replace(/^[-•*]\s*/, "")),
    script: rest.join("\n").trim(),
  }
}
