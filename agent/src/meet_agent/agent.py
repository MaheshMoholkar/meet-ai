"""Meet AI voice agent (spec §5.3).

Dispatched by name into a meeting's room with JSON metadata. Talks with the one
human in the room, ends the call when they leave or when the time budget runs
out, and hands the transcript to the summarizer (S3 + SQS) once the session ends.

Run (dev):  uv run -m livekit.agents start src/meet_agent/agent.py --dev
"""

from __future__ import annotations

import asyncio
import logging
import os
import time
from dataclasses import dataclass, field

from livekit import rtc
from livekit.agents import (
    Agent,
    AgentServer,
    AgentSession,
    ConversationItemAddedEvent,
    JobContext,
    room_io,
)
from livekit.plugins import silero

from meet_agent.config import from_env, load_dotenv
from meet_agent.metadata import JobMetadata, parse_metadata
from meet_agent.prompts import GOODBYE, agent_instructions, greeting
from meet_agent.providers import build_llm, build_stt, build_tts
from meet_agent.publish import publish_transcript
from meet_agent.transcript import TranscriptCollector

logger = logging.getLogger("meet-agent")

load_dotenv()
settings = from_env()

server = AgentServer(
    ws_url=settings.livekit_url,
    api_key=settings.livekit_api_key,
    api_secret=settings.livekit_api_secret,
)


@dataclass
class CallState:
    meta: JobMetadata
    transcript: TranscriptCollector = field(default_factory=TranscriptCollector)
    tasks: list[asyncio.Task[None]] = field(default_factory=list)


def _is_human(participant: rtc.RemoteParticipant) -> bool:
    return participant.kind == rtc.ParticipantKind.PARTICIPANT_KIND_STANDARD


async def on_session_end(ctx: JobContext) -> None:
    """Runs after the session closes, with its own time budget: publish the transcript."""
    session = ctx.primary_session
    if session is None or not isinstance(session.userdata, CallState):
        return
    state: CallState = session.userdata
    await publish_transcript(settings, state.meta.meeting_id, state.transcript.to_jsonl())


@server.rtc_session(agent_name=settings.agent_name, on_session_end=on_session_end)
async def entrypoint(ctx: JobContext) -> None:
    meta = parse_metadata(ctx.job.metadata)
    state = CallState(meta=meta)
    logger.info("joining meeting %s as %s (max %ss)", meta.meeting_id, meta.agent_name, meta.max_duration_sec)

    session = AgentSession(
        stt=build_stt(settings),
        llm=build_llm(settings),
        tts=build_tts(settings),
        vad=silero.VAD.load(),
        # Explicit VAD turn-taking: the defaults call LiveKit Cloud services.
        turn_handling={"turn_detection": "vad", "interruption": {"mode": "vad"}},
        userdata=state,
    )

    @session.on("conversation_item_added")
    def on_item(event: ConversationItemAddedEvent) -> None:
        item = event.item
        if getattr(item, "type", None) != "message" or item.role not in ("user", "assistant"):
            return
        metrics = getattr(item, "metrics", None) or {}
        state.transcript.add(
            "user" if item.role == "user" else "agent",
            item.text_content or "",
            start=metrics.get("started_speaking_at"),
            end=metrics.get("stopped_speaking_at", item.created_at),
        )

    @ctx.room.on("participant_disconnected")
    def on_left(_participant: rtc.RemoteParticipant) -> None:
        # One human per call: when nobody is left, end it (the built-in auto-close
        # misses network drops). The leaver is already gone from the list here.
        if not any(_is_human(p) for p in ctx.room.remote_participants.values()):
            logger.info("meeting %s: the human left, ending the call", meta.meeting_id)
            session.shutdown()

    await session.start(
        Agent(instructions=agent_instructions(meta)),
        room=ctx.room,
        room_options=room_io.RoomOptions(delete_room_on_close=True),
    )

    await ctx.wait_for_participant()
    # Transcript times count from when the human arrived (≈ the meeting's startedAt).
    state.transcript.started_at = time.time()
    session.say(greeting(meta))

    async def hang_up_when_out_of_time() -> None:
        await asyncio.sleep(meta.max_duration_sec)
        logger.info("meeting %s: time budget used up, ending the call", meta.meeting_id)
        await session.say(GOODBYE, allow_interruptions=False)
        session.shutdown()

    timer = asyncio.create_task(hang_up_when_out_of_time())
    state.tasks.append(timer)

    @session.on("close")
    def on_close(_event: object) -> None:
        timer.cancel()


if __name__ == "__main__":
    from livekit.agents import cli

    os.environ.setdefault("LIVEKIT_AGENT_NAME", settings.agent_name)
    cli.run_app(server)
