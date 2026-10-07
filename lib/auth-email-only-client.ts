import type { BetterAuthClientPlugin } from "better-auth"

import type { emailOnly } from "./auth-email-only"

/** Client side of lib/auth-email-only.ts: `authClient.signIn.emailOnly({ email })`. */
export function emailOnlyClient() {
  return {
    id: "email-only",
    $InferServerPlugin: {} as ReturnType<typeof emailOnly>,
  } satisfies BetterAuthClientPlugin
}
