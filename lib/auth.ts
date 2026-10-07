import { betterAuth } from "better-auth"
import { prismaAdapter } from "better-auth/adapters/prisma"
import { nextCookies } from "better-auth/next-js"

import { env } from "@/env.mjs"
import { db } from "@/lib/db"

import { emailOnly } from "./auth-email-only"
import { normalizeEmail } from "./auth-local"

const allowedEmails = new Set(
  env.ALLOWED_EMAILS.split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean)
)

function isAllowedEmail(email: string) {
  return allowedEmails.has(normalizeEmail(email))
}

export const auth = betterAuth({
  baseURL: env.BETTER_AUTH_URL,
  secret: env.BETTER_AUTH_SECRET,
  database: prismaAdapter(db, { provider: "postgresql" }),
  advanced: {
    // Let Prisma's @default(cuid()) generate ids, matching existing rows
    database: { generateId: false },
  },
  databaseHooks: {
    user: {
      create: {
        // Personal-use app: only allowlisted emails may get an account
        before: async (user) => {
          if (!isAllowedEmail(user.email)) return false
        },
      },
    },
  },
  session: {
    cookieCache: { enabled: true, maxAge: 5 * 60 },
  },
  plugins: [
    // An allowlisted email is enough to sign in, from this machine only
    emailOnly({ isAllowed: isAllowedEmail }),
    // Must be last: lets server actions set auth cookies
    nextCookies(),
  ],
})

export type SessionUser = typeof auth.$Infer.Session.user
