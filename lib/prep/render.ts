import type { BriefInterview } from "@/lib/interview/brief"

import {
  PERSONAL_LABELS,
  type InterviewPrep,
  type Personal,
  type ProfilePrep,
} from "./schema"

/**
 * Renders the prep pack as the coach's brief: compact text with the ids
 * answers cite. Deterministic (same prep → same text) so the prefix stays
 * prompt-cacheable for the whole interview.
 */
export function renderPrepBrief({
  interview,
  profile,
  interviewPrep,
  documents,
}: {
  interview: BriefInterview
  profile: ProfilePrep
  interviewPrep: InterviewPrep | null
  /** Raw documents for details the prep didn't capture (may be "") */
  documents: string
}) {
  const sections: string[] = []

  const header = [
    interview.jobTitle && `Role: ${interview.jobTitle}`,
    interview.companyName && `Company: ${interview.companyName}`,
    interview.notes && `Notes from the candidate: ${interview.notes.trim()}`,
  ].filter(Boolean)
  if (header.length) sections.push(`## Interview\n${header.join("\n")}`)

  if (interviewPrep) {
    if (interviewPrep.angle.trim()) {
      sections.push(`## Why this role (angle)\n${interviewPrep.angle.trim()}`)
    }
    if (interviewPrep.requirements.length) {
      sections.push(
        "## Job requirements → evidence\n" +
          interviewPrep.requirements
            .map((r) => {
              const parts = [
                `${r.id} ${r.text} → ${
                  r.evidence.join(", ") || "no direct evidence"
                }`,
              ]
              if (r.gap) parts.push(`  gap: ${r.gap}`)
              if (r.bridge) parts.push(`  bridge: ${r.bridge}`)
              return parts.join("\n")
            })
            .join("\n")
      )
    }
  }

  if (profile.facts.length) {
    sections.push(
      "## Candidate facts (the only experience the candidate has)\n" +
        profile.facts
          .map((f) => {
            const meta = [f.organization, f.period, f.role]
              .filter(Boolean)
              .join(", ")
            const lines = [`${f.id} ${f.title}${meta ? ` — ${meta}` : ""}`]
            if (f.stack.length) lines.push(`  stack: ${f.stack.join(", ")}`)
            for (const h of f.highlights) lines.push(`  - ${h}`)
            return lines.join("\n")
          })
          .join("\n")
    )
  }

  if (profile.stories.length) {
    sections.push(
      "## Stories (STAR, approved by the candidate)\n" +
        profile.stories
          .map(
            (s) =>
              `${s.id} [${s.theme}] ${s.title}${
                s.factIds.length ? ` (${s.factIds.join(", ")})` : ""
              }\n` +
              `  S: ${s.situation}\n  T: ${s.task}\n  A: ${s.action}\n  R: ${s.result}`
          )
          .join("\n")
    )
  }

  sections.push(
    "## Personal answers (blank = unknown: leave a [fill in] placeholder, never guess)\n" +
      (Object.keys(PERSONAL_LABELS) as (keyof Personal)[])
        .map(
          (key) =>
            `${PERSONAL_LABELS[key]}: ${
              profile.personal[key].trim() || "(blank)"
            }`
        )
        .join("\n")
  )

  if (profile.doNotClaim.length) {
    sections.push(
      "## Never claim (not in the candidate's experience)\n" +
        profile.doNotClaim.map((d) => `- ${d}`).join("\n")
    )
  }

  if (interviewPrep?.likelyQuestions.length) {
    sections.push(
      "## Prepared answers to likely questions\n" +
        interviewPrep.likelyQuestions
          .map(
            (q) =>
              `Q: ${q.question}\n` +
              q.points.map((p) => `  - ${p}`).join("\n") +
              (q.refs.length ? `\n  refs: ${q.refs.join(", ")}` : "")
          )
          .join("\n")
    )
  }

  if (documents.trim()) {
    sections.push(
      `## Source documents (for details; facts above take precedence)\n\n${documents.trim()}`
    )
  }

  return sections.join("\n\n")
}
