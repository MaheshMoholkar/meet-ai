# Building Meet AI: a beginner's tour of a real-time AI app

Meet AI lets you design an AI agent, call it from your browser, talk to it, and get a transcript, a recording and a summary afterwards. Under the hood it touches a surprising number of ideas: web frameworks, databases, real-time audio, speech recognition, language models, queues, containers and the cloud.

This guide explains each idea in a few sentences and then shows exactly where Meet AI uses it. You don't need to know any of it beforehand. Read it top to bottom, or jump to the concept you're curious about.

![Meet AI architecture](images/architecture.svg)

## Contents

- [The life of one call](#the-life-of-one-call)
- [Part 1 — The web app](#part-1--the-web-app)
- [Part 2 — Real-time audio](#part-2--real-time-audio)
- [Part 3 — The voice agent](#part-3--the-voice-agent)
- [Part 4 — After the call](#part-4--after-the-call)
- [Part 5 — Guardrails](#part-5--guardrails)
- [Part 6 — Shipping it](#part-6--shipping-it)
- [Glossary](#glossary)

---

## The life of one call

Follow the numbers in the diagram:

1. You **sign in** and create an agent ("You are a patient math tutor") and a meeting.
2. You press **Join**. The web app creates a **room** on the LiveKit server, asks LiveKit to send the voice agent into it, and starts a recording.
3. Your browser connects to the room and starts sending your **microphone audio** over WebRTC.
4. The **voice agent** joins the same room.
5. It **hears** you (speech-to-text) and later **speaks** its reply (text-to-speech)…
6. …after **thinking** with a language model.
7. Meanwhile LiveKit tells the web app what's happening through **webhooks**: someone joined → the meeting is *active*; the room closed → it's *processing*.
8. The recorder uploads the call's **audio file** to storage.
9. When the call ends, the agent uploads the **transcript**…
10. …and drops a **job** on a queue.
11. The **summarizer** picks up the job…
12. …asks the language model to **summarize** the transcript…
13. …and **saves** the transcript and summary. The meeting is *completed*.

Every concept below is one piece of this story.

---

## Part 1 — The web app

### Next.js and the App Router

**The idea.** [Next.js](https://nextjs.org) is a React framework. You write pages as React components, and Next decides what runs on the server and what runs in the browser. Folders under `app/` become URLs: `app/meetings/page.tsx` is `/meetings`.

**Server vs client components.** By default a component renders on the **server**: it can read the database or secrets, and only HTML reaches the browser. A file that starts with `"use client"` runs in the **browser** too, so it can use state, clicks and the microphone. A good page keeps the server part thin and hands interactive bits to client components.

**In Meet AI.** Every page in `apps/web/src/app/` is a small server component: it starts loading the data the page needs and renders a client "view" from `apps/web/src/modules/<feature>/ui/views/`. The route groups `(auth)` and `(dashboard)` share layouts — which check the session — without adding to the URL.

### Fetching data: prefetch on the server, hydrate in the browser

**The idea.** [TanStack Query](https://tanstack.com/query) caches API responses in the browser and refetches them when needed. If the server starts a request *while it renders the page* and passes the pending result along, the browser doesn't have to start from scratch. That hand-over is called **hydration**. React's `<Suspense>` shows a loading state until the data arrives, and an **error boundary** catches failures.

**In Meet AI.** Each page follows the same four steps — look at `apps/web/src/app/(dashboard)/meetings/page.tsx`:

```
prefetchQuery (server, not awaited) → HydrationBoundary → Suspense → ErrorBoundary → client view
```

The client view calls `useSuspenseQuery` with the same query, and the cache already has it. `apps/web/src/trpc/query-client.ts` is set up to pass even *unfinished* queries to the browser, so the page shell appears instantly.

### tRPC: calling the server like a function

**The idea.** Normally a frontend calls a REST API (`fetch("/api/meetings")`) and hopes the response has the shape it expects. [tRPC](https://trpc.io) lets the frontend call server functions directly, with TypeScript checking the inputs and outputs on both sides. Rename a field on the server and the frontend stops compiling.

**In Meet AI.** The routers live in `apps/web/src/modules/*/server/procedures.ts` (`agents.getMany`, `meetings.join`, …). `apps/web/src/trpc/init.ts` defines `protectedProcedure`: a procedure that refuses to run unless the request has a signed-in user.

### Postgres, Drizzle and migrations

**The idea.** [Postgres](https://www.postgresql.org) is a relational database: data lives in tables with typed columns, and you query it with SQL. An **ORM** like [Drizzle](https://orm.drizzle.team) lets you describe tables in TypeScript and write queries that look like code but compile to SQL. A **migration** is a versioned SQL file that changes the database's structure; running them in order brings any database — your laptop's or production's — to the same shape.

**In Meet AI.** The tables (`user`, `agents`, `meetings`, `meeting_messages`, …) are in `apps/web/src/db/schema.ts`. `make db-generate` writes a new migration into `apps/web/drizzle/`, and `make db-migrate` applies it. Every query includes the signed-in user's id (`eq(meetings.userId, …)`), so nobody can read or change someone else's meetings — the integration tests check exactly that.

### Authentication: sessions and cookies

**The idea.** When you sign in, the server creates a **session** (a row saying "this browser is Ada") and gives the browser a **cookie** with the session's id. The browser sends that cookie with every request, so the server knows who's asking. Passwords are stored *hashed*, never in plain text.

**In Meet AI.** [Better Auth](https://www.better-auth.com) handles sign-up, sign-in, sessions and optional GitHub/Google login (`apps/web/src/lib/auth.ts`). Two layers protect pages:
- `apps/web/src/proxy.ts` (Next's middleware) does a quick check: no session cookie → redirect to `/sign-in`.
- The real check happens on the server, once per request, in the tRPC context (`apps/web/src/trpc/init.ts`). The cookie could be stale or forged; the database lookup can't.

### Validation with zod

**The idea.** Data coming from outside your program — a form, an API request, an environment variable — can be anything. A schema library like [zod](https://zod.dev) describes what valid data looks like and rejects everything else with a clear message.

**In Meet AI.** The same schema validates a form in the browser and the matching API input on the server (`apps/web/src/modules/agents/schemas.ts`). And `apps/web/src/env.ts` validates **every environment variable at startup**: a missing key crashes the app immediately with a list of what's wrong, instead of failing mysteriously in the middle of a call.

### The URL as state

**The idea.** Search terms, filters and the current page can live in the URL (`/meetings?status=completed&page=2`). Then a refresh keeps them, the back button works, and you can share the link.

**In Meet AI.** [nuqs](https://nuqs.dev) reads and writes these query parameters with types. The same parsers are used on the server (to prefetch the right page) and in the browser — see `apps/web/src/modules/meetings/params.ts`.

---

## Part 2 — Real-time audio

### WebRTC

**The idea.** [WebRTC](https://webrtc.org) is the browser's built-in technology for live audio and video. It's built for *low latency* rather than perfect delivery: it usually travels over **UDP**, so a lost packet is skipped instead of waited for — a tiny glitch beats a half-second freeze in a conversation. Before media can flow, the two sides exchange connection details; this setup step is called **signaling**.

### SFU: a media server in the middle

**The idea.** With two people you could connect the browsers directly (peer-to-peer). With more participants, or with a server-side participant like an AI agent, everyone connects to a **Selective Forwarding Unit (SFU)** instead. Each participant sends its audio once; the SFU forwards it to whoever should hear it.

**In Meet AI.** [LiveKit](https://livekit.io) is an open-source SFU. It runs in Docker on your laptop (`infra/local/compose.yml`) and on an EC2 machine in AWS. Each meeting gets a **room** named after the meeting's id; the browser and the voice agent are **participants** in it, and their microphones are **tracks**.

### Access tokens

**The idea.** Anyone could try to join a room, so LiveKit only admits clients that present a **token**: a small signed document (a [JWT](https://jwt.io)) saying "this user may join this room until this time". Only the server knows the secret that signs it.

**In Meet AI.** `meetings.join` (in `apps/web/src/modules/meetings/server/procedures.ts`) checks that you own the meeting and that the daily budget has minutes left, creates the room with the agent and the recorder attached, and returns a one-hour token for that one room (`apps/web/src/lib/livekit.ts`).

### Webhooks

**The idea.** A **webhook** is the opposite of an API call: another service calls *your* URL when something happens. Because anyone on the internet could call that URL too, the sender **signs** each request, and you verify the signature before believing it.

**In Meet AI.** LiveKit calls `/api/webhooks/livekit` when a participant joins or a room finishes (`apps/web/src/app/api/webhooks/livekit/route.ts`). The handler verifies the signature, then moves the meeting forward.

### A tiny state machine

**The idea.** A meeting is always in one **state**: `upcoming → active → processing → completed` (or `failed`). Events can arrive twice or out of order, so each transition only applies *from the expected state*. Sending the same event twice then changes nothing — the operation is **idempotent**.

**In Meet AI.** `apps/web/src/modules/meetings/server/lifecycle.ts` does this with one SQL condition per transition: `UPDATE meetings SET status = 'active' WHERE id = … AND status = 'upcoming'`. A real bug found while testing: LiveKit's *recorder* joins the room before the human does, which would have started the meeting clock early. Now only a human participant (`kind = STANDARD`) counts — see `livekit-events.ts`.

---

## Part 3 — The voice agent

### What a voice agent is

**The idea.** A voice agent is a program that joins a call like a person: it listens, decides what to say, and talks. There are two common designs:
- **Cascade:** speech-to-text → language model → text-to-speech. Each step is a separate, swappable model.
- **Speech-to-speech:** one model hears audio and produces audio directly. Lower latency, but you're tied to one provider.

**In Meet AI.** The agent is a cascade, written in Python with [LiveKit Agents](https://docs.livekit.io/agents/) (`apps/agent/src/meet_agent/agent.py`). That choice is what lets the same code use free local models on a laptop and AWS services in production.

### VAD: is anyone speaking?

**The idea.** **Voice activity detection** listens to the audio stream and marks where speech starts and stops. The agent needs it to know when you've *finished* your sentence, so it can reply instead of interrupting.

**In Meet AI.** [Silero VAD](https://github.com/snakers4/silero-vad), a small model that runs on the CPU, configured in `agent.py` (`turn_detection: "vad"`).

### Speech-to-text (STT)

**The idea.** A speech recognition model turns audio into text. [Whisper](https://github.com/openai/whisper) is a popular open model.

**In Meet AI.** Locally, Whisper runs on the Mac's GPU through [mlx-audio](https://github.com/Blaizzy/mlx-audio) (`apps/speech/`). In AWS, [Amazon Transcribe](https://aws.amazon.com/transcribe/) takes its place.

### The language model (LLM)

**The idea.** A large language model predicts text. You give it **instructions** (a system prompt describing who it is) and the conversation so far; it writes the next reply. Models read text as **tokens** (roughly ¾ of a word each) and can only look at a limited number at once — the **context window**.

**In Meet AI.** Locally, [Ollama](https://ollama.com) runs `qwen3.5:4b`, a small model that fits in a laptop's memory; in AWS it's [Amazon Bedrock](https://aws.amazon.com/bedrock/)'s Nova Lite. The agent's instructions combine your agent's text with rules for speaking aloud — short sentences, no markdown, no lists (`apps/agent/src/meet_agent/prompts.py`).

### Text-to-speech (TTS)

**The idea.** A speech synthesis model turns text into audio in a chosen voice.

**In Meet AI.** [Kokoro](https://huggingface.co/hexgrad/Kokoro-82M) locally (voice `af_heart`), [Amazon Polly](https://aws.amazon.com/polly/) in AWS (the Indian-English voice `Kajal`).

### Latency

**The idea.** In conversation, a gap of more than about a second feels slow. A cascade adds up: detecting the end of speech + transcription + the LLM's first words + synthesis.

**In Meet AI.** On a laptop the gap is about 4–5 seconds, mostly the 4B model. The first request after starting a model is much slower (loading it into memory), so `make warmup` loads the models ahead of time.

### Running models locally — and why not in Docker

**The idea.** Models run far faster on a GPU. On a Mac, Apple's [MLX](https://github.com/ml-explore/mlx) framework and Ollama use the GPU through Metal. Docker on macOS runs Linux in a virtual machine *without GPU access*, so GPU-hungry processes run natively instead.

**In Meet AI.** Docker runs only the infrastructure (databases, LiveKit). The web app, worker, agent and speech server run as normal processes on your machine.

### OpenAI-compatible APIs and provider adapters

**The idea.** Many model servers copy OpenAI's API shape (`/v1/chat/completions`, `/v1/audio/transcriptions`, `/v1/audio/speech`). If your code speaks that shape, switching providers means changing a URL and a key. An **adapter** hides the remaining differences behind one interface.

**In Meet AI.** Every model is chosen by environment variables. The agent's `providers.py` builds OpenAI-compatible clients (Ollama, mlx-audio, or OpenAI itself) *or* AWS ones. The web app's `apps/web/src/lib/llm.ts` does the same with the [Vercel AI SDK](https://ai-sdk.dev). The code never says "Ollama" or "Bedrock" outside those two files.

---

## Part 4 — After the call

### Recording

**The idea.** Recording a call means one more participant that listens to everyone and writes a file.

**In Meet AI.** LiveKit's **Egress** service joins the room as a special participant (its own kind, not a person), mixes the audio, and uploads an MP4 when the room closes. The room is created with the recorder already attached, so no separate "start recording" call is needed.

### Object storage and presigned URLs

**The idea.** Files don't belong in a database. **Object storage** like [S3](https://aws.amazon.com/s3/) stores files ("objects") under names ("keys") such as `recordings/123.mp4`. The bucket stays private; to let a browser download one file, the server creates a **presigned URL** — a link that works for a few minutes and only for that file.

**In Meet AI.** The database stores the *key*, never a URL, because URLs expire (`apps/web/src/lib/aws.ts`). Locally, [moto](https://github.com/getmoto/moto) pretends to be S3 inside Docker, so the code is identical to production.

### Queues

**The idea.** Summarizing takes seconds or minutes, and it shouldn't be lost if a server restarts. A **queue** holds jobs until a **worker** finishes them. [Amazon SQS](https://aws.amazon.com/sqs/) works like this:
- A worker *receives* a message; SQS hides it for a while (the **visibility timeout**).
- If the worker finishes, it *deletes* the message. If it crashes, the message reappears and another attempt starts.
- After a few failed attempts the message moves to a **dead-letter queue** for a human to inspect.

Because a message can be delivered more than once (**at-least-once delivery**), the worker must be safe to run twice.

**In Meet AI.** The agent uploads `transcripts/<meeting>.jsonl` and sends `{ meetingId, transcriptKey }` to SQS (`apps/agent/src/meet_agent/publish.py`). The worker (`apps/web/src/worker/index.ts`) long-polls the queue and only deletes a message after the summary is saved. A real race the code handles: the transcript can arrive *before* LiveKit's "room finished" webhook, so the worker accepts meetings that are still marked `active`.

### Summarizing long text: map-reduce

**The idea.** A long transcript may not fit in a small model's context window. **Map-reduce** splits it into chunks, summarizes each one (map), then summarizes the summaries (reduce).

**In Meet AI.** `apps/web/src/modules/meetings/server/summarize.ts` does one pass when the transcript fits and map-reduce when it doesn't, splitting only between sentences (`chunkLines` in `transcript.ts`). The chunk size is an environment variable, so the same code serves a 4k-token local model and a much larger cloud model.

### Streaming responses

**The idea.** Language models produce text token by token. **Streaming** sends each piece to the browser as it's generated, so the answer starts appearing immediately.

**In Meet AI.** Ask AI is a route handler, `apps/web/src/app/api/meetings/[meetingId]/chat/route.ts`, using the AI SDK's `streamText`; the page reads the stream with `useChat`. Both sides of the conversation are saved in `meeting_messages`, so the chat survives a reload.

### Timeouts without a scheduler

**The idea.** Sometimes a job silently never finishes. Instead of running a background timer, you can check *when the data is read*: "if this has been processing for more than 15 minutes, call it failed".

**In Meet AI.** `failStaleProcessing` runs before meetings are listed or opened. If the summary arrives late anyway, the worker still completes the meeting.

---

## Part 5 — Guardrails

### A budget for paid AI

**The idea.** A public demo that calls paid AI services by the minute needs a ceiling, or one visitor can run up the bill.

**In Meet AI.** `DAILY_BUDGET_MIN` caps the total call minutes per day across all users (`apps/web/src/modules/meetings/server/budget.ts`). Joining a call computes the minutes left and passes them to the agent, which hangs up politely when they run out. The agent never needs database access to enforce it.

### Fail fast on bad configuration

Covered in [Validation with zod](#validation-with-zod): the web app, worker and agent all validate their settings at startup and refuse to run with a missing or malformed value.

---

## Part 6 — Shipping it

### A monorepo

**The idea.** A **monorepo** keeps several related programs in one repository, so a change that spans them is one commit.

**In Meet AI.** `apps/web` (TypeScript), `apps/agent` and `apps/speech` (Python), `infra/` and `docs/`. The root `Makefile` is the one entry point, and one `.env` at the root configures every app.

### Containers and Docker

**The idea.** A **container image** packages a program with everything it needs to run, so it behaves the same on any machine. A **Dockerfile** describes how to build it; a **multi-stage** build compiles in one stage and copies only the result into a small final image. **Docker Compose** starts several containers together from one file.

**In Meet AI.**
- `apps/web/Dockerfile` builds Next.js in *standalone* mode, a self-contained server.
- `apps/web/Dockerfile.worker` bundles the worker into a single JavaScript file with esbuild — no `node_modules` needed.
- `apps/agent/Dockerfile` builds the Python agent with uv.
- `infra/local/compose.yml` runs Postgres, Redis, LiveKit, Egress and moto for local development.

### Tests at three levels

**The idea.**
- **Unit tests** check one small function.
- **Integration tests** check pieces working together — for example, code plus a real database.
- **End-to-end (E2E) tests** drive a real browser like a user would.

There are more of the fast kinds and fewer of the slow ones (the "testing pyramid").

**In Meet AI.** [Vitest](https://vitest.dev) runs unit and integration tests against a *real* Postgres test database (`apps/web/tests/`). [Playwright](https://playwright.dev) signs up, creates agents and meetings, and joins a real LiveKit call with a fake microphone (`apps/web/e2e/`). [pytest](https://pytest.org) covers the agent. During development, a full voice call was also tested end to end by feeding a generated spoken question in as the microphone.

### Continuous integration (CI)

**The idea.** CI runs your checks automatically on every push, so broken code is caught before it's merged.

**In Meet AI.** `.github/workflows/ci.yml` type-checks, lints, tests and builds the web app, tests the agent, and validates the infrastructure code.

### The cloud: AWS building blocks

**The idea.** In the cloud you rent building blocks instead of machines in a cupboard. The ones Meet AI uses:

| Block | What it is | Meet AI's use |
|---|---|---|
| **Region** | A group of data centres | `ap-south-1` (Mumbai), close to its users |
| **VPC, subnets** | Your private network, split into public and private parts | Database in private subnets; nothing else can reach it |
| **Security group** | A firewall around each resource | e.g. "Postgres accepts connections only from the web app and the worker" |
| **ALB + ACM** | A load balancer, plus free TLS certificates for HTTPS | Puts the web app on `https://` |
| **ECS Fargate** | Runs containers without managing servers | Web app, worker, agent |
| **Spot** | Spare capacity, ~70% cheaper, can be taken back | Worker and agent (a queue retries interrupted work) |
| **EC2** | A virtual machine | LiveKit, which needs real network ports for WebRTC |
| **RDS** | Managed Postgres with backups | The database |
| **IAM roles** | Identities for services, with only the permissions they need (*least privilege*) | The agent may call Transcribe/Polly/Bedrock; the web app may not |
| **SSM Parameter Store** | Encrypted storage for secrets | Database password, auth secret, LiveKit secret |
| **OIDC** | Lets GitHub Actions prove who it is, so no AWS keys are stored in GitHub | The deploy workflow |

### Infrastructure as code

**The idea.** Instead of clicking through a console, you describe your infrastructure in files. A tool compares the files with reality, shows a **plan** of what will change, and **applies** it. The tool records what it created in a **state** file. The result is reviewable, repeatable and easy to tear down.

**In Meet AI.** [OpenTofu](https://opentofu.org) (an open-source fork of Terraform) describes about 90 AWS resources in `infra/aws/`. Before ever touching a real account, the whole configuration was applied against the moto emulator, catching mistakes for free.

### Thinking about cost

**The idea.** Cloud bills come from many small line items. A few are easy to miss: a NAT gateway (about $32/month just for existing), public IPv4 addresses (about $3.65/month each), and anything left running overnight.

**In Meet AI.** The AWS design avoids the NAT gateway, runs background work on Spot, and the [runbook](../infra/aws/README.md) lists the expected monthly cost (about $105 before AI usage) with ways to cut it.

---

## Glossary

| Term | Meaning |
|---|---|
| **API** | A defined way for programs to talk to each other |
| **Cascade (voice agent)** | Speech-to-text → LLM → text-to-speech as separate steps |
| **Context window** | How many tokens a language model can consider at once |
| **Container** | A packaged program with everything it needs to run |
| **Dead-letter queue** | Where messages go after failing too many times |
| **Egress** | LiveKit's recording service |
| **Hydration** | The browser picking up data the server already fetched |
| **Idempotent** | Safe to repeat: doing it twice has the same effect as once |
| **JWT** | A signed token carrying claims like "may join room X" |
| **LLM** | Large language model |
| **Migration** | A versioned change to a database's structure |
| **ORM** | A library that maps database tables to code |
| **Presigned URL** | A temporary link to one private file |
| **SFU** | A media server that forwards each participant's audio/video to the others |
| **Signaling** | Exchanging connection details before WebRTC media flows |
| **STT / TTS** | Speech-to-text / text-to-speech |
| **Token (LLM)** | A chunk of text, roughly ¾ of a word |
| **VAD** | Voice activity detection: is someone speaking? |
| **Webhook** | Another service calling your URL when something happens |
| **WebRTC** | The browser's technology for real-time audio and video |

---

*Want to go deeper? [`design.md`](design.md) has the full design and the reasoning behind each decision, and the [README](../README.md) explains how to run everything yourself.*
