import { z } from "zod"

import { runObject } from "@/lib/ai/run"
import { factsBlock } from "@/lib/prep/generate"
import type { ProfilePrep } from "@/lib/prep/schema"

import { checkCv, mergeCv } from "./check"
import { CvEducationSchema, TailoredCvSchema, type TailoredCv } from "./schema"

/**
 * Writes a CV for one job from your profile prep, your documents and the
 * job description (`prep` task: strong model, background run). Light
 * stretches are allowed but must be declared, then lib/cv/check.ts drops or
 * flags whatever goes beyond your documents anyway.
 */

const RULES = `You tailor a candidate's CV to one job description. The candidate submits it to the employer, so it must stay true to their documents.

DO: choose the experience most relevant to the job and list it newest first; rewrite bullets in the job's vocabulary; lead with matching skills the candidate really has; a headline of at most 8 words (role + 2–3 key skills); a 2–3 sentence summary aimed at this role; keep each bullet one line, starting with a strong verb. Don't state years of experience unless the documents state them.
LIGHT STRETCH (allowed, must be declared): wording slightly beyond the source that stays faithful to it — e.g. "Spring" → "Spring / Spring Boot REST APIs" when the source shows REST work in Spring; naming a domain a project really belongs to ("payments", "fintech"). Every such bullet gets "stretch": { note: what goes beyond the source, defense: 1–2 honest first-person sentences the candidate can say if asked, e.g. "I built the REST APIs with Spring; Spring Boot is what I'd use today." }. If the headline or summary stretches (e.g. names a framework the documents don't), fill "summaryStretch" the same way, else null.
NEVER: add a company, project, title, date, degree, number, metric or technology that is not in the documents. Numbers are copied verbatim. A skill the job wants that the documents never mention goes to "learning" — a private list of gaps, not printed on the CV (never list something the documents already show).
Every bullet lists the fact ids (P*) it is based on. Write in English unless the job description is in Vietnamese.`

const BulletOut = z.object({
  text: z.string(),
  factIds: z.array(z.string()),
  stretch: z.object({ note: z.string(), defense: z.string() }).nullable(),
})

const CvOut = z.object({
  headline: z.string(),
  summary: z.string(),
  summaryStretch: z
    .object({ note: z.string(), defense: z.string() })
    .nullable(),
  skills: z.array(z.object({ group: z.string(), items: z.array(z.string()) })),
  experience: z.array(
    z.object({
      company: z.string(),
      role: z.string(),
      period: z.string(),
      bullets: z.array(BulletOut),
    })
  ),
  education: z.array(CvEducationSchema),
  learning: z.array(z.string()),
})

export async function generateTailoredCv({
  header,
  jobDescription,
  profile,
  documents,
  previous,
}: {
  header: string
  jobDescription: string
  profile: ProfilePrep
  documents: string
  previous: TailoredCv | null
}): Promise<TailoredCv> {
  const { output } = await runObject("prep", CvOut, {
    maxRetries: 1,
    instructions: RULES,
    prompt: `${header}\n\nJOB DESCRIPTION:\n${
      jobDescription || "(none — tailor to the role title)"
    }\n\n${factsBlock(profile)}\n\nCANDIDATE DOCUMENTS:\n${documents}`,
  })

  const generated = TailoredCvSchema.parse({
    ...output,
    summaryStretch: output.summaryStretch
      ? { ...output.summaryStretch, approved: false }
      : null,
    experience: output.experience.map((e) => ({
      ...e,
      id: "",
      bullets: e.bullets.map((b) => ({
        ...b,
        id: "",
        stretch: b.stretch ? { ...b.stretch, approved: false } : null,
      })),
    })),
  })
  return mergeCv(previous, checkCv(generated, profile.facts, documents))
}
