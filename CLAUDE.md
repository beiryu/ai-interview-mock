# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
pnpm install          # Install dependencies (postinstall runs prisma generate)
pnpm dev              # Run next dev
pnpm build            # next build
pnpm lint             # Run ESLint
pnpm start            # Start production server
```

Database setup (requires Docker):

```bash
docker-compose up -d  # Start PostgreSQL on port 5432
pnpm prisma migrate dev   # Run migrations
pnpm prisma studio        # Open Prisma Studio GUI
```

Environment: copy `.env.example` to `.env.local` and fill in values. `ALLOWED_EMAILS` lists who may sign in (single-user app).

## Architecture

**Next.js 16 App Router** (React 19, Turbopack) with route groups:

- `app/(auth)` — Login page, no layout shell
- `app/(dashboard)` — Protected pages (sidebar layout): home, interviews (+ live session and past sessions), documents, document chat, settings
- `app/api` — Route handlers for interviews, documents, chat/RAG, Deepgram, auth, user settings
- `app/page.tsx` redirects `/` to `/dashboard` (personal-use app, no marketing site or payments)

**Proxy** (`proxy.ts`, Next 16's renamed middleware) protects `/dashboard` and `/login` with an optimistic Better Auth session-cookie check; pages and route handlers still validate via `getCurrentUser()` and scope queries by `userId`.

**Database** (Prisma 7 + PostgreSQL via `@prisma/adapter-pg`): client is generated to `lib/generated/prisma` (import types from `@/lib/generated/prisma/client`, enums from `.../enums`); datasource URL lives in `prisma.config.ts`. Auth tables (`User`, `Account`, `Session`, `Verification`) follow the Better Auth schema.

**Auth**: Better Auth (`lib/auth.ts`) with GitHub OAuth and magic link (Resend); a `databaseHooks.user.create.before` allowlist blocks sign-ups outside `ALLOWED_EMAILS`. Handler at `app/api/auth/[...all]`; client helpers in `lib/auth-client.ts`; server code uses `getCurrentUser()` from `lib/session.ts` or `auth.api.getSession({ headers })`.

**Live interview flow**: the playground captures the meeting tab (`hooks/use-microphone.ts`, getDisplayMedia) and the candidate mic (`hooks/use-microphone-only.ts`), each streamed to Deepgram. Transcript and AI suggestions live in `stores/interview-session.store.ts`. `hooks/use-interview-session-lifecycle.ts` creates the `InterviewSession` row only once capture starts and persists the transcript (autosave, on end, `sendBeacon` on tab close).

**AI**: OpenAI Responses API + per-user hosted vector store (`lib/openai/*`); answer coach agent in `lib/agents/interview-agents.ts`. No Redis — cached ids live in Postgres.

**Config** (`/config`): Operator defaults (OpenAI, Deepgram, interview), site metadata and the user-config schema.

**Environment validation** (`env.mjs`): All env vars are validated with Zod at startup. Add new variables here when introducing new integrations.

## Key Patterns

- Server Components are the default; Client Components use `"use client"` directive
- UI primitives live in `components/ui/` (Radix-based, unstyled) — these are composable building blocks, not page-level components
- `lib/utils.ts` exports `cn()` (clsx + tailwind-merge) for conditional classnames
- API routes validate request bodies with Zod schemas defined inline
- `lib/auth.ts` exports `auth` and the `SessionUser` type; `lib/session.ts` exports `getCurrentUser()` used across server components

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
