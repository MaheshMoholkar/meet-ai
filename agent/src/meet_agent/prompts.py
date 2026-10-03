"""What the agent is told before the call starts."""

from __future__ import annotations

from meet_agent.metadata import JobMetadata

VOICE_RULES = """
You are on a live voice call. Everything you write is spoken aloud by a text-to-speech voice, so:
- Keep replies short: one to three sentences, then let the user talk.
- Use plain conversational sentences. No markdown, lists, emojis, code or URLs.
- If you didn't catch something, ask the user to repeat it.
""".strip()


def agent_instructions(meta: JobMetadata) -> str:
    return (
        f"Your name is {meta.agent_name}.\n\n"
        f"{VOICE_RULES}\n\n"
        "Follow these instructions from the person who set up this meeting:\n"
        f"{meta.instructions}"
    )


def greeting(meta: JobMetadata) -> str:
    return f"Hi, I'm {meta.agent_name}. What would you like to talk about?"


GOODBYE = "We're out of time for today. Thanks for the conversation, goodbye!"
