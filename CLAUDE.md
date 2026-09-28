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

Environment: copy `.env.example` to `.env.local` and fill in values.

## Architecture

**Next.js 13 App Router** with route groups organizing the app into logical sections:

- `app/(auth)` — Login/register pages, no layout shell
- `app/(dashboard)` — Protected pages (sidebar layout), requires auth
- `app/(editor)` — Editor.js-based post editor
- `app/(marketing)` — Public pages (home, pricing, blog)
- `app/api` — Route handlers for posts, auth, Stripe webhooks, user settings

**Middleware** (`middleware.ts`) protects `/dashboard`, `/editor`, `/login`, `/register` with an optimistic Better Auth session-cookie check; pages and route handlers still validate via `getCurrentUser()`.

**Database** (Prisma 7 + PostgreSQL via `@prisma/adapter-pg`): client is generated to `lib/generated/prisma` (import types from `@/lib/generated/prisma/client`, enums from `.../enums`); datasource URL lives in `prisma.config.ts`. Auth tables (`User`, `Account`, `Session`, `Verification`) follow the Better Auth schema.

**Payments**: Stripe checkout and billing portal; webhook handler under `app/api/webhooks/stripe`.

**Auth**: Better Auth (`lib/auth.ts`) with GitHub OAuth and magic link (Resend). Handler at `app/api/auth/[...all]`; client helpers in `lib/auth-client.ts`; server code uses `getCurrentUser()` from `lib/session.ts` or `auth.api.getSession({ headers })`.

**Config** (`/config`): Site metadata, dashboard nav, docs nav, and marketing nav are centralized here — update these when adding new routes/pages.

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
