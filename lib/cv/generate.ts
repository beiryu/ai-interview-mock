import { z } from "zod"

import { runObject } from "@/lib/ai/run"

import { assignCvIds, checkCv, mergeCv } from "./check"
import { cvBlock } from "./render"
import {
  ContactSchema,
  CvContentSchema,
  CvEducationSchema,
  EMPTY_CONTACT,
  bulletIndex,
  type CvContent,
} from "./schema"

/**
 * The three ways a CV is made, all with the `prep` task (strong model,
 * background run):
 *  - parseCv: an uploaded CV → structure, wording kept
 *  - refineCv: a CV + a job description → the CV for that job, true to the
 *    source; light stretches are declared, then lib/cv/check.ts drops or
 *    flags whatever goes beyond the source anyway
 *  - generateCv: a job description alone → a fictional practice persona
 */

const Stretch = z.object({ note: z.string(), defense: z.string() }).nullable()

function cvOutput<B extends z.ZodTypeAny>(bullet: B) {
  return z.object({
    headline: z.string(),
    summary: z.string(),
    summaryStretch: Stretch,
    skills: z.array(
      z.object({ group: z.string(), items: z.array(z.string()) })
    ),
    experience: z.array(
      z.object({
        company: z.string(),
        role: z
          .string()
          .describe(
            'Role, with the project in parentheses: "Backend Engineer (Claynosaurs)"'
          ),
        period: z.string(),
        bullets: z.array(bullet),
      })
    ),
    education: z.array(CvEducationSchema),
    learning: z.array(z.string()),
  })
}

const PlainBullet = z.object({ text: z.string() })
const RefinedBullet = z.object({
  text: z.string(),
  sourceIds: z.array(z.string()),
  stretch: Stretch,
})

type Output = z.infer<ReturnType<typeof cvOutput<typeof RefinedBullet>>>

/** Model output → CV content (ids assigned later, stretches unapproved). */
function toContent(
  output: Omit<Output, "experience"> & {
    experience: (Omit<Output["experience"][number], "bullets"> & {
      bullets: {
        text: string
        sourceIds?: string[]
        stretch?: { note: string; defense: string } | null
      }[]
    })[]
  },
  contact: CvContent["contact"]
): CvContent {
  return CvContentSchema.parse({
    ...output,
    contact,
    summaryStretch: output.summaryStretch
      ? { ...output.summaryStretch, approved: false }
      : null,
    experience: output.experience.map((e) => ({
      ...e,
      id: "",
      bullets: e.bullets.map((b) => ({
        id: "",
        text: b.text,
        sourceIds: b.sourceIds ?? [],
        stretch: b.stretch ? { ...b.stretch, approved: false } : null,
      })),
    })),
  })
}

// ─── Uploaded ────────────────────────────────────────────────────────────────

const ParseOut = cvOutput(PlainBullet).extend({ contact: ContactSchema })

export async function parseCv(rawText: string): Promise<CvContent> {
  const { output } = await runObject("prep", ParseOut, {
    maxRetries: 1,
    instructions: `You turn an uploaded CV into structured data. Keep the candidate's own wording: copy every job, project, bullet, skill, date, number and name as written — do not summarize, merge, reword, reorder or add anything. One experience entry per role or project (role with the project in parentheses), newest first as in the CV. Contact: name, email, phone, location and links (GitHub, LinkedIn, portfolio) as written, "" when absent. summaryStretch is null and learning is [].`,
    prompt: rawText,
  })
  return assignCvIds(toContent(output, output.contact))
}

// ─── Refined for a job ───────────────────────────────────────────────────────

const REFINE_RULES = `You tailor a candidate's CV to one job description. The candidate submits it to the employer, so it must stay true to their source CV.

DO: choose the experience most relevant to the job and list it newest first; rewrite bullets in the job's vocabulary; lead with matching skills the candidate really has; a headline of at most 8 words (role + 2–3 key skills); a 2–3 sentence summary aimed at this role; keep each bullet one line, starting with a strong verb. Don't state years of experience unless the source states them.
LIGHT STRETCH (allowed, must be declared): wording slightly beyond the source that stays faithful to it — e.g. "Spring" → "Spring / Spring Boot REST APIs" when the source shows REST work in Spring; naming a domain a project really belongs to ("payments", "fintech"). Every such bullet gets "stretch": { note: what goes beyond the source, defense: 1–2 honest first-person sentences the candidate can say if asked, e.g. "I built the REST APIs with Spring; Spring Boot is what I'd use today." }. If the headline or summary stretches (e.g. names a framework the source doesn't), fill "summaryStretch" the same way, else null.
NEVER: add a company, project, title, date, degree, number, metric or technology that is not in the source. Numbers are copied verbatim. A skill the job wants that the source never mentions goes to "learning" — a private list of gaps, not printed on the CV (never list something the source already shows).
Every bullet lists the source bullet ids (B*) it is based on in "sourceIds". Write in English unless the job description is in Vietnamese.`

const RefineOut = cvOutput(RefinedBullet)

export async function refineCv({
  header,
  jobDescription,
  source,
  sourceText,
  start,
  previous,
}: {
  /** ROLE / COMPANY / NOTES lines for the job */
  header: string
  jobDescription: string
  /** The CV the facts come from (with ids) */
  source: CvContent
  /** Everything the candidate really wrote (the uploaded text) */
  sourceText: string
  /** A refined CV to start from instead of the source, if any */
  start?: CvContent | null
  /** This job's CV before regenerating: your edits and approvals are kept */
  previous: CvContent | null
}): Promise<CvContent> {
  const { output } = await runObject("prep", RefineOut, {
    maxRetries: 1,
    instructions: REFINE_RULES,
    prompt: `${header}\n\nJOB DESCRIPTION:\n${
      jobDescription || "(none — tailor to the role title)"
    }\n\nSOURCE CV (bullets B* — cite them):\n${cvBlock(source)}${
      start
        ? `\n\nSTART FROM THIS EARLIER TAILORED VERSION (its wording, same rules):\n${cvBlock(
            start
          )}`
        : ""
    }\n\nFULL SOURCE TEXT (for details):\n${sourceText}`,
  })
  const checked = checkCv(toContent(output, source.contact), {
    ids: [...bulletIndex(source).keys()],
    text: sourceText,
  })
  return mergeCv(previous, checked)
}

// ─── Generated (practice persona) ────────────────────────────────────────────

const GenerateOut = cvOutput(PlainBullet).extend({
  name: z.string().describe("A plausible fictional full name"),
})

export async function generateCv({
  header,
  jobDescription,
  previous,
}: {
  header: string
  jobDescription: string
  previous: CvContent | null
}): Promise<CvContent> {
  const { output } = await runObject("prep", GenerateOut, {
    maxRetries: 1,
    instructions: `You write a fictional CV of a candidate who fits this job description well, for interview PRACTICE only (it is never sent to an employer). Make it realistic and internally consistent: 2–4 roles at fictional companies (never real company names), plausible dates, concrete bullets with modest, believable numbers, skills that match the job, one degree. Newest first. A headline of at most 8 words and a 2–3 sentence summary. summaryStretch is null and learning is []. Write in English unless the job description is in Vietnamese.`,
    prompt: `${header}\n\nJOB DESCRIPTION:\n${jobDescription}`,
  })
  const content = toContent(output, { ...EMPTY_CONTACT, name: output.name })
  return mergeCv(previous, content)
}
