import type { PrepStatus } from "@/lib/prep/schema"

/**
 * The lifecycle shared by everything generated in the background (CVs, job
 * preps): a row is "pending" while `after()` runs it, then "ready" or
 * "failed"; "stale" is computed when what it was built from changed. The
 * API returns at once and the UI polls the status.
 */

// A pending run older than this was lost (server restart): allow a new one
const PENDING_TIMEOUT_MS = 5 * 60_000

/** Readable one-paragraph error (gateway errors carry ANSI colors). */
export function errorMessage(error: unknown) {
  const text = error instanceof Error ? error.message : String(error)
  return text
    .replace(/\u001b\[[0-9;]*m/g, "")
    .split("\n\n")[0]
    .trim()
}

export function effectiveStatus(
  row: { status: string; sourceHash: string | null; startedAt: Date | null },
  currentHash: string | null
): PrepStatus {
  if (row.status === "pending") {
    const age = Date.now() - (row.startedAt?.getTime() ?? 0)
    return age > PENDING_TIMEOUT_MS ? "failed" : "pending"
  }
  if (
    row.status === "ready" &&
    currentHash !== null &&
    row.sourceHash !== null &&
    row.sourceHash !== currentHash
  ) {
    return "stale"
  }
  return row.status as PrepStatus
}

/** Is a run already going (and not lost)? */
export function isRunning(
  row: { status: string; startedAt: Date | null } | null
) {
  return (
    row?.status === "pending" &&
    Date.now() - (row.startedAt?.getTime() ?? 0) < PENDING_TIMEOUT_MS
  )
}
