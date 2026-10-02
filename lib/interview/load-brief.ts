import { BRIEF_MAX_CHARS } from "@/config/defaults/ai"
import { CvContentSchema, bulletIndex } from "@/lib/cv/schema"
import { db } from "@/lib/db"
import { renderJobBrief } from "@/lib/prep/render"
import { AnswersSchema, JobPrepSchema } from "@/lib/prep/schema"

/**
 * The coach's brief for one of your jobs ("" if none / not yours): the job,
 * its CV, its prep and your answers for it. A missing or failed prep never
 * blocks answering: the brief is then the job and its CV alone.
 */
export async function loadInterviewBrief(jobId: string, userId: string) {
  return (await loadCoachContext(jobId, userId)).brief
}

export interface CoachContext {
  brief: string
  /** Ids answers may cite: CV bullets, stories, requirements */
  knownIds: Set<string>
  doNotClaim: string[]
}

/** The brief plus what the answer validator checks against. */
export async function loadCoachContext(
  jobId: string,
  userId: string
): Promise<CoachContext> {
  const job = await db.job.findFirst({
    where: { id: jobId, userId },
    select: {
      company: true,
      title: true,
      notes: true,
      jdText: true,
      answers: true,
      prep: { select: { content: true } },
      cv: { select: { content: true, origin: true } },
    },
  })
  if (!job) return { brief: "", knownIds: new Set(), doNotClaim: [] }

  const cv = CvContentSchema.safeParse(job.cv?.content)
  const prep = JobPrepSchema.safeParse(job.prep?.content)
  const answers = AnswersSchema.safeParse(job.answers ?? {})
  const brief = renderJobBrief({
    job,
    cv: cv.success ? cv.data : null,
    practice: job.cv?.origin === "GENERATED",
    prep: prep.success ? prep.data : null,
    answers: answers.success ? answers.data : null,
  })

  return {
    brief: brief.slice(0, BRIEF_MAX_CHARS),
    knownIds: new Set([
      ...(cv.success ? bulletIndex(cv.data).keys() : []),
      ...(cv.success ? cv.data.experience.map((e) => e.id) : []),
      ...(prep.success ? prep.data.stories.map((s) => s.id) : []),
      ...(prep.success ? prep.data.requirements.map((r) => r.id) : []),
    ]),
    doNotClaim: prep.success ? prep.data.doNotClaim : [],
  }
}
