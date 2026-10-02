import { cvBlock } from "@/lib/cv/render"
import type { TailoredCv } from "@/lib/cv/schema"
import type { BriefJob } from "@/lib/interview/brief"

import {
  PERSONAL_LABELS,
  type InterviewPrep,
  type PersonalField,
  type ProfilePrep,
} from "./schema"

// The brief is sent with every answer: input size drives cost and time to
// first token (a full CV prep rendered to ~31k chars ≈ 8k tokens). The
// stored prep stays complete; only what the coach reads is trimmed.
const MAX_HIGHLIGHTS = 4
const MAX_STACK = 10
const MAX_QUESTIONS = 8
const MAX_POINTS = 2

/** Highlights with numbers first (the concrete ones), original order kept. */
export function topHighlights(highlights: string[], max = MAX_HIGHLIGHTS) {
  const scored = highlights.map((text, index) => ({
    text,
    index,
    score: /\d/.test(text) ? 1 : 0,
  }))
  return scored
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .slice(0, max)
    .sort((a, b) => a.index - b.index)
    .map((h) => h.text)
}

/**
 * Renders the prep pack as the coach's brief: compact text with the ids
 * answers cite. Deterministic (same prep → same text) so the prefix stays
 * prompt-cacheable for the whole interview.
 */
export function renderPrepBrief({
  job,
  profile,
  interviewPrep,
  cv = null,
  documents,
}: {
  job: Pick<BriefJob, "company" | "title" | "notes">
  profile: ProfilePrep
  interviewPrep: InterviewPrep | null
  /** The CV sent to this employer: answers must match it */
  cv?: TailoredCv | null
  /** Raw documents for details the prep didn't capture (may be "") */
  documents: string
}) {
  const sections: string[] = []

  const header = [
    job.title && `Role: ${job.title}`,
    job.company && `Company: ${job.company}`,
    job.notes && `Notes from the candidate: ${job.notes.trim()}`,
  ].filter(Boolean)
  if (header.length) sections.push(`## Interview\n${header.join("\n")}`)

  if (cv) {
    sections.push(
      "## CV sent to this employer (answers must match it; stretches have an honest answer ready)\n" +
        cvBlock(cv)
    )
  }

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
            if (f.stack.length) {
              lines.push(`  stack: ${f.stack.slice(0, MAX_STACK).join(", ")}`)
            }
            for (const h of topHighlights(f.highlights)) lines.push(`  - ${h}`)
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
    "## Personal answers (blank = unknown: answer without stating a specific, never guess)\n" +
      (Object.keys(PERSONAL_LABELS) as PersonalField[])
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
          .slice(0, MAX_QUESTIONS)
          .map(
            (q) =>
              `Q: ${q.question}\n` +
              q.points
                .slice(0, MAX_POINTS)
                .map((p) => `  - ${p}`)
                .join("\n") +
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
