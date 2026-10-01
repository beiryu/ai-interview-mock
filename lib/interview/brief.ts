/**
 * The "interview brief": everything the answer coach should know about this
 * interview and the candidate, placed in its instructions on every answer.
 *
 * A personal CV + JD + notes is a few thousand tokens, so it goes into the
 * prompt whole instead of through retrieval: no extra round-trip, no chunks
 * lost to search, and the stable prefix gets prompt caching. It is the
 * fallback when there is no prep pack (lib/prep).
 */

export interface BriefInterview {
  companyName: string | null
  jobTitle: string | null
  notes: string | null
}

export interface BriefDocument {
  title: string
  type: string
  content: string
}

const TYPE_LABEL: Record<string, string> = {
  JOB_DESCRIPTION: "Job description",
  RESUME: "Resume",
  PORTFOLIO: "Portfolio",
  PROJECT_DOCUMENTATION: "Project docs",
  NOTES: "Notes",
  COVER_LETTER: "Cover letter",
}

// Most useful first, so truncation (if any) hits the least useful last
const TYPE_ORDER = Object.keys(TYPE_LABEL)

function clean(text: string) {
  return text
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
}

/**
 * Builds the brief, fitting documents into `maxChars` by giving each one an
 * equal share of what is left (short documents free space for long ones).
 */
export function buildInterviewBrief(
  interview: BriefInterview,
  documents: BriefDocument[],
  maxChars: number
): string {
  const header = [
    interview.jobTitle && `Role: ${interview.jobTitle}`,
    interview.companyName && `Company: ${interview.companyName}`,
    interview.notes && `Notes from the candidate:\n${clean(interview.notes)}`,
  ].filter(Boolean)

  const docs = documents
    .map((doc) => ({ ...doc, content: clean(doc.content) }))
    .filter((doc) => doc.content.length > 0)
    .sort((a, b) => TYPE_ORDER.indexOf(a.type) - TYPE_ORDER.indexOf(b.type))

  // Shortest first when sharing the budget, then back to display order
  const budgets = new Map<BriefDocument, number>()
  let remaining = maxChars
  const bySize = [...docs].sort((a, b) => a.content.length - b.content.length)
  bySize.forEach((doc, i) => {
    const share = Math.floor(remaining / (bySize.length - i))
    const size = Math.min(doc.content.length, share)
    budgets.set(doc, size)
    remaining -= size
  })

  const sections = docs.map((doc) => {
    const size = budgets.get(doc) ?? 0
    const body =
      size < doc.content.length
        ? `${doc.content.slice(0, size).trimEnd()}\n[…truncated]`
        : doc.content
    return `### ${doc.title} (${TYPE_LABEL[doc.type] ?? doc.type})\n${body}`
  })

  return [
    header.length > 0 ? `## Interview\n${header.join("\n")}` : "",
    sections.length > 0
      ? `## Candidate documents\n\n${sections.join("\n\n")}`
      : "",
  ]
    .filter(Boolean)
    .join("\n\n")
}
