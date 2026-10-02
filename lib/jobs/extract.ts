import { z } from "zod"

import { runObject } from "@/lib/ai/run"

const JobInfo = z.object({
  company: z
    .string()
    .describe('The hiring company as written, "" if the JD does not name it'),
  title: z
    .string()
    .describe(
      'The role, short (e.g. "Full-stack Developer"), "" if not stated'
    ),
})

/**
 * Company and title from a pasted job description. Never blocks creating
 * the job: on any failure both stay blank for you to fill in.
 */
export async function extractJobInfo(jdText: string) {
  try {
    const { output } = await runObject("jobInfo", JobInfo, {
      instructions:
        "You read a job posting and return the hiring company and the job title, copied from the text. Recruiter or agency names are not the company when the client is named. Never guess.",
      prompt: jdText.slice(0, 6000),
    })
    return {
      company: output.company.trim().slice(0, 120),
      title: output.title.trim().slice(0, 160),
    }
  } catch (error) {
    console.error("Job info extraction failed:", error)
    return { company: "", title: "" }
  }
}
