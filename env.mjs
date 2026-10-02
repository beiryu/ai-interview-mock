import { createEnv } from "@t3-oss/env-nextjs"
import { z } from "zod"

export const env = createEnv({
  // Treat `KEY=` lines in .env as unset
  emptyStringAsUndefined: true,
  server: {
    BETTER_AUTH_URL: z.string().min(1),
    BETTER_AUTH_SECRET: z.string().min(1),
    // Comma-separated emails allowed to sign in (personal-use app)
    ALLOWED_EMAILS: z.string().min(1),
    DATABASE_URL: z.string().min(1),
    // Optional so the app boots without it; /api/stt/token reports it missing
    SONIOX_API_KEY: z.string().min(1).optional(),
    // Vercel AI Gateway: every LLM call (judge, coach, …) goes through it
    AI_GATEWAY_API_KEY: z.string().min(1).optional(),
  },
  client: {
    NEXT_PUBLIC_APP_URL: z.string().min(1),
  },
  runtimeEnv: {
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
    BETTER_AUTH_URL: process.env.BETTER_AUTH_URL,
    BETTER_AUTH_SECRET: process.env.BETTER_AUTH_SECRET,
    ALLOWED_EMAILS: process.env.ALLOWED_EMAILS,
    DATABASE_URL: process.env.DATABASE_URL,
    SONIOX_API_KEY: process.env.SONIOX_API_KEY,
    AI_GATEWAY_API_KEY: process.env.AI_GATEWAY_API_KEY,
  },
})
