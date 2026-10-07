import { z } from "zod"

/**
 * A CV, structured. One shape for every CV:
 *  - UPLOADED: your CV as uploaded (parsed, wording kept)
 *  - REFINED: rewritten from another CV for one job. Bullets point to the
 *    bullets they come from (sourceIds); wording beyond the source is a
 *    "stretch" with what to say if asked, approved by you before export
 *  - GENERATED: written from a job description alone, a fictional practice
 *    persona (its PDF is marked fictional on every page)
 * Ids (E1, B3) are what live answers cite.
 */

export const CV_ORIGINS = ["UPLOADED", "REFINED", "GENERATED"] as const
export type CvOrigin = (typeof CV_ORIGINS)[number]

export const CV_ORIGIN_LABEL: Record<CvOrigin, string> = {
  UPLOADED: "Uploaded",
  REFINED: "Refined for a job",
  GENERATED: "Practice persona",
}

export const ContactSchema = z.object({
  name: z.string(),
  email: z.string(),
  phone: z.string(),
  location: z.string(),
  links: z.array(z.string()),
})

export const EMPTY_CONTACT: Contact = {
  name: "",
  email: "",
  phone: "",
  location: "",
  links: [],
}

export const StretchSchema = z.object({
  /** What the wording adds beyond the source */
  note: z.string(),
  /** 1–2 honest sentences to say if the interviewer digs into it */
  defense: z.string(),
  approved: z.boolean(),
})

export const CvBulletSchema = z.object({
  id: z.string(),
  text: z.string(),
  /** Bullets of the CV this one is based on (REFINED only) */
  sourceIds: z.array(z.string()).default([]),
  stretch: StretchSchema.nullable(),
  locked: z.boolean().optional(),
})

export const CvExperienceSchema = z.object({
  id: z.string(),
  company: z.string(),
  /** Role, with the project in parentheses when there is one */
  role: z.string(),
  period: z.string(),
  bullets: z.array(CvBulletSchema),
})

export const CvEducationSchema = z.object({
  school: z.string(),
  degree: z.string(),
  period: z.string(),
  note: z.string().nullable(),
})

export const CvContentSchema = z.object({
  contact: ContactSchema.default(EMPTY_CONTACT),
  /** e.g. "Full-stack Developer — React/Next.js, Fintech" */
  headline: z.string(),
  summary: z.string(),
  /** A stretch in the headline/summary (e.g. a framework the source doesn't name) */
  summaryStretch: StretchSchema.nullable().default(null),
  skills: z.array(z.object({ group: z.string(), items: z.array(z.string()) })),
  experience: z.array(CvExperienceSchema),
  education: z.array(CvEducationSchema),
  /** Gaps: what the job wants that the source doesn't show. Shown to you
   *  and the coach, never printed */
  learning: z.array(z.string()).default([]),
})

export type Contact = z.infer<typeof ContactSchema>
export type Stretch = z.infer<typeof StretchSchema>
export type CvBullet = z.infer<typeof CvBulletSchema>
export type CvExperience = z.infer<typeof CvExperienceSchema>
export type CvContent = z.infer<typeof CvContentSchema>

/** Stretches still waiting for your decision. */
export function pendingStretches(cv: CvContent) {
  const bullets = cv.experience.flatMap((e) =>
    e.bullets.filter((b) => b.stretch && !b.stretch.approved)
  )
  return cv.summaryStretch && !cv.summaryStretch.approved
    ? [cv.summaryStretch, ...bullets]
    : bullets
}

/** Every bullet id → its text (source chips, validator ids). */
export function bulletIndex(cv: CvContent) {
  return new Map(
    cv.experience.flatMap((e) => e.bullets.map((b) => [b.id, b.text] as const))
  )
}

/** The CV as plain text: what refined CVs are checked against. */
export function cvText(cv: CvContent) {
  return [
    cv.headline,
    cv.summary,
    ...cv.skills.map((g) => `${g.group}: ${g.items.join(", ")}`),
    ...cv.experience.flatMap((e) => [
      `${e.role} — ${e.company} (${e.period})`,
      ...e.bullets.map((b) => b.text),
    ]),
    ...cv.education.map((e) =>
      [e.degree, e.school, e.period, e.note].filter(Boolean).join(", ")
    ),
  ].join("\n")
}
