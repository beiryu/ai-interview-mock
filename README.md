# Interview Copilot

A personal live-interview assistant. During a video interview it captures the
meeting tab's audio and your microphone, transcribes both in real time, detects
the interviewer's questions and suggests answers grounded in your own documents
(resume, job descriptions, notes). Transcripts are saved so you can review
sessions afterwards.

Single-user by design: only emails listed in `ALLOWED_EMAILS` can sign in.

## Stack

- Next.js 16 (App Router, Turbopack), React 19, Tailwind + shadcn/ui
- Better Auth (GitHub OAuth, email magic link via Resend)
- Prisma 7 + PostgreSQL (`@prisma/adapter-pg`)
- Soniox real-time speech-to-text (Vietnamese + English, per-word language ID, semantic end-of-turn)
- OpenAI Agents SDK (answer coach reads an interview brief built from your documents), Responses API + hosted vector stores (`file_search`) for Document Chat

## Getting started

Requires Node 22 (`.nvmrc`), pnpm and Docker.

```bash
pnpm install                 # also generates the Prisma client
cp .env.example .env         # fill in the values below
docker compose up -d         # PostgreSQL on :5432
pnpm prisma migrate deploy   # apply migrations
pnpm dev                     # http://localhost:3000
```

| Variable | Purpose |
| --- | --- |
| `NEXT_PUBLIC_APP_URL`, `BETTER_AUTH_URL` | App origin, e.g. `http://localhost:3000` |
| `BETTER_AUTH_SECRET` | Random secret (`openssl rand -base64 32`) |
| `ALLOWED_EMAILS` | Comma-separated emails allowed to sign in |
| `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET` | GitHub OAuth app, callback `/api/auth/callback/github` |
| `SMTP_FROM`, `RESEND_API_KEY` | Sender and API key for magic-link emails |
| `DATABASE_URL` | PostgreSQL connection string |
| `OPENAI_API_KEY`, `OPENAI_BASE_URL` | OpenAI access |
| `SONIOX_API_KEY` | Soniox access (browser gets short-lived keys via `/api/stt/token`) |

## Using it

1. Upload your resume, job descriptions and notes under **Documents**.
2. Create an **Interview** with the company, role, notes, and pick the
   documents the coach should read (your CV + this job's description).
3. Launch it, click **Share the meeting tab** and pick the tab running the
   call (with "share tab audio" enabled). Turn on your mic to transcribe your
   own answers too.
4. Suggested answers appear as the interviewer asks questions. **End session**
   saves the transcript, viewable under **Past sessions**.

## Scripts

```bash
pnpm lint        # ESLint
pnpm typecheck   # tsc --noEmit
pnpm build       # production build
pnpm test        # unit tests (turn detection)
pnpm stt:smoke   # live Soniox + turn-engine check with synthesized VI/EN speech (macOS)
```

## License

[MIT](LICENSE.md)
