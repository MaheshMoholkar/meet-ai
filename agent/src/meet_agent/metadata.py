"""The dispatch metadata the web app attaches to each job (spec §4.1)."""

from __future__ import annotations

import json
from dataclasses import dataclass

# Never let a bad value run a call forever or end it instantly.
MIN_DURATION_SEC = 30
MAX_DURATION_SEC = 60 * 60


class MetadataError(ValueError):
    """The job metadata is missing or malformed."""


@dataclass(frozen=True)
class JobMetadata:
    meeting_id: str
    agent_name: str
    instructions: str
    max_duration_sec: int


def parse_metadata(raw: str | None) -> JobMetadata:
    if not raw:
        raise MetadataError("job metadata is empty")

    try:
        data = json.loads(raw)
    except json.JSONDecodeError as error:
        raise MetadataError(f"job metadata is not JSON: {error}") from error

    if not isinstance(data, dict):
        raise MetadataError("job metadata must be a JSON object")

    def text(key: str) -> str:
        value = data.get(key)
        if not isinstance(value, str) or not value.strip():
            raise MetadataError(f"job metadata needs a non-empty string {key!r}")
        return value.strip()

    duration = data.get("maxDurationSec")
    if not isinstance(duration, (int, float)) or isinstance(duration, bool):
        raise MetadataError("job metadata needs a numeric 'maxDurationSec'")

    return JobMetadata(
        meeting_id=text("meetingId"),
        agent_name=text("agentName"),
        instructions=text("instructions"),
        max_duration_sec=int(min(max(duration, MIN_DURATION_SEC), MAX_DURATION_SEC)),
    )
