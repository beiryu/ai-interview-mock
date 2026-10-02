import type { TailoredCv } from "./schema"

/**
 * The CV as text for prompts: ids (B*) with their source facts (P*), and
 * for each stretch what it adds and how to answer if asked. Deterministic,
 * so it can sit in the cached part of the coach's prompt.
 */
export function cvBlock(cv: TailoredCv) {
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
    lines.push(`${e.role} — ${e.company} (${e.period})`)
    for (const b of e.bullets) {
      const facts = b.factIds.length ? ` (${b.factIds.join(", ")})` : ""
      lines.push(`  ${b.id} ${b.text}${facts}`)
      if (b.stretch) {
        lines.push(
          `     stretch: ${b.stretch.note}${
            b.stretch.defense ? ` — if asked: ${b.stretch.defense}` : ""
          }`
        )
      }
    }
  }
  if (cv.learning.length)
    lines.push(`Currently learning: ${cv.learning.join(", ")}`)
  return lines.join("\n")
}
