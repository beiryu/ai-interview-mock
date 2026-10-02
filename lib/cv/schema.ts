import { z } from "zod"

/**
 * A CV tailored to one job: your real experience (prep facts P*), chosen,
 * ordered and reworded for the job description. Wording that goes beyond
 * what your documents say is a "stretch": it carries what changed and how to
 * answer if asked, and you approve it before the PDF can be exported.
 */

export const StretchSchema = z.object({
  /** What the wording adds beyond the source fact */
  note: z.string(),
  /** 1–2 honest sentences to say if the interviewer digs into it */
  defense: z.string(),
  approved: z.boolean(),
})

export const CvBulletSchema = z.object({
  id: z.string(),
  text: z.string(),
  /** Prep facts (P*) this bullet is based on */
  factIds: z.array(z.string()),
  stretch: StretchSchema.nullable(),
  locked: z.boolean().optional(),
})

export const CvExperienceSchema = z.object({
  id: z.string(),
  company: z.string(),
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

export const TailoredCvSchema = z.object({
  /** e.g. "Full-stack Developer — React/Next.js, Fintech" */
  headline: z.string(),
  summary: z.string(),
  /** A stretch in the headline/summary (e.g. a framework the CV doesn't name) */
  summaryStretch: StretchSchema.nullable().default(null),
  skills: z.array(z.object({ group: z.string(), items: z.array(z.string()) })),
  experience: z.array(CvExperienceSchema),
  education: z.array(CvEducationSchema),
  /** Gaps: what the job wants that your documents don't show. Shown to you
   *  and the coach, never printed on the CV */
  learning: z.array(z.string()),
})

export type Stretch = z.infer<typeof StretchSchema>
export type CvBullet = z.infer<typeof CvBulletSchema>
export type CvExperience = z.infer<typeof CvExperienceSchema>
export type TailoredCv = z.infer<typeof TailoredCvSchema>

/** Stretches still waiting for your decision. */
export function pendingStretches(cv: TailoredCv) {
  const bullets = cv.experience.flatMap((e) =>
    e.bullets.filter((b) => b.stretch && !b.stretch.approved)
  )
  return cv.summaryStretch && !cv.summaryStretch.approved
    ? [cv.summaryStretch, ...bullets]
    : bullets
}
