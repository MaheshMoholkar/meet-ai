# Meet AI Rebuild — Design

- **Date:** 2026-10-03
- **Status:** Draft for review
- **Scope of this spec:** the shared architecture for the whole rebuild, plus **sub-project 1 (Core app)** in implementation detail. Sub-projects 2–4 get their own specs.
- **Reference:** `ref/` (CodeWithAntonio's Meet AI, gitignored) and `STUDY.md` (study notes; §11 is superseded by this spec).

## 1. Goal

A public portfolio demo of an AI meeting app: a visitor signs up, creates an AI agent with custom instructions, starts a voice call with it, and afterwards gets a transcript, an audio recording, a summary, and a chat about the meeting.

Success criteria:

- A stranger can sign up on the public URL and complete a call end to end.
- Paid AI usage in prod is bounded by a global daily budget.
- Dev runs fully on the laptop plus the homelab's LLM; prod runs on AWS. Moving between them changes env vars and endpoints, not code paths.
- The codebase is a clean, tested reworking of `ref/`, not a copy: third-party SaaS replaced where reasonable, and the quirks in `STUDY.md` §8 fixed.

## 2. Decisions

| Area | Decision | Replaces in `ref/` |
|---|---|---|
| Billing | None. Polar and all premium gating removed | Polar, `premiumProcedure`, `/upgrade`, trial widget |
| Video/audio | Self-hosted **LiveKit** (server, Egress) | Stream Video |
| Voice agent | **LiveKit Agents (Python)**, cascade STT → LLM → TTS with providers chosen by env | Stream `connectOpenAi` + OpenAI Realtime |
| Post-call chat | Own `meeting_messages` table + streaming route handler | Stream Chat + `message.new` webhook |
| Background jobs | **SQS** (prod) / SQS emulator (dev) + TS worker | Inngest + agent-kit |
| Object storage | **S3** (prod) / S3 emulator (dev) | Stream-hosted recording/transcript URLs |
| Database | Postgres 17: Docker (dev), RDS (prod) | Neon |
| Text LLM | Vercel AI SDK: Ollama via OpenAI-compatible provider (dev), Bedrock (prod) | OpenAI GPT-4o |
| Recording | Audio only | 1080p video |
| Abuse control | One global daily call-minute budget | Polar free-tier limits |
| Dev tunnel | None needed (LiveKit runs beside the app) | ngrok |

## 3. Environments

| Concern | Dev (laptop) | Prod (AWS, sub-project 4) |
|---|---|---|
| Postgres | Docker | RDS |
| S3 + SQS | **moto** server in Docker (one container, both APIs) | S3 + SQS (with DLQ) |
| LiveKit server, Egress, Redis | Docker | EC2 (Egress may move to ECS) |
| Next.js app | `next dev`, native | ECS (or App Runner) |
| Summarizer worker | `tsx watch`, native | ECS task |
| Agent worker | `uv run … dev`, native | ECS task |
| LLM | Homelab Ollama `qwen3.5:4b` over Tailscale | Bedrock |
| STT / TTS | **mlx-audio** server, native (Metal), OpenAI-compatible `/v1/audio/*` | Amazon Transcribe / Polly |

Docker runs infrastructure only. App processes run natively, so no container needs Tailscale DNS or GPU access. `make dev` starts the native processes; `docker compose up -d` starts infrastructure. Tailscale must be running on the laptop for the homelab LLM.

## 4. Architecture

```
                         ┌──────────────── Next.js app (TS) ────────────────┐
 Browser ──HTTPS──────▶  │ pages · tRPC · Better Auth · /api/webhooks/livekit│──▶ Postgres (Drizzle)
    │                    │ LiveKit API: create room, token, agent dispatch    │──▶ S3 (presigned URLs)
    │                    │ LLM adapter (Ask AI)                               │──▶ LLM
    │                    └──────────────────────▲─────────────────────────────┘
    │ WebRTC                                    │ webhooks (participant_joined, room_finished, egress_ended)
    ▼                                           │
 LiveKit server ──────────────────────────────────┘
    │ dispatch job                │ room composite (audio only)
    ▼                             ▼
 Agent worker (Python)         Egress ──▶ S3 recordings/{meetingId}.mp4
  STT ─▶ LLM ─▶ TTS
  on end: transcripts/{meetingId}.jsonl ──▶ S3, { meetingId, transcriptKey } ──▶ SQS
                                   │
                                   ▼
                     Summarizer worker (TS) ──▶ LLM, Postgres
```

### 4.1 Boundaries

- **Only TypeScript processes touch Postgres.** The schema has one owner (Drizzle). The Python agent talks only to LiveKit, S3, SQS and model endpoints; it receives everything it needs in LiveKit dispatch metadata.
- **Agent contract:** metadata in (`{ meetingId, agentName, instructions, maxDurationSec }`); JSONL transcript plus one SQS message out.
- **LLM adapters on both sides.** TS: AI SDK with `@ai-sdk/openai-compatible` or `@ai-sdk/amazon-bedrock`, selected by `LLM_PROVIDER`. Python: LiveKit OpenAI plugin with `base_url`, or the LiveKit AWS plugin, selected by `STT_PROVIDER` / `LLM_PROVIDER` / `TTS_PROVIDER`. No assumption that Bedrock speaks the OpenAI API.
- **Second language is limited to the agent.** Reason: LiveKit's AWS plugin (Transcribe, Polly, Bedrock) and the most mature Agents SDK are Python.

### 4.2 Repository layout

```
/                          Next.js app (pnpm package)
  src/app/                 routes (thin: prefetch + boundaries)
  src/modules/<feature>/   server/procedures.ts, schemas.ts, types.ts, params.ts, hooks/, ui/
  src/trpc/                init, client, server, query-client, routers/
  src/db/                  schema.ts, index.ts
  src/lib/                 auth, auth-client, env, avatar, utils
  src/worker/              summarizer entry point (sub-project 3)
  drizzle/                 generated SQL migrations
  agent/                   Python agent (uv project, sub-project 2)
  docker-compose.yml
  Makefile
  ref/                     reference app (gitignored)
```

## 5. Call flow and status machine (sub-project 2)

Statuses: `upcoming → active → processing → completed | failed`. `cancelled` from `ref/` is dropped (nothing ever set it).

### 5.1 Join

1. `/call/[meetingId]` lobby: mic/camera preview, **Join**.
2. tRPC `meetings.join({ id })`:
   - Ownership check; status must be `upcoming` or `active`, otherwise `BAD_REQUEST`.
   - Budget: `remaining = DAILY_BUDGET_MIN − minutesUsedToday`. "Today" is the UTC day; an active call counts as `now − startedAt`. `remaining ≤ 0` → `PRECONDITION_FAILED` ("Demo at capacity, try tomorrow").
   - Create the LiveKit room named `meetingId` (idempotent) with agent dispatch (metadata above, `maxDurationSec = remaining × 60`) and audio-only room-composite Egress to `recordings/{meetingId}.mp4`.
   - Return `{ token, url }`: token scoped to that room, identity = user id, TTL 1 hour.
3. Browser connects with the LiveKit React components.

### 5.2 Webhooks — `/api/webhooks/livekit`

Signature verified with `WebhookReceiver` (API key/secret); invalid → 401; unknown events → 200 and ignored. Every update is conditional on the expected current status, so duplicates and reordering are no-ops.

| Event | Update |
|---|---|
| `participant_joined`, human participant (kind STANDARD; the agent and the Egress recorder also join and are ignored) | `upcoming → active`, `startedAt = now()` |
| `room_finished` | `active → processing`, `endedAt = now()` |
| `egress_ended` | `recordingKey = recordings/{meetingId}.mp4` |

### 5.3 Agent lifecycle

- Greets, then runs the STT → LLM → TTS loop with the meeting agent's instructions.
- Ends the call (deletes the room) when the human leaves (one human per call) or when `maxDurationSec` elapses, after a spoken goodbye.
- On shutdown: uploads the transcript (3 attempts), then sends the SQS message.
- Provider error mid-turn: apologises and continues. Fatal error: ends the call.

### 5.4 Failure handling

- **Stuck in `processing`:** when `getOne`/`getMany` reads a meeting that has been `processing` for more than 15 minutes, it marks it `failed` (lazy timeout; no scheduler).
- **Budget overshoot:** concurrent calls each receive the full remaining budget. Worst case is `concurrent calls × remaining`. Accepted for a demo.

## 6. Post-call pipeline (sub-project 3)

### 6.1 Transcript

The agent records each final user utterance and each agent reply as a JSONL line:

```json
{ "speaker": "user", "text": "…", "startMs": 1200, "endMs": 4100 }
```

Times are relative to call start. File: `transcripts/{meetingId}.jsonl`.

### 6.2 Summarizer worker (`src/worker`)

- SQS long poll; visibility timeout 3 minutes; redrive to DLQ after 3 receives.
1. Load the meeting; if status is not `active`, `processing` or `failed`, delete the message and stop. (`active` is accepted because the transcript can arrive before LiveKit's `room_finished` webhook; completion then also sets `endedAt` if missing.)
2. Fetch the JSONL from S3; parse with `split("\n") → JSON.parse`.
3. Summarise. If the transcript fits `LLM_MAX_INPUT_TOKENS`, one pass. Otherwise map (chunk on utterance boundaries → timestamped notes) then reduce (merge into `### Overview` + `### Notes` markdown, the format from `ref/`).
4. One transaction: `transcript` (JSONB), `summary`, `status = completed`. Delete the message.
- Errors leave the message for SQS redelivery. Accepting `failed` in step 1 lets a late success recover a meeting the lazy timeout already failed.

### 6.3 Recording

Egress writes AAC audio in MP4. The DB stores the key, never a URL. tRPC `meetings.getRecordingUrl` returns a presigned GET valid for 15 minutes.

### 6.4 Ask AI

- Route handler `POST /api/meetings/[id]/chat`: AI SDK `streamText`; client `useChat`.
- Owner only, `completed` meetings only; session checked in the handler.
- Prompt: the system prompt from `ref/` (summary + agent instructions) plus the last 10 `meeting_messages`. The user message is saved before the LLM call; the assistant message in `onFinish`.

## 7. Data model

Postgres 17, Drizzle, versioned migrations (`drizzle-kit generate` + `migrate`; no `push`).

| Table | Columns | Sub-project |
|---|---|---|
| `user`, `session`, `account`, `verification` | Generated by the Better Auth CLI | 1 |
| `agents` | `id uuid` PK default `gen_random_uuid()`, `user_id` FK→user cascade, `name`, `instructions`, `created_at`, `updated_at` | 1 |
| `meetings` | `id uuid` PK, `user_id` FK→user cascade, `agent_id` FK→agents cascade, `name`, `status` enum, `started_at`, `ended_at`, `transcript jsonb`, `summary`, `recording_key`, `created_at`, `updated_at` | 1 (columns used from 2/3) |
| `meeting_messages` | `id uuid` PK, `meeting_id` FK→meetings cascade, `role` enum (`user`, `assistant`), `content`, `created_at` | 3 |

- `meeting_status` enum: `upcoming`, `active`, `processing`, `completed`, `failed`.
- `updated_at` maintained with Drizzle `$onUpdate`.
- Indexes: `agents(user_id, created_at desc)`, `meetings(user_id, created_at desc)`, `meetings(agent_id)`, `meetings(status, started_at)`, `meeting_messages(meeting_id, created_at)`.
- `duration` is computed in SQL: `EXTRACT(EPOCH FROM (ended_at - started_at))`.

## 8. Configuration

`src/env.ts` validates all variables with zod at startup; the agent validates its own at startup. A missing or malformed variable fails the process at boot.

| Variable | Used by | Sub-project |
|---|---|---|
| `DATABASE_URL` | web, worker | 1 |
| `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL` | web | 1 |
| `GITHUB_CLIENT_ID/SECRET`, `GOOGLE_CLIENT_ID/SECRET` | web (optional; providers hidden when unset) | 1 |
| `NEXT_PUBLIC_APP_URL` | web | 1 |
| `LIVEKIT_URL`, `NEXT_PUBLIC_LIVEKIT_URL`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET` | web, agent | 2 |
| `DAILY_BUDGET_MIN` | web | 2 |
| `STT_PROVIDER`, `STT_BASE_URL`, `STT_MODEL`, `TTS_PROVIDER`, `TTS_BASE_URL`, `TTS_MODEL`, `TTS_VOICE` | agent | 2 |
| `AGENT_PROVIDER_TIMEOUT_SEC` (default 30; cold local models exceed LiveKit's 10 s default) | agent | 2 |
| `LLM_API_KEY`, `LLM_REASONING_EFFORT` (`none` turns off qwen3.5 thinking) | web, worker, agent | 2–3 |
| `LLM_PROVIDER`, `LLM_BASE_URL`, `LLM_MODEL` | web, worker, agent | 2 |
| `LLM_MAX_INPUT_TOKENS` | worker | 3 |
| `AWS_REGION`, `AWS_ENDPOINT_URL` (dev only), `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY` (dev only; IAM roles in prod) | web, worker, agent | 2–3 |
| `S3_BUCKET`, `SQS_QUEUE_URL` | web, worker, agent | 2–3 |

S3/SQS clients receive the endpoint explicitly from `AWS_ENDPOINT_URL` with path-style addressing when it is set.

`DAILY_BUDGET_MIN`: **30 in prod**, **1000 in dev** (local models cost nothing). Estimate ≈ $0.035 per call-minute (Transcribe ≈ $0.024, plus Polly and Bedrock) → ≈ $32/month worst case. Re-verified against current AWS pricing in sub-project 4.

## 9. Error handling

- tRPC: `UNAUTHORIZED` (no session), `NOT_FOUND` (missing or not owned), `BAD_REQUEST` (invalid state), `PRECONDITION_FAILED` (budget).
- UI: per-page Suspense + ErrorBoundary (pattern from `ref/`), toasts on mutation errors, a `failed` meeting state ("Summary couldn't be generated").
- Webhook, worker and agent rules: §5.2, §5.4, §6.2, §5.3.

## 10. Testing

- **Unit — Vitest:** budget calculation, transcript chunker, JSONL parsing, status-guard conditions, env validation, duration formatting.
- **Integration — Vitest** against Docker Postgres (separate test database) and moto: tRPC procedures through `createCaller` with a fake session (ownership filters, search, pagination, budget refusal); the webhook route with signed payloads; the worker end to end with a fake LLM adapter.
- **Agent — pytest:** transcript collector, metadata parsing, max-duration timer, provider factory.
- **E2E — Playwright:** sign-up, sign-in, sign-out, agents and meetings CRUD.
- **Calls:** a written manual smoke-test checklist (real microphone and WebRTC are not automated).
- Development follows TDD.

## 11. Sub-projects

| # | Sub-project | Contents | Depends on |
|---|---|---|---|
| 1 | **Core app** | §12 | — |
| 2 | **Call stack** | LiveKit + Egress + Redis in compose, `meetings.join`, call UI, Python agent, mlx-audio, webhooks, budget | 1 |
| 3 | **Post-call pipeline** | moto S3/SQS, transcript upload, summarizer worker, transcript/summary/recording tabs, Ask AI | 2 |
| 4 | **AWS migration** | RDS, SQS, S3, LiveKit on EC2, ECS services, Bedrock/Transcribe/Polly, infrastructure as code, pricing re-check | 1–3 |

### Verify first in sub-project 2/3 (throwaway spikes)

1. mlx-audio server: start command, port, and whether `/v1/audio/transcriptions` and `/v1/audio/speech` work with LiveKit's OpenAI STT/TTS plugins.
2. Room creation with agent dispatch and auto-egress in one `CreateRoom` call. Fallback: create room, then `AgentDispatchClient.createDispatch` and `startRoomCompositeEgress` explicitly.
3. Egress upload to moto's S3 endpoint (path style).
4. LiveKit container reaching `host.docker.internal:3000` for webhooks.
5. LiveKit Agents session events for building the transcript (event names, timestamps).

**Results (2026-10-03):**

- (2) ✅ One `createRoom` with `agents` + `egress` dispatches the agent and starts recording; calling it again returns the same room without a second dispatch.
- (3) ✅ Audio-only room-composite Egress uploaded a 240 KB MP4 to moto; the presigned GET serves it. Requires LiveKit's `node_ip` to be the Mac's LAN address so the Egress container can reach the media port.
- (4) ✅ Signed webhooks reach `host.docker.internal:3000`; a real browser call moved a meeting `upcoming → active → processing` and set `recordingKey`.
- (5) ✅ livekit-agents 1.8.4: `AgentServer` + `@server.rtc_session(agent_name=…, on_session_end=…)`; `conversation_item_added` with `metrics.started_speaking_at/stopped_speaking_at`; turn detection must be set to `"vad"` explicitly or the defaults call LiveKit Cloud; `on_session_end` has a 300 s budget for the S3/SQS hand-off.
- Post-call pipeline ✅ live: S3 → SQS → worker → `qwen3.5:4b` → Postgres in 18 s.

## 12. Sub-project 1 — Core app (detailed)

### 12.1 Scope

In: scaffold, auth, database, tRPC, agents and meetings CRUD, dashboard shell, meeting detail page with status views, shared UI components, tests.

Out: anything under §5–§6 (LiveKit, call page, agent, worker, S3/SQS, transcript, recording, Ask AI, budget). The meeting detail page renders the `upcoming` state's "Start meeting" button disabled with a "Calls arrive in the next release" tooltip.

### 12.2 Stack

- Latest stable Next.js (App Router) and React from `create-next-app@latest`, TypeScript strict, Tailwind v4, shadcn/ui. Exact versions are pinned in the implementation plan after checking current releases; where the current Next major differs from `ref/` (15.3), the plan follows current conventions (for example the middleware file name).
- pnpm.
- tRPC v11 + TanStack Query v5, **superjson** transformer (dates arrive as `Date`, not strings).
- Drizzle ORM with `node-postgres`; zod; react-hook-form; nuqs; Better Auth.
- Postgres 17 in `docker-compose.yml` (the only service in sub-project 1).

Not installed (see `STUDY.md` §10–11): nanoid, react-icons, date-fns, humanize-duration, jsonl-parse-stringify, dotenv, and the shadcn components nothing imports (chart, carousel, calendar, input-otp, resizable).

### 12.3 Auth

- Better Auth: email/password plus GitHub and Google. Social buttons render only when their env vars are set.
- Drizzle adapter; tables generated by the Better Auth CLI into `src/db/schema.ts`.
- Route handler `/api/auth/[...all]`.
- **Optimistic redirect** in `src/proxy.ts` (Next 16's middleware): no session cookie on a protected route → `/sign-in`. The reverse (signed-in user on `/sign-in` → `/meetings`) is done by the auth layout after a real session check, so a stale cookie can't cause a redirect loop.
- **Authoritative check** in `createTRPCContext`: it loads the session once per request and returns `{ session }`. `protectedProcedure` throws `UNAUTHORIZED` when it is null. Pages no longer call `getSession` individually.
- Sign-out from the user menu; no billing items.

### 12.4 tRPC routers

**`agents`**

| Procedure | Input | Behaviour |
|---|---|---|
| `getMany` | `{ page, pageSize (1–100), search? }` | Owner's agents, `ilike` on name, ordered `created_at desc, id desc`, with `meetingCount`; returns `{ items, total, totalPages }` |
| `getOne` | `{ id }` | Owner's agent with `meetingCount`; `NOT_FOUND` otherwise |
| `create` | `{ name, instructions }` | Inserts for the session user |
| `update` | `{ id, name, instructions }` | Owner-scoped; `NOT_FOUND` if no row |
| `remove` | `{ id }` | Owner-scoped; cascades to meetings |

**`meetings`**

| Procedure | Input | Behaviour |
|---|---|---|
| `getMany` | `{ page, pageSize, search?, status?, agentId? }` | Owner's meetings joined with agent, plus `duration`; total query without the join |
| `getOne` | `{ id }` | Owner's meeting with agent and `duration` |
| `create` | `{ name, agentId }` | Verifies the agent belongs to the user; inserts with status `upcoming` |
| `update` | `{ id, name, agentId }` | Owner-scoped; agent ownership verified |
| `remove` | `{ id }` | Owner-scoped |

Insert/update zod schemas live in each module's `schemas.ts` and are shared by the form (`zodResolver`) and the procedure (`.input`). Output types come from `inferRouterOutputs`.

### 12.5 Pages

| Route | Content |
|---|---|
| `/sign-in`, `/sign-up` | Auth views (email/password form, social buttons) |
| `/` | Redirect to `/meetings` |
| `/agents` | List: search, pagination (URL state via nuqs), "New agent" dialog |
| `/agents/[agentId]` | Detail: avatar, instructions, meeting count; edit dialog; delete with confirm |
| `/meetings` | List: search, status filter, agent filter, pagination, "New meeting" dialog |
| `/meetings/[meetingId]` | Header (edit, delete) and one state view per status: `upcoming`, `active`, `processing`, `completed` (placeholder tabs until sub-project 3), `failed` |

Every data page uses the pattern from `STUDY.md` §5: server `prefetchQuery` (not awaited) → `HydrationBoundary` → `Suspense` → `ErrorBoundary` → client view with `useSuspenseQuery`. Filter parsers are defined once in `params.ts` and reused by the client hook so server and client query keys match.

### 12.6 Shared UI

`DataTable`, `DataPagination`, `EmptyState`, `ErrorState`, `LoadingState`, `ResponsiveDialog` (dialog on desktop, drawer on mobile), `CommandSelect`, `GeneratedAvatar` (DiceBear: `botttsNeutral` for agents, `initials` for users), `useConfirm`, dashboard sidebar, navbar, command palette, user button. Small in-house helpers replace dropped packages: `formatDuration`, date formatting with `Intl.DateTimeFormat`, inline GitHub/Google SVG icons.

### 12.7 Fixes carried from `STUDY.md` §8

- Session in tRPC context; no dead `user_123`.
- Every dashboard route protected (middleware + tRPC), including agent detail.
- Providers inside `<body>`; real metadata (title, description).
- No unused dependencies or shadcn components.
- Meetings total query without the agent join.
- Versioned migrations instead of `push`.

### 12.8 Tests for sub-project 1

- Unit: zod schemas, `formatDuration`, date formatting, env validation.
- Integration (Docker Postgres test database, `createCaller` with fake sessions): each procedure's happy path; another user's rows invisible and unmodifiable (`NOT_FOUND`); search, filters and pagination totals; `meetings.create` refusing an agent owned by someone else; cascade delete of an agent's meetings.
- E2E (Playwright): sign up → create agent → create meeting → edit → delete → sign out; unauthenticated access to `/meetings` redirects to `/sign-in`.

### 12.9 Done when

- `docker compose up -d && pnpm dev` gives a working app on `http://localhost:3000`.
- All unit, integration and E2E tests pass.
- `pnpm build` and `pnpm lint` succeed.
- The repo contains no secrets; `.env.example` lists every sub-project 1 variable.
