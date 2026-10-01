# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
pnpm install          # Install dependencies (postinstall runs prisma generate)
pnpm dev              # Run next dev
pnpm build            # next build
pnpm lint             # Run ESLint
pnpm typecheck        # tsc --noEmit
pnpm test             # vitest (lib/**/*.test.ts)
pnpm ai:eval          # judge + answer coach against real models (needs keys + DB)
pnpm start            # Start production server
```

Database setup (requires Docker):

```bash
docker-compose up -d  # Start PostgreSQL on port 5432
pnpm prisma migrate dev   # Run migrations
pnpm prisma db seed       # Create the ALLOWED_EMAILS account(s) (prisma/seed.ts)
pnpm prisma studio        # Open Prisma Studio GUI
```

Environment: copy `.env.example` to `.env` and fill in values (the Prisma CLI reads `.env` via `prisma.config.ts`). `ALLOWED_EMAILS` lists who may sign in (single-user app).

## Architecture

**Next.js 16 App Router** (React 19, Turbopack) with route groups:

- `app/(auth)` — Login page, no layout shell
- `app/(dashboard)` — Protected pages (sidebar layout): home, interviews (+ live session with the prep sheet and chat, past sessions), documents, profile prep, settings
- `app/api` — Route handlers for interviews (+ prep, chat), documents, prep, the live assistant (judge, question, ledger), STT token, auth, user settings
- `app/page.tsx` redirects `/` to `/dashboard` (personal-use app, no marketing site or payments)

**Proxy** (`proxy.ts`, Next 16's renamed middleware) protects `/dashboard` and `/login` with an optimistic Better Auth session-cookie check; pages and route handlers still validate via `getCurrentUser()` and scope queries by `userId`.

**Database** (Prisma 7 + PostgreSQL via `@prisma/adapter-pg`): client is generated to `lib/generated/prisma` (import types from `@/lib/generated/prisma/client`, enums from `.../enums`); datasource URL lives in `prisma.config.ts`. Auth tables (`User`, `Account`, `Session`, `Verification`) follow the Better Auth schema.

**Auth**: Better Auth (`lib/auth.ts`) with email magic link (Resend) as the only sign-in method; a `databaseHooks.user.create.before` allowlist blocks sign-ups outside `ALLOWED_EMAILS`. Handler at `app/api/auth/[...all]`; client helpers in `lib/auth-client.ts`; server code uses `getCurrentUser()` from `lib/session.ts` or `auth.api.getSession({ headers })`.

**Live interview flow**: two streams, each `hooks/use-live-transcriber.ts` → `hooks/use-audio-capture.ts` (tab via getDisplayMedia / mic; an AudioWorklet in `public/worklets/pcm-capture.js` emits 16 kHz PCM + RMS) → `lib/stt/soniox-stream.ts` (Soniox `stt-rt-v5`, `language_hints` vi+en, semantic `<end>` endpoints; short-lived keys from `/api/stt/token`). Transcripts and audio levels feed `lib/turn/turn-engine.ts`, which decides when the interviewer finished (pause + text completeness in `lib/turn/completeness.ts` + Soniox `<end>` + candidate starting to talk), speculates an answer at the first pause and promotes it on commit. Wiring and answer streaming live in `stores/interview-session.store.ts`. `hooks/use-interview-session-lifecycle.ts` persists the transcript. Turn logic is unit-tested (`pnpm test`); `pnpm stt:smoke` exercises Soniox end-to-end with synthesized speech.

**AI**: every LLM call goes through the **Vercel AI Gateway** (`AI_GATEWAY_API_KEY`; no provider SDK or key in the app) with the AI SDK. `config/defaults/ai.ts` has one entry per task in `AI_TASKS` (gateway id like `deepseek/deepseek-v4.1-flash`, gateway fallbacks, limits); DeepSeek is the default and another model needs eval evidence. `lib/ai/models.ts` (gateway + per-task options: fallbacks, caching, `store: false`) and `lib/ai/run.ts` (`runStream` / `runObject`) are shared; tasks only own prompts:

- **Prep** (`lib/prep/*`, before the interview, strong model, background via `after()`): documents → _profile prep_ (facts P*, STAR stories S*, never-claim list, personal answers only the user fills) and per-interview _interview prep_ (JD requirements R\* → evidence, likely questions, angle). Stored in `profile_preps` / `interview_preps`; user edits lock items so regeneration keeps them; `sourceHash` marks stale preps. UI: `/dashboard/profile`, the interview's Prep sheet.
- **Coach** (`lib/ai/coach.ts`, `/api/assistant/question`): stateless per call; `lib/interview/load-brief.ts` renders the prep pack (stable, cacheable prefix; raw documents fill the remaining budget; no prep → raw documents). The coach classifies the question itself, answers with a headline, 3 points citing ids, then a script; `lib/answer/validate.ts` flags unknown ids, unsupported numbers and never-claim mentions on the card.
- **Judge** (`lib/ai/judge.ts`): is it an ask, is it complete, the merged question, its kind. **Ledger** (`lib/ai/ledger.ts`): after each answered question, what the candidate actually said is merged into `interview_sessions.ledger`, which the coach reads. **Chat** (`lib/ai/chat.ts`, `/api/interviews/[id]/chat`, `components/interview-chat.tsx` with `useChat`): prep brief + live transcript + history saved in Postgres.
- `pnpm ai:eval` (`scripts/ai-eval.mts`): judge cases, coach smoke, `prep`, and the graded coach eval (`generate` → `grade` / `compare` over `eval/coach-questions.json`; results in the gitignored `eval/results/`). Run it before and after changing a model or prompt. No provider-side state (no `previous_response_id`, no hosted vector stores). No Redis.

**Config** (`/config/defaults`): all tuning lives here as constants — AI tasks/models (`ai.ts`), Soniox STT params, turn-taking thresholds, site metadata. There is no per-user config.

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
