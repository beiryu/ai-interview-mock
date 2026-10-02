import { cvBlock } from "@/lib/cv/render"
import type { CvContent } from "@/lib/cv/schema"

import {
  ANSWER_LABELS,
  EMPTY_ANSWERS,
  type AnswerField,
  type Answers,
  type JobPrep,
} from "./schema"

// The brief is sent with every answer: input size drives cost and time to
// first token (a full CV prep rendered to ~31k chars ≈ 8k tokens). The
// stored prep stays complete; only what the coach reads is trimmed.
const MAX_QUESTIONS = 8
const MAX_POINTS = 2

/**
 * Renders a job's brief for the coach: the job, its CV (the only experience
 * the candidate has — what the employer saw), the prep and your answers,
 * as compact text with the ids answers cite. Deterministic (same input →
 * same text) so the prefix stays prompt-cacheable for the whole interview.
 */
export function renderJobBrief({
  job,
  cv,
  practice = false,
  prep,
  answers,
}: {
  job: { company: string; title: string; notes: string | null; jdText: string }
  cv: CvContent | null
  /** The CV is a fictional practice persona */
  practice?: boolean
  prep: JobPrep | null
  answers: Answers | null
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
      (practice
        ? "## Candidate CV (a practice persona: answer as this candidate; it is the only experience they have)\n"
        : "## Candidate CV (sent to this employer: the only experience the candidate has; answers must match it; stretches have an honest answer ready)\n") +
        cvBlock(cv)
    )
  }

  if (prep) {
    if (prep.angle.trim()) {
      sections.push(`## Why this role (angle)\n${prep.angle.trim()}`)
    }
    if (prep.requirements.length) {
      sections.push(
        "## Job requirements → evidence\n" +
          prep.requirements
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
    if (prep.stories.length) {
      sections.push(
        "## Stories (STAR, approved by the candidate)\n" +
          prep.stories
            .map(
              (s) =>
                `${s.id} [${s.theme}] ${s.title}${
                  s.sourceIds.length ? ` (${s.sourceIds.join(", ")})` : ""
                }\n` +
                `  S: ${s.situation}\n  T: ${s.task}\n  A: ${s.action}\n  R: ${s.result}`
            )
            .join("\n")
      )
    }
  }

  const personal = { ...EMPTY_ANSWERS, ...answers }
  sections.push(
    "## Personal answers (blank = unknown: answer without stating a specific, never guess)\n" +
      [
        `30-second intro: ${prep?.intro.trim() || "(blank)"}`,
        ...(Object.keys(ANSWER_LABELS) as AnswerField[]).map(
          (key) => `${ANSWER_LABELS[key]}: ${personal[key].trim() || "(blank)"}`
        ),
      ].join("\n")
  )

  if (prep?.doNotClaim.length) {
    sections.push(
      "## Never claim (not in the candidate's experience)\n" +
        prep.doNotClaim.map((d) => `- ${d}`).join("\n")
    )
  }

  if (prep?.likelyQuestions.length) {
    sections.push(
      "## Prepared answers to likely questions\n" +
        prep.likelyQuestions
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

  // Without a prep yet, the JD itself tells the coach what the role wants
  if (!prep && job.jdText.trim()) {
    sections.push(`## Job description\n${job.jdText.trim()}`)
  }

  return sections.join("\n\n")
}
