import type { Fact, InterviewPrep, ProfilePrep, Story } from "./schema"

/**
 * Regeneration keeps what the candidate edited: locked items survive with
 * their ids, fresh items fill in around them with new ids. Personal answers
 * are the candidate's — a generated value only fills an empty field.
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

export function mergeFacts(previous: Fact[], generated: Omit<Fact, "id">[]) {
  return mergeItems("P", previous, generated, (a, b) =>
    similarTitle(a.title, b.title)
  )
}

export function mergeStories(
  previous: Story[],
  generated: Omit<Story, "id">[]
) {
  return mergeItems("S", previous, generated, (a, b) =>
    similarTitle(a.title, b.title)
  )
}

export function mergePersonal(
  previous: ProfilePrep["personal"] | undefined,
  generated: ProfilePrep["personal"]
): ProfilePrep["personal"] {
  if (!previous) return generated
  const edited = new Set(previous.edited ?? [])
  const merged = { ...previous }
  for (const key of Object.keys(generated) as (keyof typeof generated)[]) {
    if (key === "edited" || edited.has(key)) continue
    const value = generated[key]
    // A fresh generated value replaces an old generated one; blanks never
    // wipe what is there
    if (typeof value === "string" && value.trim()) merged[key] = value
  }
  return merged
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

export function mergeInterviewPrep(
  previous: InterviewPrep | null,
  generated: Omit<InterviewPrep, "requirements"> & {
    requirements: Omit<InterviewPrep["requirements"][number], "id">[]
  }
): InterviewPrep {
  return {
    angle: generated.angle,
    requirements: mergeItems(
      "R",
      previous?.requirements ?? [],
      generated.requirements,
      (a, b) => similarTitle(a.text, b.text)
    ),
    likelyQuestions: [
      ...(previous?.likelyQuestions.filter((q) => q.locked) ?? []),
      ...generated.likelyQuestions.filter(
        (q) =>
          !previous?.likelyQuestions.some(
            (p) => p.locked && similarTitle(p.question, q.question)
          )
      ),
    ],
  }
}
