# Meet AI voice agent

A [LiveKit Agents](https://docs.livekit.io/agents/) worker. The web app dispatches it by name (`meet-agent`) into a meeting's room with JSON metadata (`meetingId`, `agentName`, `instructions`, `maxDurationSec`). It talks with the one human in the room, ends the call when they leave or when the time budget runs out, and then hands the transcript to the summarizer: JSONL to `s3://$S3_BUCKET/transcripts/{meetingId}.jsonl` plus a message on `$SQS_QUEUE_URL`.

| Module | Role |
|---|---|
| `agent.py` | `AgentServer` entrypoint: session, transcript events, hang-up rules, `on_session_end` publish |
| `providers.py` | STT / LLM / TTS from env: OpenAI-compatible endpoints (dev) or AWS Transcribe / Bedrock / Polly (prod) |
| `config.py` | Settings from the repo's `.env`, validated at startup |
| `metadata.py`, `transcript.py`, `publish.py`, `prompts.py` | Dispatch metadata, transcript collector, S3 + SQS hand-off, instructions |

The agent never touches Postgres; everything it needs arrives in the dispatch metadata.

## Run

From the repository root:

```bash
make setup      # uv sync (and the other apps)
make speech     # local Whisper + Kokoro server (Metal), OpenAI-compatible
make agent      # registers with LiveKit and waits for dispatches
make agent-test # pytest + ruff
```

Turn-taking is set to VAD explicitly: LiveKit's defaults would call LiveKit Cloud services.

## Environment

Read from the shared `.env` at the repository root (existing env vars win): `LIVEKIT_*`, `LLM_*`, `STT_*`, `TTS_*`, `AWS_*`, `S3_BUCKET`, `SQS_QUEUE_URL`. Set `STT_PROVIDER`, `TTS_PROVIDER` and `LLM_PROVIDER` to `aws` (or `bedrock` for the LLM) in AWS.
