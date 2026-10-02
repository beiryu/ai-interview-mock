import { createHash } from "node:crypto"

/**
 * Fingerprints of what a prep was built from. A stored prep whose hash no
 * longer matches is "stale" (documents or the interview changed).
 */

type Versioned = { id: string; updatedAt: Date | string }

function hash(parts: unknown) {
  return createHash("sha256")
    .update(JSON.stringify(parts))
    .digest("hex")
    .slice(0, 16)
}

function versions(docs: Versioned[]) {
  return docs
    .map((d) => `${d.id}@${new Date(d.updatedAt).toISOString()}`)
    .sort()
}

export function profileSourceHash(documents: Versioned[]) {
  return hash(versions(documents))
}

export function interviewSourceHash({
  interview,
  jobDocuments,
  profileHash,
}: {
  interview: {
    jobTitle: string | null
    companyName: string | null
    notes: string | null
  }
  jobDocuments: Versioned[]
  /** The profile prep it was built against (facts/story ids) */
  profileHash: string | null
}) {
  return hash([
    interview.jobTitle,
    interview.companyName,
    interview.notes,
    versions(jobDocuments),
    profileHash,
  ])
}
