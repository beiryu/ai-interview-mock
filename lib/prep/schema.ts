import { z } from "zod"

/**
 * The prep pack: what the coach knows, digested before the interview by a
 * strong model and reviewed by the candidate. Two layers:
 *  - ProfilePrep (per user, from CV/portfolio/notes): reused by every
 *    interview — facts, STAR stories, things not to claim, personal answers
 *  - InterviewPrep (per interview, from the JD): requirements mapped to
 *    evidence, likely questions, the angle for this role
 * Items carry ids (P1, S2, R3) that live answers cite, and `locked` once the
 * candidate edits them so regeneration keeps their version.
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

export const FactSchema = z.object({
  id: z.string(),
  title: z.string().describe("Project or role name"),
  organization: z.string().nullable(),
  period: z.string().nullable(),
  role: z.string().nullable(),
  stack: z.array(z.string()),
  highlights: z
    .array(z.string())
    .describe("Concrete things done/achieved, numbers copied verbatim"),
  locked,
})

export const StorySchema = z.object({
  id: z.string(),
  theme: z.enum(STORY_THEMES),
  title: z.string(),
  situation: z.string(),
  task: z.string(),
  action: z.string(),
  result: z.string(),
  factIds: z.array(z.string()),
  locked,
})

export const PersonalSchema = z.object({
  intro: z.string(),
  reasonForLeaving: z.string(),
  salaryExpectation: z.string(),
  noticePeriod: z.string(),
  location: z.string(),
  hobbies: z.string(),
  strengths: z.string(),
  weaknesses: z.string(),
  /** Fields the candidate edited; regeneration never overwrites them */
  edited: z.array(z.string()).optional(),
})

export const ProfilePrepSchema = z.object({
  facts: z.array(FactSchema),
  stories: z.array(StorySchema),
  doNotClaim: z.array(z.string()),
  personal: PersonalSchema,
})

export const RequirementSchema = z.object({
  id: z.string(),
  text: z.string(),
  evidence: z.array(z.string()).describe("Fact/story ids (P*, S*)"),
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

export const InterviewPrepSchema = z.object({
  angle: z.string(),
  requirements: z.array(RequirementSchema),
  likelyQuestions: z.array(LikelyQuestionSchema),
})

export type Fact = z.infer<typeof FactSchema>
export type Story = z.infer<typeof StorySchema>
export type Personal = z.infer<typeof PersonalSchema>
export type ProfilePrep = z.infer<typeof ProfilePrepSchema>
export type Requirement = z.infer<typeof RequirementSchema>
export type LikelyQuestion = z.infer<typeof LikelyQuestionSchema>
export type InterviewPrep = z.infer<typeof InterviewPrepSchema>

export const EMPTY_PERSONAL: Personal = {
  intro: "",
  reasonForLeaving: "",
  salaryExpectation: "",
  noticePeriod: "",
  location: "",
  hobbies: "",
  strengths: "",
  weaknesses: "",
}

export type PersonalField = Exclude<keyof Personal, "edited">

export const PERSONAL_LABELS: Record<PersonalField, string> = {
  intro: "30-second intro",
  reasonForLeaving: "Why leaving",
  salaryExpectation: "Salary expectation",
  noticePeriod: "Notice period / start date",
  location: "Location / commute",
  hobbies: "Outside work",
  strengths: "Strengths",
  weaknesses: "Weaknesses",
}

export type PrepStatus = "missing" | "pending" | "ready" | "failed" | "stale"
