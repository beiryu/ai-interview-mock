import { z } from "zod"

/**
 * A job's prep: what the coach knows for that interview, built from the
 * job's CV and description by a strong model before the interview, and
 * reviewed by you. Items carry ids (S2, R3) that live answers cite next to
 * the CV's (B4), and `locked` once you edit them so regeneration keeps your
 * version.
 */

const locked = z.boolean().optional()

export const STORY_THEMES = [
  "conflict",
  "failure",
  "leadership",
  "deadline",
  "learning",
  "impact",
  "ownership",
] as const

export const StorySchema = z.object({
  id: z.string(),
  theme: z.enum(STORY_THEMES),
  title: z.string(),
  situation: z.string(),
  task: z.string(),
  action: z.string(),
  result: z.string(),
  /** CV bullets (B*) the story comes from */
  sourceIds: z.array(z.string()),
  locked,
})

export const RequirementSchema = z.object({
  id: z.string(),
  text: z.string(),
  evidence: z.array(z.string()).describe("CV bullet ids (B*)"),
  gap: z.string().nullable(),
  bridge: z.string().nullable(),
  locked,
})

export const LikelyQuestionSchema = z.object({
  question: z.string(),
  points: z.array(z.string()),
  refs: z.array(z.string()),
  locked,
})

export const JobPrepSchema = z.object({
  /** Why you fit this role, from real evidence */
  angle: z.string(),
  /** A spoken 30-second self-introduction for this job */
  intro: z.string(),
  requirements: z.array(RequirementSchema),
  stories: z.array(StorySchema),
  likelyQuestions: z.array(LikelyQuestionSchema),
  /** Technologies interviewers may ask about that the CV doesn't show */
  doNotClaim: z.array(z.string()),
})

export type Story = z.infer<typeof StorySchema>
export type Requirement = z.infer<typeof RequirementSchema>
export type LikelyQuestion = z.infer<typeof LikelyQuestionSchema>
export type JobPrep = z.infer<typeof JobPrepSchema>

/**
 * Personal answers for a job (only you know them). A new job starts with
 * the answers of your latest job; blank ones make the coach answer without
 * stating a specific.
 */
export const AnswersSchema = z.object({
  whyThisCompany: z.string().default(""),
  reasonForLeaving: z.string().default(""),
  salaryExpectation: z.string().default(""),
  noticePeriod: z.string().default(""),
  location: z.string().default(""),
  strengths: z.string().default(""),
  weaknesses: z.string().default(""),
  hobbies: z.string().default(""),
})

export type Answers = z.infer<typeof AnswersSchema>
export type AnswerField = keyof Answers

export const EMPTY_ANSWERS: Answers = AnswersSchema.parse({})

export const ANSWER_LABELS: Record<AnswerField, string> = {
  whyThisCompany: "Why this company",
  reasonForLeaving: "Why leaving your current job",
  salaryExpectation: "Salary expectation",
  noticePeriod: "Notice period / start date",
  location: "Location / commute",
  strengths: "Strengths",
  weaknesses: "Weaknesses",
  hobbies: "Outside work",
}

export type PrepStatus = "missing" | "pending" | "ready" | "failed" | "stale"
