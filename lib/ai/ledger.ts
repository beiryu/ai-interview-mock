import { z } from "zod"

import { runObject } from "./run"

/**
 * The session ledger: what has happened in this interview so far, so the
 * coach stays consistent for the whole hour instead of only the last few
 * turns. Updated in the background after each answered question; read by
 * the coach on every answer (after the cached prefix).
 */

export const LedgerSchema = z.object({
  asked: z.array(z.object({ question: z.string(), kind: z.string() })),
  /** Story ids (S*) the candidate already told */
  storiesUsed: z.array(z.string()),
  /** Concrete things the candidate said about themselves */
  claims: z.array(z.string()),
  /** What the interviewer seems to care about */
  focus: z.string(),
})

export type Ledger = z.infer<typeof LedgerSchema>

export const EMPTY_LEDGER: Ledger = {
  asked: [],
  storiesUsed: [],
  claims: [],
  focus: "",
}

const UpdateSchema = z.object({
  storiesUsed: z
    .array(z.string())
    .describe(
      "Ids of the listed stories the candidate actually told in WHAT THE CANDIDATE SAID"
    ),
  newClaims: z
    .array(z.string())
    .describe(
      "Concrete facts the candidate stated about themselves (numbers, tech, roles, opinions), short, no duplicates of KNOWN CLAIMS"
    ),
  focus: z
    .string()
    .describe("One sentence: what the interviewer seems to care about so far"),
})

// Keep the ledger small: it is sent with every answer
const MAX_ASKED = 30
const MAX_CLAIMS = 40

export function mergeLedger(
  ledger: Ledger,
  update: {
    question: string
    kind: string
    storiesUsed: string[]
    newClaims: string[]
    focus: string
  }
): Ledger {
  return {
    asked: [
      ...ledger.asked,
      { question: update.question, kind: update.kind },
    ].slice(-MAX_ASKED),
    storiesUsed: [...new Set([...ledger.storiesUsed, ...update.storiesUsed])],
    claims: [
      ...ledger.claims,
      ...update.newClaims.filter((c) => !ledger.claims.includes(c)),
    ].slice(-MAX_CLAIMS),
    focus: update.focus || ledger.focus,
  }
}

/** The ledger as a prompt block for the coach ("" when nothing happened yet). */
export function renderLedger(ledger: Ledger) {
  if (!ledger.asked.length) return ""
  return [
    "SESSION SO FAR:",
    `Asked: ${ledger.asked.map((a) => a.question).join(" | ")}`,
    ledger.storiesUsed.length
      ? `Stories already told (pick another unless asked again): ${ledger.storiesUsed.join(
          ", "
        )}`
      : "",
    ledger.claims.length
      ? `The candidate already said (stay consistent): ${ledger.claims.join(
          "; "
        )}`
      : "",
    ledger.focus ? `Interviewer focus: ${ledger.focus}` : "",
  ]
    .filter(Boolean)
    .join("\n")
}

export async function updateLedger({
  ledger,
  question,
  kind,
  suggested,
  said,
  stories,
}: {
  ledger: Ledger
  question: string
  kind: string
  suggested: string
  said: string
  /** "S1 Matchmaking priority" lines from the prep */
  stories: string[]
}) {
  const { output } = await runObject("ledger", UpdateSchema, {
    instructions:
      "You keep notes on a live job interview for the candidate's coach. Record only what the candidate actually said (WHAT THE CANDIDATE SAID), not what was suggested to them.",
    prompt: [
      `QUESTION: ${question}`,
      `SUGGESTED ANSWER (may not have been used): ${suggested}`,
      `WHAT THE CANDIDATE SAID: ${said}`,
      stories.length ? `STORIES:\n${stories.join("\n")}` : "",
      ledger.claims.length ? `KNOWN CLAIMS: ${ledger.claims.join("; ")}` : "",
      ledger.focus ? `FOCUS SO FAR: ${ledger.focus}` : "",
    ]
      .filter(Boolean)
      .join("\n\n"),
  })
  return mergeLedger(ledger, { question, kind, ...output })
}
