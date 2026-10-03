import json

from livekit.plugins import aws, openai

from meet_agent.config import from_env
from meet_agent.metadata import parse_metadata
from meet_agent.prompts import agent_instructions, greeting
from meet_agent.providers import build_llm, build_stt, build_tts

from .test_config import BASE


def test_dev_providers_are_openai_compatible():
    settings = from_env(BASE | {"LLM_REASONING_EFFORT": "none"})
    assert isinstance(build_stt(settings), openai.STT)
    assert isinstance(build_tts(settings), openai.TTS)
    assert isinstance(build_llm(settings), openai.LLM)


def test_prod_providers_are_aws():
    settings = from_env(
        BASE
        | {
            "STT_PROVIDER": "aws",
            "TTS_PROVIDER": "aws",
            "LLM_PROVIDER": "bedrock",
            "LLM_MODEL": "amazon.nova-lite-v1:0",
        }
    )
    assert isinstance(build_stt(settings), aws.STT)
    assert isinstance(build_tts(settings), aws.TTS)
    assert isinstance(build_llm(settings), aws.LLM)


def test_mumbai_voice_settings_build():
    settings = from_env(
        BASE
        | {
            "STT_PROVIDER": "aws",
            "TTS_PROVIDER": "aws",
            "STT_LANGUAGE": "en-IN",
            "TTS_VOICE": "Kajal",
            "TTS_LANGUAGE": "en-IN",
            "AWS_REGION": "ap-south-1",
        }
    )
    assert isinstance(build_tts(settings), aws.TTS)
    assert isinstance(build_stt(settings), aws.STT)
    # Whisper (dev) gets the bare language code from the same setting.
    dev = from_env(BASE | {"STT_LANGUAGE": "en-IN"})
    assert isinstance(build_stt(dev), openai.STT)


def test_instructions_carry_name_voice_rules_and_user_instructions():
    meta = parse_metadata(
        json.dumps(
            {
                "meetingId": "m",
                "agentName": "Coach",
                "instructions": "Ask one question at a time.",
                "maxDurationSec": 300,
            }
        )
    )
    text = agent_instructions(meta)
    assert "Your name is Coach." in text
    assert "spoken aloud" in text
    assert text.endswith("Ask one question at a time.")
    assert "Coach" in greeting(meta)
