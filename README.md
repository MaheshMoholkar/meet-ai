# Meet AI

Voice calls with AI agents you design. Create an agent with its own instructions, start a meeting, talk to it, and get a transcript, an audio recording, a summary and a chat about the meeting afterwards.

A rebuild of CodeWithAntonio's Meet AI with the SaaS dependencies replaced by self-hosted or AWS-native pieces. Design: [`docs/superpowers/specs/2026-10-03-meet-ai-rebuild-design.md`](docs/superpowers/specs/2026-10-03-meet-ai-rebuild-design.md).

## Status

| # | Sub-project | State |
|---|---|---|
| 1 | Core app — auth, agents, meetings, dashboard | ✅ done |
| 2 | Call stack — LiveKit, Python voice agent, webhooks, daily budget | ✅ done |
| 3 | Post-call pipeline — transcript, summary, recording, Ask AI | ✅ done |
| 4 | AWS deployment | planned |

## Stack

Next.js 16 (App Router, Turbopack) · React 19 · TypeScript · Tailwind v4 · shadcn/ui · tRPC v11 + TanStack Query · Drizzle ORM + Postgres 17 · Better Auth · zod · nuqs · Vitest · Playwright

Calls: self-hosted LiveKit (server + Egress) · LiveKit Agents (Python) · Vercel AI SDK · S3 + SQS (moto locally)

## How it fits together

```
Browser ──▶ Next.js (pages, tRPC, Better Auth, /api/webhooks/livekit, Ask AI) ──▶ Postgres
   │ WebRTC                     ▲ webhooks
   ▼                            │
LiveKit server ─────────────────┘──▶ Egress ──▶ S3 recordings/{id}.mp4
   │ dispatch
   ▼
Voice agent (Python): STT → LLM → TTS ──▶ S3 transcripts/{id}.jsonl + SQS message
                                                   │
                                     Summarizer worker (TS) ──▶ LLM ──▶ Postgres
```

| Piece | Local dev | Prod (AWS) |
|---|---|---|
| Postgres, Redis, LiveKit, Egress | Docker Compose | RDS, ElastiCache/EC2 |
| S3 + SQS | moto in Docker | S3 + SQS |
| LLM | Ollama (homelab or local) | Bedrock |
| Speech-to-text / text-to-speech | local Whisper + Kokoro | Transcribe / Polly |

## Getting started

Requirements: Node 24, pnpm 11, Docker Desktop.

```bash
cp .env.example .env               # then set BETTER_AUTH_SECRET and LIVEKIT_API_SECRET
pnpm install
make dev                           # infrastructure in Docker, migrations, then next dev
pnpm worker                        # summarizer worker (second terminal)
```

For calls, also run (each in its own terminal):

```bash
make speech        # local Whisper + Kokoro on Metal (port 8000); see speech/
make warmup        # load the speech models and pin the Ollama model in memory
make agent         # the voice agent worker; see agent/
```

`LLM_BASE_URL` must point at an Ollama: the homelab (`https://ollama.lab.maheshmoholkar.in/v1`, needs Tailscale) or a local one (`http://localhost:11434/v1`). With Ollama.app's default 4k context, set `LLM_MAX_INPUT_TOKENS=3000`.

Open http://localhost:3000 and sign up with any email and password. GitHub and Google sign-in appear once their client id and secret are set in `.env`.

The Makefile pins Docker to the local `desktop-linux` context, so a globally selected remote Docker context is never used.

## Scripts

| Command | What it does |
|---|---|
| `make up` / `make down` | Start / stop infrastructure and create the S3 bucket and SQS queues (Postgres data is kept; the AWS emulator resets) |
| `pnpm worker` | Summarizer worker (SQS → LLM → Postgres) |
| `pnpm dev` | Next dev server |
| `pnpm db:generate` | Generate a SQL migration from `src/db/schema.ts` |
| `pnpm db:migrate` | Apply migrations |
| `pnpm test` | Unit + integration tests (Vitest, against the `meetai_test` database) |
| `pnpm test:e2e` | Playwright E2E (own dev server on port 3100 against `meetai_test`; runs next to `pnpm dev`) |
| `make agent-test` | Agent tests (pytest) and ruff |
| `pnpm typecheck` / `pnpm lint` / `pnpm build` | Checks |

## Layout

```
src/app/                 routes: server prefetch → HydrationBoundary → Suspense → ErrorBoundary → client view
src/modules/<feature>/   server/procedures.ts, schemas.ts, params.ts, types.ts, hooks/, ui/
src/trpc/                context (session loaded once per request), client, server, routers
src/db/                  Drizzle schema and client
src/proxy.ts             optimistic auth redirect (Next 16's middleware)
drizzle/                 versioned SQL migrations
tests/                   integration tests and helpers
e2e/                     Playwright tests
ref/                     the original app, for study only (gitignored)
```

`STUDY.md` has notes on how the original app works and what this rebuild changes.
