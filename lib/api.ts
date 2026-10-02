import { NextResponse } from "next/server"

/**
 * Route handler helper: "X not found" errors from the services (an id that
 * isn't yours) become 404s, bad input from a service (Error with a message
 * meant for you) becomes 409; anything else stays a 500.
 */
export async function handle(run: () => Promise<Response>) {
  try {
    return await run()
  } catch (error) {
    const message = error instanceof Error ? error.message : ""
    if (/not found$/i.test(message)) {
      return NextResponse.json({ error: message }, { status: 404 })
    }
    if (error instanceof UserError) {
      return NextResponse.json({ error: message }, { status: 409 })
    }
    throw error
  }
}

/** An error whose message is for the user (shown as-is, 409). */
export class UserError extends Error {}
