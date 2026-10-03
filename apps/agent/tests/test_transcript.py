import json

from meet_agent.transcript import TranscriptCollector


def test_records_relative_timestamps_and_sorts_by_start():
    collector = TranscriptCollector(started_at=1000.0)
    collector.add("agent", "Hi there!", start=1002.0, end=1003.5)
    collector.add("user", "  hello \n  agent ", start=1000.5, end=1001.25)

    lines = [json.loads(line) for line in collector.to_jsonl().splitlines()]

    assert lines == [
        {"speaker": "user", "text": "hello agent", "startMs": 500, "endMs": 1250},
        {"speaker": "agent", "text": "Hi there!", "startMs": 2000, "endMs": 3500},
    ]


def test_skips_empty_text_and_clamps_before_start():
    collector = TranscriptCollector(started_at=1000.0)
    collector.add("user", "   ")
    collector.add("user", "early", start=990.0, end=995.0)

    assert [item.text for item in collector.items] == ["early"]
    assert collector.items[0].startMs == 0
    assert collector.items[0].endMs == 0


def test_missing_times_default_to_now(monkeypatch):
    monkeypatch.setattr("meet_agent.transcript.time.time", lambda: 1010.0)
    collector = TranscriptCollector(started_at=1000.0)
    collector.add("agent", "Done")

    assert collector.items[0].startMs == 10_000
    assert collector.items[0].endMs == 10_000


def test_empty_transcript_is_empty_string():
    assert TranscriptCollector().to_jsonl() == ""
