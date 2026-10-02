import type { BetterAuthPlugin } from "better-auth"
import { APIError, createAuthEndpoint } from "better-auth/api"
import { setSessionCookie } from "better-auth/cookies"
import * as z from "zod"

import { isLocalHost, normalizeEmail } from "./auth-local"

/**
 * Personal-use sign-in: an allowlisted email is enough, no email or code.
 * Anyone who can reach the login page and knows the address could sign in,
 * so it only works from this machine: the app listens on 127.0.0.1
 * (package.json) and requests for any other host are refused here too.
 * Deploying publicly would need a verified sign-in method again.
 */
export function emailOnly({
  isAllowed,
}: {
  isAllowed: (email: string) => boolean
}) {
  return {
    id: "email-only",
    endpoints: {
      signInEmailOnly: createAuthEndpoint(
        "/sign-in/email-only",
        {
          method: "POST",
          body: z.object({ email: z.string().email() }),
        },
        async (ctx) => {
          if (!isLocalHost(ctx.headers?.get("host"))) {
            throw new APIError("FORBIDDEN", {
              message: "Email-only sign-in works on this computer only",
            })
          }
          const email = normalizeEmail(ctx.body.email)
          if (!isAllowed(email)) {
            throw new APIError("UNAUTHORIZED", {
              message: "This email can't sign in here",
            })
          }

          const adapter = ctx.context.internalAdapter
          const user =
            (await adapter.findUserByEmail(email))?.user ??
            (await adapter.createUser(
              { email, emailVerified: true, name: email.split("@")[0] },
              { method: "email-only" }
            ))
          if (!user) {
            throw new APIError("INTERNAL_SERVER_ERROR", {
              message: "Could not create the account",
            })
          }

          const session = await adapter.createSession(user.id)
          if (!session) {
            throw new APIError("INTERNAL_SERVER_ERROR", {
              message: "Could not create a session",
            })
          }
          await setSessionCookie(ctx, { session, user })
          return ctx.json({ ok: true })
        }
      ),
    },
    rateLimit: [
      {
        pathMatcher: (path: string) => path === "/sign-in/email-only",
        window: 60,
        max: 5,
      },
    ],
  } satisfies BetterAuthPlugin
}
