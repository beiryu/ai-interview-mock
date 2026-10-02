# Interview Copilot

A personal live-interview assistant. During a video interview it captures the
meeting tab's audio and your microphone, transcribes both in real time, detects
the interviewer's questions and suggests answers grounded in your own documents
(resume, job descriptions, notes). Transcripts are saved so you can review
sessions afterwards.

Single-user by design: only emails listed in `ALLOWED_EMAILS` can sign in.

## Stack

- Next.js 16 (App Router, Turbopack), React 19, Tailwind + shadcn/ui
- Better Auth (email magic link via Resend)
- Prisma 7 + PostgreSQL (`@prisma/adapter-pg`)
- Soniox real-time speech-to-text (Vietnamese + English, per-word language ID, semantic end-of-turn)
- Vercel AI SDK through the Vercel AI Gateway (DeepSeek by default; model per task in `config/defaults/ai.ts`): prep packs before the interview, then the live turn judge, answer coach, session ledger and chat

## Getting started

Requires Node 22 (`.nvmrc`), pnpm and Docker.

```bash
pnpm install                 # also generates the Prisma client
cp .env.example .env         # fill in the values below
docker compose up -d         # PostgreSQL on :5434
pnpm prisma migrate deploy   # apply migrations
pnpm prisma db seed          # create the account(s) in ALLOWED_EMAILS
pnpm dev                     # http://localhost:3000
```

| Variable                                 | Purpose                                                            |
| ---------------------------------------- | ------------------------------------------------------------------ |
| `NEXT_PUBLIC_APP_URL`, `BETTER_AUTH_URL` | App origin, e.g. `http://localhost:3000`                           |
| `BETTER_AUTH_SECRET`                     | Random secret (`openssl rand -base64 32`)                          |
| `ALLOWED_EMAILS`                         | Comma-separated emails allowed to sign in                          |
| `SMTP_FROM`, `RESEND_API_KEY`            | Sender and API key for magic-link emails                           |
| `DATABASE_URL`                           | PostgreSQL connection string                                       |
| `AI_GATEWAY_API_KEY`                     | Vercel AI Gateway (every LLM call)                                 |
| `SONIOX_API_KEY`                         | Soniox access (browser gets short-lived keys via `/api/stt/token`) |

## Using it

1. Upload your resume, portfolio, notes and job descriptions under
   **Documents**.
2. Open **Profile prep**, click Prepare, then review it: fix the STAR
   stories, fill in your personal answers (salary, why leaving, …), check
   the never-claim list. The coach only says what's here.
3. Create an **Interview** with the company, role and notes, and pick this
   job's description. Its **Prep** sheet maps the JD to your evidence.
4. Launch it, click **Share the meeting tab** and pick the tab running the
   call (with "share tab audio" enabled). Turn on your mic to transcribe your
   own answers too.
5. Suggested answers appear as the interviewer asks questions. **End session**
   saves the transcript, viewable under **Past sessions**.

## Scripts

```bash
pnpm lint        # ESLint
pnpm typecheck   # tsc --noEmit
pnpm build       # production build
pnpm test        # unit tests (turn detection)
pnpm stt:smoke   # live Soniox + turn-engine check with synthesized VI/EN speech (macOS)
pnpm ai:eval     # turn judge + answer coach against real models (latency, caching, accuracy)
```

## License

[MIT](LICENSE.md)
