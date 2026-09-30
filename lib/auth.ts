import { betterAuth } from "better-auth"
import { prismaAdapter } from "better-auth/adapters/prisma"
import { nextCookies } from "better-auth/next-js"
import { magicLink } from "better-auth/plugins"
import { Resend } from "resend"

import { env } from "@/env.mjs"
import { siteConfig } from "@/config/defaults/site"
import { db } from "@/lib/db"
import { EmailTemplate } from "@/components/email-template"

const resend = new Resend(env.RESEND_API_KEY)

const allowedEmails = new Set(
  env.ALLOWED_EMAILS.split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean)
)

function isAllowedEmail(email: string) {
  return allowedEmails.has(email.toLowerCase())
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
        // Personal-use app: only allowlisted emails may get an account,
        // (sign-in is by email magic link only).
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
    magicLink({
      sendMagicLink: async ({ email, url }) => {
        // Don't send mail to addresses that could never sign in
        if (!isAllowedEmail(email)) return

        const { error } = await resend.emails.send({
          from: env.SMTP_FROM,
          to: email,
          subject: `Sign in to ${siteConfig.name}`,
          react: EmailTemplate({
            url,
            productName: siteConfig.name,
          }),
          headers: {
            // Set this to prevent Gmail from threading emails
            "X-Entity-Ref-ID": new Date().getTime() + "",
          },
        })

        if (error) {
          throw new Error(error.message)
        }
      },
    }),
    // Must be last: lets server actions set auth cookies
    nextCookies(),
  ],
})

export type SessionUser = typeof auth.$Infer.Session.user
