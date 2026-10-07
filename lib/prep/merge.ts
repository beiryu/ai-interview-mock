import type { JobPrep, Story } from "./schema"

/**
 * Regeneration keeps what you edited: locked items survive with their ids,
 * fresh items fill in around them with new ids.
 */

function nextIds(prefix: string, kept: { id: string }[]) {
  let n = Math.max(
    0,
    ...kept.map((item) => Number(item.id.slice(prefix.length)) || 0)
  )
  return () => `${prefix}${++n}`
}

function similarTitle(a: string, b: string) {
  const norm = (s: string) =>
    s
      .toLowerCase()
      .replace(/[^\p{L}\p{N}]+/gu, " ")
      .trim()
  return norm(a) === norm(b)
}

/** Locked items first, then generated ones that don't duplicate them. */
export function mergeItems<T extends { id: string; locked?: boolean }>(
  prefix: string,
  previous: T[],
  generated: Omit<T, "id">[],
  sameAs: (a: Omit<T, "id">, b: T) => boolean
): T[] {
  const kept = previous.filter((item) => item.locked)
  const id = nextIds(prefix, kept)
  const fresh = generated
    .filter((item) => !kept.some((k) => sameAs(item, k)))
    .map((item) => ({ ...item, id: id(), locked: false } as T))
  return [...kept, ...fresh]
}

export function mergeStories(
  previous: Story[],
  generated: Omit<Story, "id">[]
) {
  return mergeItems("S", previous, generated, (a, b) =>
    similarTitle(a.title, b.title)
  )
}

export function mergeDoNotClaim(previous: string[], generated: string[]) {
  const seen = new Set<string>()
  return [...previous, ...generated].filter((s) => {
    const key = s.trim().toLowerCase()
    if (!key || seen.has(key)) return false
    seen.add(key)
    return true
  })
}

export function mergeJobPrep(
  previous: JobPrep | null,
  generated: Omit<JobPrep, "requirements" | "stories"> & {
    requirements: Omit<JobPrep["requirements"][number], "id">[]
    stories: Omit<Story, "id">[]
  }
): JobPrep {
  return {
    angle: generated.angle,
    intro: generated.intro,
    requirements: mergeItems(
      "R",
      previous?.requirements ?? [],
      generated.requirements,
      (a, b) => similarTitle(a.text, b.text)
    ),
    stories: mergeStories(previous?.stories ?? [], generated.stories),
    likelyQuestions: [
      ...(previous?.likelyQuestions.filter((q) => q.locked) ?? []),
      ...generated.likelyQuestions.filter(
        (q) =>
          !previous?.likelyQuestions.some(
            (p) => p.locked && similarTitle(p.question, q.question)
          )
      ),
    ],
    doNotClaim: generated.doNotClaim,
  }
}
