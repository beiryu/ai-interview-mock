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

export const auth = betterAuth({
  baseURL: env.BETTER_AUTH_URL,
  secret: env.BETTER_AUTH_SECRET,
  database: prismaAdapter(db, { provider: "postgresql" }),
  advanced: {
    // Let Prisma's @default(cuid()) generate ids, matching existing rows
    database: { generateId: false },
  },
  user: {
    additionalFields: {
      phone: { type: "string", required: false, input: false },
    },
  },
  session: {
    cookieCache: { enabled: true, maxAge: 5 * 60 },
  },
  socialProviders: {
    github: {
      clientId: env.GITHUB_CLIENT_ID,
      clientSecret: env.GITHUB_CLIENT_SECRET,
    },
  },
  plugins: [
    magicLink({
      sendMagicLink: async ({ email, url }) => {
        const user = await db.user.findUnique({
          where: { email },
          select: { emailVerified: true },
        })

        const subject = user?.emailVerified
          ? `Sign in to ${siteConfig.name}`
          : `Activate your ${siteConfig.name} account`

        const { error } = await resend.emails.send({
          from: env.SMTP_FROM,
          to: email,
          subject,
          react: EmailTemplate({
            type: "sign-in",
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
