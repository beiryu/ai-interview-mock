import { BRIEF_MAX_CHARS } from "@/config/defaults/ai"
import { db } from "@/lib/db"
import { renderPrepBrief } from "@/lib/prep/render"
import { InterviewPrepSchema, ProfilePrepSchema } from "@/lib/prep/schema"

import { buildInterviewBrief } from "./brief"

const NO_INTERVIEW = { companyName: null, jobTitle: null, notes: null }

/**
 * The coach's brief for one of the user's interviews ("" if none / not
 * theirs). With a profile prep it is the rendered prep pack plus the raw
 * documents for detail; without one it falls back to the raw documents, so
 * a missing or failed prep never blocks answering.
 */
export async function loadInterviewBrief(interviewId: string, userId: string) {
  return (await loadCoachContext(interviewId, userId)).brief
}

export interface CoachContext {
  brief: string
  /** Prep ids answers may cite (empty without a prep) */
  knownIds: Set<string>
  doNotClaim: string[]
}

/** The brief plus what the answer validator checks against. */
export async function loadCoachContext(
  interviewId: string,
  userId: string
): Promise<CoachContext> {
  const none: CoachContext = { brief: "", knownIds: new Set(), doNotClaim: [] }
  const interview = await db.interview.findFirst({
    where: { id: interviewId, userId },
    select: {
      companyName: true,
      jobTitle: true,
      notes: true,
      documentIds: true,
      prep: { select: { content: true } },
      user: { select: { profilePrep: { select: { content: true } } } },
    },
  })
  if (!interview) return none

  const documents = interview.documentIds.length
    ? await db.document.findMany({
        where: { id: { in: interview.documentIds }, userId },
        select: { title: true, type: true, content: true },
      })
    : []

  const profile = ProfilePrepSchema.safeParse(
    interview.user.profilePrep?.content
  )
  if (!profile.success) {
    return {
      ...none,
      brief: buildInterviewBrief(interview, documents, BRIEF_MAX_CHARS),
    }
  }

  const interviewPrep = InterviewPrepSchema.safeParse(interview.prep?.content)
  const prepBrief = renderPrepBrief({
    interview,
    profile: profile.data,
    interviewPrep: interviewPrep.success ? interviewPrep.data : null,
    documents: "",
  })
  // Raw documents fill whatever budget the prep leaves
  const budget = BRIEF_MAX_CHARS - prepBrief.length
  const raw =
    budget > 500 ? buildInterviewBrief(NO_INTERVIEW, documents, budget) : ""
  return {
    brief: raw ? `${prepBrief}\n\n${raw}` : prepBrief,
    knownIds: new Set([
      ...profile.data.facts.map((f) => f.id),
      ...profile.data.stories.map((s) => s.id),
      ...(interviewPrep.success
        ? interviewPrep.data.requirements.map((r) => r.id)
        : []),
    ]),
    doNotClaim: profile.data.doNotClaim,
  }
}
