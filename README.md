# Interview Copilot

A personal live-interview assistant. During a video interview it captures the
meeting tab's audio and your microphone, transcribes both in real time, detects
the interviewer's questions and suggests answers grounded in the CV you sent
(resume, job descriptions, notes). Transcripts are saved so you can review
sessions afterwards.

Single-user by design: only emails listed in `ALLOWED_EMAILS` can sign in.

## Stack

- Next.js 16 (App Router, Turbopack), React 19, Tailwind + shadcn/ui
- Better Auth: sign in with an allowlisted email, local machine only (no email is sent)
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
| `DATABASE_URL`                           | PostgreSQL connection string                                       |
| `AI_GATEWAY_API_KEY`                     | Vercel AI Gateway (every LLM call)                                 |
| `SONIOX_API_KEY`                         | Soniox access (browser gets short-lived keys via `/api/stt/token`) |

## Using it

1. See a job you like? **Jobs → New job**: paste its description (or drop
   the PDF) and pick where its CV comes from:
   - **Upload a CV** (your real one) or **one of your CVs** → it is refined
     for this job, true to your CV. Wording that goes a little beyond it is
     framed in amber with what to say if asked; approve it, fix it or remove
     the line, then **Download PDF**.
   - **Generate from the JD** → a fictional practice persona, to rehearse
     with; its PDF says "fictional, for practice" on every page.
   Company and role are read from the JD. Every CV is under **CVs**.
2. Fill in **your answers for this job** (salary, why this company, notice…)
   in its Job description tab; the next job starts with them.
3. Track where each application stands with its status.
4. Invited? Open the job and click **Schedule interview**. It moves to
   Interviewing, shows on Home, and its **Prep** tab maps the JD to your
   evidence on the CV you sent, with STAR stories and likely questions.
5. On the day, **Launch interview**, click **Share the meeting tab** and
   pick the tab running the call (with "share tab audio" enabled). Turn on
   your mic to transcribe your own answers too. The coach stays consistent
   with the CV you sent.
6. Suggested answers appear as the interviewer asks questions. **End session**
   saves the transcript, viewable in the job's **Sessions** tab.

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
