import { createAuthClient } from "better-auth/react"

import { emailOnlyClient } from "./auth-email-only-client"

export const authClient = createAuthClient({
  plugins: [emailOnlyClient()],
})
