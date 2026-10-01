import { z } from "zod"

import { runObject } from "@/lib/ai/run"

import { notInDocuments } from "./claims"
import {
  mergeDoNotClaim,
  mergeFacts,
  mergeInterviewPrep,
  mergePersonal,
  mergeStories,
} from "./merge"
import {
  EMPTY_PERSONAL,
  FactSchema,
  LikelyQuestionSchema,
  RequirementSchema,
  StorySchema,
  type InterviewPrep,
  type ProfilePrep,
} from "./schema"

/**
 * Builds prep packs with the `prep` task (a strong model; latency doesn't
 * matter here). Split into small calls — facts first, then stories and
 * do-not-claim in parallel — so each output stays focused and one bad
 * section doesn't sink the rest. Every prompt forbids inventing: a missing
 * detail stays missing for the candidate to fill in.
 */

const TRUTH_RULES = `Use ONLY what the documents state. Never infer, embellish or generalize: no invented numbers, team sizes, dates, technologies, events or outcomes. Copy numbers and names verbatim. If something is not in the documents, leave it out. Write in the language the documents are written in.`

// What the model writes: ids and lock flags are assigned by the merge
const omitIds = { id: true, locked: true } as const

const FactsOutput = z.object({ facts: z.array(FactSchema.omit(omitIds)) })
const StoriesOutput = z.object({ stories: z.array(StorySchema.omit(omitIds)) })
const ClaimsOutput = z.object({
  doNotClaim: z
    .array(z.string())
    .describe(
      'Technologies interviewers for these roles often ask about that are NOT mentioned anywhere in the documents (not in skills lists, not in any project). Names only, e.g. "Kafka". Never list something the documents mention, and no notes about missing details.'
    ),
  intro: z
    .string()
    .describe(
      "A spoken 30-second self-introduction, first person, 3–4 short sentences: current role and focus, the 2 most relevant projects, one strength. Built only from the facts; don't list every employer"
    ),
})
const InterviewOutput = z.object({
  angle: z
    .string()
    .describe(
      "2–3 sentences: why this candidate fits this role, from real evidence"
    ),
  requirements: z.array(RequirementSchema.omit(omitIds)),
  likelyQuestions: z.array(LikelyQuestionSchema.omit({ locked: true })),
})

export function factsBlock(profile: Pick<ProfilePrep, "facts" | "stories">) {
  const facts = profile.facts
    .map(
      (f) =>
        `${f.id} ${f.title} (${[f.organization, f.period, f.role]
          .filter(Boolean)
          .join(", ")}) stack: ${f.stack.join(", ")}\n` +
        f.highlights.map((h) => `  - ${h}`).join("\n")
    )
    .join("\n")
  const stories = profile.stories
    .map((s) => `${s.id} [${s.theme}] ${s.title} — ${s.result}`)
    .join("\n")
  return `FACTS:\n${facts}${stories ? `\n\nSTORIES:\n${stories}` : ""}`
}

export async function generateProfilePrep(
  documents: string,
  previous: ProfilePrep | null
): Promise<ProfilePrep> {
  const { output: factsOut } = await runObject("prep", FactsOutput, {
    maxRetries: 1,
    instructions: `You extract a candidate's work history for interview preparation. ${TRUTH_RULES}`,
    prompt: `List every job, project and significant piece of work in these documents as a fact: title, organization, period, role, stack (only technologies named for it), highlights (concrete actions and results, numbers verbatim).\n\nDOCUMENTS:\n${documents}`,
  })
  const facts = mergeFacts(previous?.facts ?? [], factsOut.facts)

  const [storiesOut, claimsOut] = await Promise.all([
    runObject("prep", StoriesOutput, {
      maxRetries: 1,
      instructions: `You turn a candidate's documented work into STAR stories for behavioral interview questions. ${TRUTH_RULES} A story needs a documented situation and result; if the documents do not support a theme (e.g. no conflict is described), skip that theme — fewer true stories beat more invented ones. Each story lists the fact ids it comes from.`,
      prompt: `Write up to 8 stories across themes (conflict, failure, leadership, deadline, learning, impact, ownership) using only these facts and documents.\n\n${factsBlock(
        { facts, stories: [] }
      )}\n\nDOCUMENTS:\n${documents}`,
    }),
    runObject("prep", ClaimsOutput, {
      maxRetries: 1,
      instructions: `You help a candidate avoid overclaiming in interviews. ${TRUTH_RULES}`,
      prompt: `${factsBlock({
        facts,
        stories: [],
      })}\n\nDOCUMENTS:\n${documents}`,
    }),
  ])
  const stories = mergeStories(
    previous?.stories ?? [],
    storiesOut.output.stories.map((s) => ({
      ...s,
      factIds: s.factIds.filter((id) => facts.some((f) => f.id === id)),
    }))
  )

  return {
    facts,
    stories,
    doNotClaim: mergeDoNotClaim(
      // Previous entries are re-checked too: an old run may have listed a
      // skill the documents do mention
      notInDocuments(previous?.doNotClaim ?? [], documents),
      notInDocuments(claimsOut.output.doNotClaim, documents)
    ),
    // Only the intro is generated; the rest is the candidate's to fill in
    personal: mergePersonal(previous?.personal, {
      ...EMPTY_PERSONAL,
      intro: claimsOut.output.intro,
    }),
  }
}

export async function generateInterviewPrep({
  header,
  jobDescription,
  profile,
  documents,
  previous,
}: {
  header: string
  jobDescription: string
  profile: ProfilePrep
  /** The candidate's documents: skills lists live here, not in the facts */
  documents: string
  previous: InterviewPrep | null
}): Promise<InterviewPrep> {
  const { output } = await runObject("prep", InterviewOutput, {
    maxRetries: 1,
    instructions: `You prepare a candidate for a specific interview by mapping the job's requirements to the candidate's real evidence. ${TRUTH_RULES} Evidence must be fact/story ids from the list; count a technology as known when it appears in any fact's stack or highlights, including the skills list. When there is none, say so in "gap" and suggest an honest "bridge" to the closest real experience. Likely questions: 8–15, each with short answer points that cite ids in "refs".`,
    prompt: `${header}\n\nJOB DESCRIPTION:\n${
      jobDescription ||
      "(none — infer typical requirements from the role title only, and mark every requirement's evidence honestly)"
    }\n\n${factsBlock(
      profile
    )}\n\nCANDIDATE DOCUMENTS (a technology in a skills list counts as known):\n${documents}`,
  })
  const ids = new Set([...profile.facts, ...profile.stories].map((x) => x.id))
  return mergeInterviewPrep(previous, {
    ...output,
    requirements: output.requirements.map((r) => ({
      ...r,
      evidence: r.evidence.filter((id) => ids.has(id)),
    })),
    likelyQuestions: output.likelyQuestions.map((q) => ({
      ...q,
      refs: q.refs.filter((id) => ids.has(id)),
    })),
  })
}
