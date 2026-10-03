import json

import pytest

from meet_agent.metadata import MAX_DURATION_SEC, MIN_DURATION_SEC, MetadataError, parse_metadata


def payload(**overrides):
    data = {
        "meetingId": "4b3f7c1e-9d2a-4e8f-a1b2-c3d4e5f60718",
        "agentName": "Tutor",
        "instructions": "Be patient.",
        "maxDurationSec": 600,
    }
    data.update(overrides)
    return json.dumps(data)


def test_parses_valid_metadata():
    meta = parse_metadata(payload(agentName="  Tutor "))
    assert meta.meeting_id == "4b3f7c1e-9d2a-4e8f-a1b2-c3d4e5f60718"
    assert meta.agent_name == "Tutor"
    assert meta.instructions == "Be patient."
    assert meta.max_duration_sec == 600


def test_clamps_duration():
    assert parse_metadata(payload(maxDurationSec=5)).max_duration_sec == MIN_DURATION_SEC
    assert parse_metadata(payload(maxDurationSec=10**9)).max_duration_sec == MAX_DURATION_SEC
    assert parse_metadata(payload(maxDurationSec=90.7)).max_duration_sec == 90


@pytest.mark.parametrize(
    "raw",
    [
        None,
        "",
        "not json",
        "[]",
        payload(meetingId=""),
        payload(instructions=None),
        payload(maxDurationSec="600"),
        payload(maxDurationSec=True),
    ],
)
def test_rejects_bad_metadata(raw):
    with pytest.raises(MetadataError):
        parse_metadata(raw)
