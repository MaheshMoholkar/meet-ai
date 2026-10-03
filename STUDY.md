# Meet AI — Reference Study

Study notes on `ref/` — CodeWithAntonio's "Meet AI" (Next 15). Video calls with a custom-instructed AI agent, followed by an auto-generated summary, transcript, recording, and post-call "Ask AI" chat.

## Stack

Next 15.3 App Router · React 19 · tRPC v11 + TanStack Query · Drizzle on Neon (HTTP driver) · Better Auth + Polar plugin · Stream Video + Stream Chat · OpenAI Realtime (via Stream) + GPT-4o · Inngest + agent-kit · nuqs · shadcn/ui + Tailwind v4.

## Layout

```
src/
  app/                    routes only — thin: auth check + prefetch + boundaries
  modules/<feature>/      agents | meetings | call | premium | dashboard | auth | home
    server/procedures.ts  tRPC router
    schemas.ts            zod insert/update schemas (shared by form + procedure)
    types.ts              inferRouterOutputs-derived types
    params.ts             nuqs server loader
    hooks/                nuqs client filters
    ui/views/*            page-level client components
    ui/components/*
  trpc/                   init (procedures), client, server, query-client, routers/_app
  lib/                    auth, auth-client, polar, stream-video, stream-chat, avatar, utils
  inngest/                client + functions
  db/schema.ts            better-auth tables + agents + meetings
```

## 1. Meeting status machine

Key insight: **the client never changes status.** Stream server events drive the lifecycle; the `/call` page only joins/leaves, and the DB follows Stream's webhooks.

| Transition | Writer | Location |
|---|---|---|
| → `upcoming` | tRPC `meetings.create` — also creates the Stream call with transcription + recording `auto-on`, and upserts the agent as a Stream user | `modules/meetings/server/procedures.ts` |
| `upcoming` → `active` | webhook `call.session_started` + `connectOpenAi` (agent joins the call) | `app/api/webhook/route.ts:54` |
| (participant left) | webhook → `call.end()` | `route.ts:106` |
| `active` → `processing` | webhook `call.session_ended` | `route.ts:116` |
| (set `transcriptUrl`) | webhook `call.transcription_ready` → `inngest.send("meetings/processing")` | `route.ts:131` |
| `processing` → `completed` | Inngest `meetings/processing` saves the summary | `inngest/functions.ts` |
| (set `recordingUrl`) | webhook `call.recording_ready` | `route.ts:154` |
| `cancelled` | **nothing writes it** — enum + UI only | — |

Notes:
- The AI agent is a server-side participant. `streamVideo.video.connectOpenAi({ call, agentUserId })` makes Stream bridge OpenAI Realtime into the call; `realtimeClient.updateSession({ instructions })` applies the agent's instructions. No AI code runs in the browser.
- Inngest pipeline: `fetch-transcript` → `parse-transcript` (JSONL) → `add-speakers` (resolve `speaker_id` against both `user` and `agents` tables) → `summarizer.run` (agent-kit, GPT-4o, fixed markdown structure: Overview + Notes with timestamped sections) → `save-summary`. Each `step.run` result is memoized across retries.

## 2. One webhook route, three integrations

`app/api/webhook/route.ts` handles everything inbound:

- **Stream Video events** — DB status updates + realtime agent join.
- **Stream Chat `message.new`** — powers the post-call "Ask AI" tab. Runs only if the meeting is `completed` and the sender isn't the agent. Pulls the last 5 channel messages, builds a system prompt from summary + agent instructions, calls GPT-4o, posts the reply as the agent user. The chat channel id equals the meeting id.
- **Inngest fan-out** — `inngest.send("meetings/processing")`.

Signature check: `streamVideo.verifyWebhook(body, x-signature)` on the raw text body before JSON parsing.

## 3. Auth layering

1. **Page level** — server components call `auth.api.getSession({ headers: await headers() })` and `redirect("/sign-in")`.
2. **tRPC level** — `protectedProcedure` re-checks the session and puts it in `ctx.auth`.
3. **Context** — `createTRPCContext` returns a hardcoded `{ userId: 'user_123' }`, unused.

No `middleware.ts`. The real ownership guard is every query filtering on `eq(x.userId, ctx.auth.user.id)` (update/remove use `.returning()` and throw `NOT_FOUND` on empty).

Better Auth: email/password + GitHub + Google; Drizzle adapter with the schema spread in; `/api/auth/[...all]` via `toNextJsHandler`.

## 4. Premium gating

```
premiumProcedure("agents" | "meetings")
  → polarClient.customers.getStateExternal({ externalId: userId })
  → count meetings + count agents
  → over free limit (1 agent / 3 meetings) && no active subscription → TRPCError FORBIDDEN
client form onError:
  → toast + if error.data.code === "FORBIDDEN" → router.push("/upgrade")
```

- `createCustomerOnSignUp: true` links each user to a Polar customer by `externalId`.
- Checkout: `authClient.checkout({ products: [id] })`. Manage: `authClient.customer.portal()`.
- `premium.getFreeUsage` returns `null` for subscribers → sidebar trial widget hides itself.
- Mutations that change counts invalidate `premium.getFreeUsage` so the trial widget updates.

## 5. Page pattern (used 5×)

```
page.tsx (server)
  loadSearchParams (nuqs/server)
  getSession → redirect
  void queryClient.prefetchQuery(trpc.x.queryOptions(filters))   // no await
  <HydrationBoundary state={dehydrate(queryClient)}>
    <Suspense fallback={<XViewLoading/>}>
      <ErrorBoundary fallback={<XViewError/>}>
        <XView/>   // "use client", useSuspenseQuery(same queryOptions)
```

Why it works:
- `void prefetchQuery` + `shouldDehydrateQuery` including `query.state.status === 'pending'` (`trpc/query-client.ts`) streams the in-flight promise to the client. Shell renders immediately; data streams in via Suspense; no waterfall, no double fetch.
- Filters live in the URL, defined twice — `params.ts` (`nuqs/server` loader) and `hooks/use-*-filters.ts` (`nuqs` client). Parsers must be identical or the server prefetch key won't match the client query key → refetch.
- `getQueryClient = cache(makeQueryClient)` on the server gives one client per request; the browser keeps a singleton.
- Types are inferred, never hand-written: `inferRouterOutputs<AppRouter>["meetings"]["getOne"]` tracks the Drizzle select shape.
- `views/*.tsx` export `XView`, `XViewLoading`, `XViewError` together.

## 6. Call client lifecycle

```
CallView        useSuspenseQuery(getOne); "ended" screen if completed
 └ CallProvider   waits for authClient.useSession()
    └ CallConnect   new StreamVideoClient({ tokenProvider: generateToken mutation })
                    client.call("default", meetingId); camera + mic disabled
                    cleanup: disconnectUser(); call.leave() + call.endCall()
       └ CallUI       local state "lobby" | "call" | "ended"
          ├ CallLobby   VideoPreview, permission check, toggle buttons
          ├ CallActive  SpeakerLayout + CallControls
          └ CallEnded   "Summary will appear in a few minutes"
```

Chat tab mirrors it: `ChatProvider` (session) → `ChatUI` with `useCreateChatClient({ tokenOrProvider: generateChatToken })`, channel `messaging:<meetingId>`.

## 7. Reusable patterns

- **`useConfirm(title, desc)`** → `[ConfirmationDialog, confirm]`; `confirm()` returns a Promise resolved by the button click. Lets handlers do `if (!(await confirm())) return;`.
- **`ResponsiveDialog`** — Dialog on desktop, vaul Drawer on mobile via `useIsMobile`. Same for the user button and command palette.
- **`CommandSelect`** — searchable select built on cmdk; `onSearch` feeds a server-side `search` param.
- **DiceBear avatars** — `botttsNeutral` for agents, `initials` for users without an image. Generated as data URIs; nothing stored.
- **SQL-computed duration** — `sql<number>\`EXTRACT(EPOCH FROM (ended_at - started_at))\``; formatted with `humanize-duration`.
- **Subquery counts** — `db.$count(meetings, eq(agents.id, meetings.agentId))` inside a select for `meetingCount`.
- **Shared zod schemas** — `agentsInsertSchema` used by both `zodResolver` in the form and `.input()` in the procedure; update schema = `.extend({ id })`.
- **Form pattern** — one form component for create + edit, switched on `!!initialValues?.id`; `onSuccess`/`onCancel` callbacks so it works inside any dialog.
- **Transcript search** — client-side filter + `react-highlight-words`.
- **Summary rendering** — `react-markdown` with a Tailwind-styled `components` map.

## 8. Don't copy — quirks and suspects

1. `createTRPCContext` returns dead `user_123`. Move the session lookup into context.
2. `generateToken` passes `validity_in_seconds: issuedAt` — a unix timestamp where a duration belongs. Likely meant `iat`. Suspect, not confirmed broken.
3. `agents/[agentId]/page.tsx` has no `getSession` check, unlike the other pages; relies on tRPC `UNAUTHORIZED` → ErrorBoundary.
4. Webhook verifies all events (including Chat) with `streamVideo.verifyWebhook`, but env has separate video/chat secrets — only works if both point to the same Stream app. `x-api-key` is checked for presence, never compared.
5. `call.session_participant_left` ends the call for everyone — single-human-per-call assumption.
6. `summarizer.run()` is outside `step.run` — not memoized; an Inngest retry re-calls GPT-4o.
7. `message.new` branch: `streamChat.upsertUser` and `channel.sendMessage` are not awaited — on serverless the route can return before the send completes.
8. `premiumProcedure` hits Polar on every create and runs both count queries regardless of entity.
9. `cancelled` status is never set — that UI state is unreachable.
10. Meetings `getMany` total-count query has an unnecessary `innerJoin(agents)`; agent pickers hardcode `pageSize: 100`.
11. Root layout wraps providers outside `<html>`; metadata still "Create Next App".
12. No tests. No migrations folder in use (`drizzle-kit push` only).

## 9. Env & local dev

```
DATABASE_URL
BETTER_AUTH_SECRET, BETTER_AUTH_URL
GITHUB_CLIENT_ID/SECRET, GOOGLE_CLIENT_ID/SECRET
NEXT_PUBLIC_APP_URL
NEXT_PUBLIC_STREAM_VIDEO_API_KEY, STREAM_VIDEO_SECRET_KEY
NEXT_PUBLIC_STREAM_CHAT_API_KEY, STREAM_CHAT_SECRET_KEY
OPENAI_API_KEY
POLAR_ACCESS_TOKEN   (Polar server: "sandbox")
```

Three processes for local dev: `next dev`, `ngrok http --url=<static> 3000` (Stream webhooks need a public URL), `npx inngest-cli@latest dev`. `npm install --legacy-peer-deps` for React 19 peer conflicts. `/` redirects to `/meetings` via `next.config.ts`.

## 10. Third-party dependencies

### External services (account + keys required)

| Service | Role | Env | Cost |
|---|---|---|---|
| **Neon** | Serverless Postgres (HTTP driver via `drizzle-orm/neon-http`) | `DATABASE_URL` | free tier |
| **Stream Video** | Calls, recording, transcription, webhooks, OpenAI Realtime bridge | `NEXT_PUBLIC_STREAM_VIDEO_API_KEY`, `STREAM_VIDEO_SECRET_KEY` | free dev quota |
| **Stream Chat** | Post-call "Ask AI" chat | `NEXT_PUBLIC_STREAM_CHAT_API_KEY`, `STREAM_CHAT_SECRET_KEY` | free tier |
| **OpenAI** | Realtime voice agent (via Stream) + GPT-4o summary/chat | `OPENAI_API_KEY` | **paid** — Realtime is per audio-minute, the main cost |
| **Polar** | Subscriptions, checkout, customer portal (`server: "sandbox"`) | `POLAR_ACCESS_TOKEN` | sandbox free |
| **Inngest** | Background summarization job | none locally (dev server); signing/event keys in prod | free tier |
| **GitHub OAuth** | Social login | `GITHUB_CLIENT_ID/SECRET` | free |
| **Google OAuth** | Social login | `GOOGLE_CLIENT_ID/SECRET` | free |
| **ngrok** | Public URL for Stream webhooks → localhost (static domain) | in `dev:webhook` script | static domain free |

Better Auth is a library, not a hosted service — only `BETTER_AUTH_SECRET` + `BETTER_AUTH_URL`.

Stream carries the most weight: call, recording, transcription, agent bridge, and chat. Swapping it (e.g. LiveKit) means rewriting the webhook route, the token procedures, and the whole `call` module.

### npm packages by role

| Role | Packages |
|---|---|
| Framework | `next` 15.3.2, `react` / `react-dom` 19 |
| API layer | `@trpc/server`, `@trpc/client`, `@trpc/tanstack-react-query`, `@tanstack/react-query` |
| Database | `drizzle-orm`, `drizzle-kit` (dev), `@neondatabase/serverless`, `dotenv` |
| Auth + billing | `better-auth`, `@polar-sh/better-auth`, `@polar-sh/sdk` |
| Video | `@stream-io/video-react-sdk` (client), `@stream-io/node-sdk` (server), `@stream-io/openai-realtime-api` |
| Chat | `stream-chat` (server), `stream-chat-react` (client) |
| AI + jobs | `openai`, `inngest`, `@inngest/agent-kit`, `jsonl-parse-stringify` |
| Forms + validation | `react-hook-form`, `@hookform/resolvers`, `zod` |
| URL state | `nuqs` |
| UI | shadcn (~25 `@radix-ui/*`), `cmdk`, `vaul`, `sonner`, `next-themes` (used by shadcn `sonner.tsx`), `lucide-react`, `react-icons` (social login icons), `tailwind-merge`, `clsx`, `class-variance-authority`, `tw-animate-css` |
| Tables | `@tanstack/react-table` |
| Content | `react-markdown`, `react-highlight-words`, `@dicebear/core` + `@dicebear/collection` |
| Utilities | `date-fns`, `humanize-duration`, `nanoid`, `react-error-boundary`, `server-only`, `client-only` |

Never imported directly, but required:
- `@neondatabase/serverless` — peer of `drizzle-orm/neon-http`.
- `@stream-io/openai-realtime-api` — peer used by `@stream-io/node-sdk`'s `connectOpenAi()`.

Installed but unused (only their shadcn wrapper exists, and nothing imports the wrapper — skip in a rebuild):
`recharts` (`ui/chart`), `embla-carousel-react` (`ui/carousel`), `react-day-picker` (`ui/calendar`), `input-otp` (`ui/input-otp`), `react-resizable-panels` (`ui/resizable`).

## 11. Rebuild decisions (2026-10-02)

> **Superseded** by [`docs/superpowers/specs/2026-10-03-meet-ai-rebuild-design.md`](docs/superpowers/specs/2026-10-03-meet-ai-rebuild-design.md). Kept as a record; where they differ (homelab infra, RabbitMQ, deferred items), the spec wins.

Sections 1–10 describe `ref/` as-is. This section is the plan for our own version.

### Removed: Polar

Gone entirely, along with everything that exists only to serve it:

- `@polar-sh/sdk`, `@polar-sh/better-auth`, `lib/polar.ts`, the `polar()` plugin in `lib/auth.ts`, `polarClient()` in `lib/auth-client.ts`
- `premiumProcedure` → `agents.create` / `meetings.create` become plain `protectedProcedure`
- `modules/premium/*`, the `/upgrade` page, the sidebar trial widget (`dashboard-trial.tsx`)
- `FORBIDDEN → router.push("/upgrade")` in agent/meeting forms; `getFreeUsage` invalidations after mutations
- "Billing" / portal buttons in the user menu
- `POLAR_ACCESS_TOKEN`

Free-tier limits go with it — nothing to upgrade to. (Default; revisit if usage caps are wanted without payments.)

### Swapped to in-house / homelab

| Was | Becomes | Notes |
|---|---|---|
| Stream Chat | `meeting_messages` table + tRPC `meetings.ask` mutation (LLM call; SSE streaming optional) | Deletes `stream-chat`, `stream-chat-react`, `generateChatToken`, the `message.new` webhook branch, `*_STREAM_CHAT_*` env vars |
| Neon | Lab Postgres 17 via `lab.yml` | `drizzle-orm/node-postgres` + `pg`; drop `@neondatabase/serverless`. Prod: any Postgres via `DATABASE_URL` |
| OpenAI (summary + chat) | Ollama `qwen3.5:4b` in dev, OpenAI in prod | OpenAI SDK with `baseURL` from env; `reasoning_effort: "none"` for qwen. 8k context → chunked (map-reduce) summarization |
| Inngest | Lab RabbitMQ queue + standalone worker process | Webhook publishes instead of `inngest.send`. No step memoization → steps must be idempotent (guard on meeting status). 3 retries then `<queue>.dlq`. Worker runs outside Next |

### npm packages dropped

| Package | Replacement |
|---|---|
| `@inngest/agent-kit`, `inngest` | plain `openai` client + RabbitMQ worker |
| `jsonl-parse-stringify` | `text.split("\n").filter(Boolean).map((l) => JSON.parse(l))` |
| `react-icons` | inline GitHub/Google SVGs |
| `humanize-duration` | own `formatDuration` (largest of h/m/s) |
| `nanoid` | `crypto.randomUUID()` |
| `date-fns` | `Intl.DateTimeFormat` + small `mm:ss` helper |
| `react-highlight-words` | own `<Highlight>` (escaped regex split → `<mark>`) |
| `dotenv` | `process.loadEnvFile()` |
| `recharts`, `embla-carousel-react`, `react-day-picker`, `input-otp`, `react-resizable-panels` | not installed (unused shadcn wrappers not added) |

### Unchanged

Better Auth (email/password + GitHub/Google), tRPC + TanStack Query, Drizzle, zod, react-hook-form, shadcn/Radix, nuqs, react-markdown, DiceBear, react-error-boundary.

### Deferred — discuss later

- **ngrok** — Tailscale Funnel is the candidate replacement.
- **OpenAI Realtime agent** — no local equivalent for speech-to-speech in a WebRTC call.
- **Stream Video** — calls, recording, transcription, webhooks.

Until decided, these stay as in `ref/`.

### Draft `lab.yml`

```yaml
project: meetai
services:
  postgres: {}
  rabbitmq: { queues: [summarize] }
```

Ollama needs no `lab.yml` entry (`https://ollama.lab.maheshmoholkar.in/v1`).

### Env after rebuild

```
DATABASE_URL                          # .env.lab (dev) / real Postgres (prod)
AMQP_URL                              # .env.lab (dev)
LLM_BASE_URL, LLM_API_KEY, LLM_MODEL  # Ollama (dev) / OpenAI (prod)
BETTER_AUTH_SECRET, BETTER_AUTH_URL
GITHUB_CLIENT_ID/SECRET, GOOGLE_CLIENT_ID/SECRET
NEXT_PUBLIC_APP_URL
NEXT_PUBLIC_STREAM_VIDEO_API_KEY, STREAM_VIDEO_SECRET_KEY   # deferred
OPENAI_API_KEY                        # Realtime agent only — deferred
```

### Also fix in the rebuild (from §8)

Session in `createTRPCContext` (drop per-page `getSession` duplication), `generateToken` `iat`, auth check on every dashboard page, compare webhook `x-api-key`, `await` all side effects in the webhook, `cancelled` status either wired up or removed, root layout providers inside `<body>`, real metadata.
