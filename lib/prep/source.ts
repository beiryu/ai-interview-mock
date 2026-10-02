import { createHash } from "node:crypto"

/**
 * Fingerprints of what a job's CV and prep were built from. A stored one
 * whose hash no longer matches is "stale": the job description changed, or
 * the CV it was built from did.
 */

type Versioned = { id: string; updatedAt: Date | string }

export interface HashedJob {
  company: string
  title: string
  notes: string | null
  jdText: string
}

function hash(parts: unknown) {
  return createHash("sha256")
    .update(JSON.stringify(parts))
    .digest("hex")
    .slice(0, 16)
}

const version = (v: Versioned | null) =>
  v ? `${v.id}@${new Date(v.updatedAt).toISOString()}` : null

/** A job's CV: the job and the CV it was refined from (none if generated). */
export function jobCvHash(job: HashedJob, basedOn: Versioned | null) {
  return hash([job.title, job.company, job.notes, job.jdText, version(basedOn)])
}

/** A job's prep: the job and its CV. */
export function jobPrepHash(job: HashedJob, cv: Versioned | null) {
  return hash([job.title, job.company, job.notes, job.jdText, version(cv)])
}
