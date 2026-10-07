import type { CvContent } from "./schema"

/**
 * The CV as text for prompts: ids (B*) with the source bullets they come
 * from, and
 * for each stretch what it adds and how to answer if asked. Deterministic,
 * so it can sit in the cached part of the coach's prompt.
 */
export function cvBlock(cv: CvContent) {
  const lines = [`Headline: ${cv.headline}`, `Summary: ${cv.summary}`]
  if (cv.summaryStretch) {
    lines.push(
      `  stretch: ${cv.summaryStretch.note}${
        cv.summaryStretch.defense
          ? ` — if asked: ${cv.summaryStretch.defense}`
          : ""
      }`
    )
  }
  if (cv.skills.length) {
    lines.push(
      `Skills: ${cv.skills
        .map((g) => `${g.group}: ${g.items.join(", ")}`)
        .join(" | ")}`
    )
  }
  for (const e of cv.experience) {
    lines.push(`${e.id} ${e.role} — ${e.company} (${e.period})`)
    for (const b of e.bullets) {
      const from = b.sourceIds.length ? ` (from ${b.sourceIds.join(", ")})` : ""
      lines.push(`  ${b.id} ${b.text}${from}`)
      if (b.stretch) {
        lines.push(
          `     stretch: ${b.stretch.note}${
            b.stretch.defense ? ` — if asked: ${b.stretch.defense}` : ""
          }`
        )
      }
    }
  }
  for (const ed of cv.education) {
    lines.push(
      `Education: ${[ed.degree, ed.school, ed.period, ed.note]
        .filter(Boolean)
        .join(", ")}`
    )
  }
  if (cv.learning.length) {
    lines.push(
      `Gaps for this job (not on the CV; be honest if asked): ${cv.learning.join(
        ", "
      )}`
    )
  }
  return lines.join("\n")
}
