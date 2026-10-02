import type { Fact } from "@/lib/prep/schema"

import type { CvBullet, TailoredCv } from "./schema"

/**
 * Code checks on a generated CV, so the rules don't rest on the prompt
 * alone: what the model added beyond your documents is either dropped
 * (unknown companies, unknown fact ids) or flagged as a stretch for you to
 * approve (unsourced numbers or technology words, bullets with no fact
 * behind them). Skills your documents never mention become gaps.
 */

function mentions(text: string, term: string) {
  const escaped = term
    .trim()
    .toLowerCase()
    .replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
  if (!escaped) return false
  return new RegExp(`(^|[^a-z0-9])${escaped}([^a-z0-9]|$)`).test(text)
}

/** Also matches the singular ("WebSockets" ↔ "websocket"). */
function mentionsLoosely(text: string, term: string) {
  return mentions(text, term) || mentions(text, term.replace(/s$/i, ""))
}

const NUMBER = /\d+(?:[.,]\d+)?/g

function unsourcedNumbers(text: string, source: string) {
  return [...new Set(text.match(NUMBER) ?? [])].filter(
    (n) =>
      !new RegExp(`(^|[^\\d.,])${n.replace(/[.,]/g, "[.,]")}(?![\\d])`).test(
        source
      )
  )
}

// Technology-like words: capitalized or with ., #, + (Spring, Boot,
// Next.js, C#). The first word of a line is its verb ("Built …"): skipped.
const TERM = /\b[A-Z][A-Za-z0-9.#+-]*|\b[a-z]+\.(?:js|ts)\b/g
const ACRONYM = /^[A-Z]{2,5}s?$/
// Role and CV words, not claims about a technology
const GENERIC = new Set(
  [
    "developer",
    "engineer",
    "software",
    "full-stack",
    "fullstack",
    "frontend",
    "front-end",
    "backend",
    "back-end",
    "senior",
    "junior",
    "mid-level",
    "lead",
    "web",
    "mobile",
    "cloud",
    "experience",
    "experienced",
    "proven",
    "skilled",
    "seeking",
    "specializing",
    "with",
    "and",
    "in",
  ].map((w) => w.toLowerCase())
)

/** Technology words in `text` your documents never mention ("Boot"). */
export function unsourcedTerms(text: string, docs: string) {
  const first = text.trim().match(/^[^\s,.:;]+/)?.[0]
  return [
    ...new Set((text.match(TERM) ?? []).map((w) => w.replace(/[.,:;]+$/, ""))),
  ].filter(
    (term) =>
      term !== first &&
      term.length > 1 &&
      // Generic acronyms (API, UIs, REST, MVP) aren't claims
      !ACRONYM.test(term) &&
      !GENERIC.has(term.toLowerCase()) &&
      !mentionsLoosely(docs, term)
  )
}

/**
 * "MySQL (production-level)", "Redux/Zustand", "Python FastAPI": every part
 * is known — as a phrase, or word by word (the CV may list them apart).
 */
function knownSkill(docs: string, item: string) {
  const parts = item
    .replace(/\([^)]*\)/g, " ")
    .split(/[/,&]| and /)
    .map((part) => part.trim())
    .filter(Boolean)
  const knownWord = (word: string) =>
    ACRONYM.test(word) ||
    GENERIC.has(word.toLowerCase()) ||
    mentionsLoosely(docs, word)
  return (
    parts.length > 0 &&
    parts.every(
      (part) =>
        mentionsLoosely(docs, part) || part.split(/\s+/).every(knownWord)
    )
  )
}

function flag(bullet: CvBullet, note: string): CvBullet {
  if (bullet.stretch) {
    return {
      ...bullet,
      stretch: {
        ...bullet.stretch,
        note: `${bullet.stretch.note}; ${note}`,
        approved: false,
      },
    }
  }
  return { ...bullet, stretch: { note, defense: "", approved: false } }
}

export function checkCv(
  cv: TailoredCv,
  facts: Fact[],
  documents: string
): TailoredCv {
  const docs = documents.toLowerCase()
  const factIds = new Set(facts.map((f) => f.id))

  const experience = cv.experience
    // A company that isn't in your documents is invented: drop it
    .filter((e) => mentions(docs, e.company))
    .map((e) => ({
      ...e,
      bullets: e.bullets.map((b) => {
        let bullet: CvBullet = {
          ...b,
          factIds: b.factIds.filter((id) => factIds.has(id)),
        }
        if (bullet.factIds.length === 0) {
          bullet = flag(bullet, "No source fact behind this bullet")
        }
        const numbers = unsourcedNumbers(bullet.text, documents)
        if (numbers.length) {
          bullet = flag(bullet, `Number not in your CV: ${numbers.join(", ")}`)
        }
        const terms = unsourcedTerms(bullet.text, docs)
        if (terms.length) {
          bullet = flag(bullet, `Not in your CV: ${terms.join(", ")}`)
        }
        return bullet
      }),
    }))

  const gaps: string[] = []
  const skills = cv.skills
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => {
        if (knownSkill(docs, item)) return true
        gaps.push(item)
        return false
      }),
    }))
    .filter((group) => group.items.length > 0)

  // The headline and summary get the same technology-word check
  const summaryTerms = unsourcedTerms(`${cv.headline}. ${cv.summary}`, docs)
  const summaryStretch =
    summaryTerms.length === 0
      ? cv.summaryStretch
      : {
          note: [
            cv.summaryStretch?.note,
            `Not in your CV: ${summaryTerms.join(", ")}`,
          ]
            .filter(Boolean)
            .join("; "),
          defense: cv.summaryStretch?.defense ?? "",
          approved: false,
        }

  return {
    ...cv,
    summaryStretch,
    skills,
    experience,
    // Gaps for this job (shown to you and the coach, never printed): only
    // what your documents really don't have
    learning: [
      ...new Set([
        ...cv.learning.filter((item) => !knownSkill(docs, item)),
        ...gaps,
      ]),
    ],
  }
}

/** E1, E2… and B1, B2… across the whole CV (ids are what answers cite). */
export function assignCvIds(cv: TailoredCv): TailoredCv {
  let bullet = 0
  return {
    ...cv,
    experience: cv.experience.map((e, i) => ({
      ...e,
      id: `E${i + 1}`,
      bullets: e.bullets.map((b) => ({ ...b, id: `B${++bullet}` })),
    })),
  }
}

/**
 * Regeneration keeps what you decided: bullets you edited (locked) stay in
 * their experience, and a stretch you approved stays approved when the same
 * text comes back.
 */
export function mergeCv(
  previous: TailoredCv | null,
  generated: TailoredCv
): TailoredCv {
  if (!previous) return assignCvIds(generated)
  const key = (company: string, role: string) =>
    `${company}|${role}`.toLowerCase()
  const approved = new Set(
    previous.experience.flatMap((e) =>
      e.bullets
        .filter((b) => b.stretch?.approved)
        .map((b) => b.text.trim().toLowerCase())
    )
  )

  const experience = generated.experience.map((e) => {
    const before = previous.experience.find(
      (p) => key(p.company, p.role) === key(e.company, e.role)
    )
    const locked = before?.bullets.filter((b) => b.locked) ?? []
    const fresh = e.bullets
      .filter(
        (b) =>
          !locked.some(
            (l) => l.text.trim().toLowerCase() === b.text.trim().toLowerCase()
          )
      )
      .map((b) =>
        b.stretch && approved.has(b.text.trim().toLowerCase())
          ? { ...b, stretch: { ...b.stretch, approved: true } }
          : b
      )
    return { ...e, bullets: [...locked, ...fresh] }
  })
  // Experiences you kept edits in, which the new run left out
  for (const p of previous.experience) {
    const locked = p.bullets.filter((b) => b.locked)
    if (
      locked.length &&
      !experience.some((e) => key(e.company, e.role) === key(p.company, p.role))
    ) {
      experience.push({ ...p, bullets: locked })
    }
  }
  return assignCvIds({ ...generated, experience })
}
