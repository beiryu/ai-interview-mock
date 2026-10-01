import { BRIEF_MAX_CHARS } from "@/config/defaults/ai"
import { db } from "@/lib/db"

import { buildInterviewBrief } from "./brief"

/** The brief for one of the user's interviews ("" if none / not theirs). */
export async function loadInterviewBrief(interviewId: string, userId: string) {
  const interview = await db.interview.findFirst({
    where: { id: interviewId, userId },
    select: {
      companyName: true,
      jobTitle: true,
      notes: true,
      documentIds: true,
    },
  })
  if (!interview) return ""

  const documents = interview.documentIds.length
    ? await db.document.findMany({
        where: { id: { in: interview.documentIds }, userId },
        select: { title: true, type: true, content: true },
      })
    : []

  return buildInterviewBrief(
    interview,
    documents,
    BRIEF_MAX_CHARS
  )
}
