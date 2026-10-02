import { z } from "zod"

import { runObject } from "@/lib/ai/run"
import { cvBlock } from "@/lib/cv/render"
import { bulletIndex, cvText, type CvContent } from "@/lib/cv/schema"

import { notInDocuments } from "./claims"
import { mergeJobPrep } from "./merge"
import {
  LikelyQuestionSchema,
  RequirementSchema,
  StorySchema,
  type JobPrep,
} from "./schema"

/**
 * Builds a job's prep from its CV and description with the `prep` task (a
 * strong model; latency doesn't matter here). Two calls in parallel — the
 * job map (angle, requirements, likely questions) and the candidate's
 * material (stories, intro, never-claim) — so each output stays focused.
 * The CV is the truth: nothing beyond it is invented.
 */

const TRUTH_RULES = `Use ONLY what the candidate's CV states (and the source text, for details of the same work). Never infer, embellish or generalize: no invented numbers, team sizes, dates, technologies, events or outcomes. Copy numbers and names verbatim. If something is not there, leave it out. Write in the language of the job description.`

// What the model writes: ids and lock flags are assigned by the merge
const omitIds = { id: true, locked: true } as const

const JobMapOutput = z.object({
  angle: z
    .string()
    .describe(
      "2–3 sentences: why this candidate fits this role, from the CV's evidence"
    ),
  requirements: z.array(RequirementSchema.omit(omitIds)),
  likelyQuestions: z.array(LikelyQuestionSchema.omit({ locked: true })),
})

const MaterialOutput = z.object({
  stories: z.array(StorySchema.omit(omitIds)),
  intro: z
    .string()
    .describe(
      "A spoken 30-second self-introduction for this job, first person, 3–4 short sentences: current role and focus, the 2 most relevant projects, one strength"
    ),
  doNotClaim: z
    .array(z.string())
    .describe(
      'Technologies interviewers for this job may ask about that the CV and source text never mention. Names only, e.g. "Kafka".'
    ),
})

export async function generateJobPrep({
  header,
  jobDescription,
  cv,
  sourceText,
  practice,
  previous,
}: {
  header: string
  jobDescription: string
  /** The job's CV (what the employer saw, or the practice persona) */
  cv: CvContent
  /** The candidate's own text behind it ("" for a practice persona) */
  sourceText: string
  /** The CV is a fictional practice persona */
  practice: boolean
  previous: JobPrep | null
}): Promise<JobPrep> {
  const persona = practice
    ? " This CV is a fictional practice persona: treat it as the candidate's real history and stay consistent with it."
    : ""
  const cvPart = `CANDIDATE CV (bullets B* — cite them):\n${cvBlock(cv)}${
    sourceText
      ? `\n\nSOURCE TEXT (details of the same work):\n${sourceText}`
      : ""
  }`
  const jobPart = `${header}\n\nJOB DESCRIPTION:\n${
    jobDescription || "(none — infer typical requirements from the role title)"
  }`

  const [map, material] = await Promise.all([
    runObject("prep", JobMapOutput, {
      maxRetries: 1,
      instructions: `You prepare a candidate for a specific interview by mapping the job's requirements to the evidence on their CV. ${TRUTH_RULES}${persona} Evidence is CV bullet ids (B*). When there is none, say so in "gap" and suggest an honest "bridge" to the closest real experience. Likely questions: 8–15, including questions about the CV's own lines, each with short answer points that cite ids in "refs".`,
      prompt: `${jobPart}\n\n${cvPart}`,
    }),
    runObject("prep", MaterialOutput, {
      maxRetries: 1,
      instructions: `You turn a candidate's CV into interview material. ${TRUTH_RULES}${persona} STAR stories (up to 8, across conflict, failure, leadership, deadline, learning, impact, ownership) need a situation and result the CV supports; skip a theme it doesn't — fewer true stories beat more invented ones. Each story lists the CV bullet ids (B*) it comes from in "sourceIds".`,
      prompt: `${jobPart}\n\n${cvPart}`,
    }),
  ])

  const ids = new Set(bulletIndex(cv).keys())
  const known = (list: string[]) => list.filter((id) => ids.has(id))
  return mergeJobPrep(previous, {
    ...map.output,
    requirements: map.output.requirements.map((r) => ({
      ...r,
      evidence: known(r.evidence),
    })),
    likelyQuestions: map.output.likelyQuestions.map((q) => ({
      ...q,
      refs: q.refs.filter((id) => ids.has(id) || /^[RS]\d+$/.test(id)),
    })),
    stories: material.output.stories.map((s) => ({
      ...s,
      sourceIds: known(s.sourceIds),
    })),
    intro: material.output.intro,
    // A never-claim entry the CV mentions would make the coach deny real work
    doNotClaim: notInDocuments(
      [...new Set([...material.output.doNotClaim, ...cv.learning])],
      // (cvText leaves out the gaps list, which is exactly what's unknown)
      `${sourceText}\n${cvText(cv)}`
    ),
  })
}
