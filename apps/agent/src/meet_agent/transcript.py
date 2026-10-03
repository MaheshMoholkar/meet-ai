"""Collects what was said during a call as JSONL lines (spec §6.1)."""

from __future__ import annotations

import json
import time
from dataclasses import asdict, dataclass, field
from typing import Literal

Speaker = Literal["user", "agent"]


@dataclass(frozen=True)
class TranscriptItem:
    speaker: Speaker
    text: str
    startMs: int  # noqa: N815 — field names match the web app's TranscriptItem
    endMs: int  # noqa: N815


@dataclass
class TranscriptCollector:
    """Timestamps are milliseconds since the call started."""

    started_at: float = field(default_factory=time.time)
    items: list[TranscriptItem] = field(default_factory=list)

    def add(
        self,
        speaker: Speaker,
        text: str,
        *,
        start: float | None = None,
        end: float | None = None,
    ) -> None:
        """Adds an utterance. `start`/`end` are Unix seconds; missing ones default to now."""
        cleaned = " ".join(text.split())
        if not cleaned:
            return

        now = time.time()
        end_s = end if end is not None else now
        start_s = start if start is not None else end_s

        self.items.append(
            TranscriptItem(
                speaker=speaker,
                text=cleaned,
                startMs=self._relative_ms(start_s),
                endMs=max(self._relative_ms(end_s), self._relative_ms(start_s)),
            )
        )

    def _relative_ms(self, timestamp: float) -> int:
        return max(0, round((timestamp - self.started_at) * 1000))

    def to_jsonl(self) -> str:
        ordered = sorted(self.items, key=lambda item: item.startMs)
        return "\n".join(json.dumps(asdict(item), ensure_ascii=False) for item in ordered)
