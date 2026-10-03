import pytest

from meet_agent.config import ConfigError, from_env

BASE = {
    "LIVEKIT_URL": "http://localhost:7880",
    "LIVEKIT_API_KEY": "devkey",
    "LIVEKIT_API_SECRET": "secret",
    "STT_BASE_URL": "http://localhost:8000/v1",
    "STT_MODEL": "whisper",
    "TTS_BASE_URL": "http://localhost:8000/v1",
    "TTS_MODEL": "kokoro",
    "TTS_VOICE": "af_heart",
    "LLM_BASE_URL": "http://localhost:11434/v1",
    "LLM_MODEL": "qwen3.5:4b",
    "S3_BUCKET": "meetai",
    "SQS_QUEUE_URL": "http://localhost:4566/123456789012/meetai-summarize",
}


def test_dev_settings_use_openai_compatible_endpoints():
    settings = from_env(BASE)
    assert settings.livekit_url == "ws://localhost:7880"
    assert settings.agent_name == "meet-agent"
    assert (settings.stt_provider, settings.tts_provider, settings.llm_provider) == (
        "openai_compatible",
        "openai_compatible",
        "openai_compatible",
    )
    assert settings.aws_endpoint_url is None


def test_aws_providers_need_no_base_urls():
    env = {
        key: value
        for key, value in BASE.items()
        if key not in {"STT_BASE_URL", "STT_MODEL", "TTS_BASE_URL", "TTS_MODEL", "TTS_VOICE", "LLM_BASE_URL"}
    }
    env |= {"STT_PROVIDER": "aws", "TTS_PROVIDER": "aws", "LLM_PROVIDER": "bedrock"}

    settings = from_env(env)

    assert settings.llm_provider == "aws"
    assert settings.stt_base_url is None


def test_reports_every_missing_variable():
    env = {key: value for key, value in BASE.items() if key not in {"LLM_MODEL", "TTS_VOICE", "S3_BUCKET"}}
    with pytest.raises(ConfigError, match="LLM_MODEL.*S3_BUCKET.*TTS_VOICE"):
        from_env(env)


def test_rejects_unknown_provider():
    with pytest.raises(ConfigError, match="STT_PROVIDER"):
        from_env(BASE | {"STT_PROVIDER": "azure"})


def test_provider_timeout_defaults_to_30_and_is_validated():
    assert from_env(BASE).provider_timeout_sec == 30.0
    assert from_env(BASE | {"AGENT_PROVIDER_TIMEOUT_SEC": "12.5"}).provider_timeout_sec == 12.5
    with pytest.raises(ConfigError, match="AGENT_PROVIDER_TIMEOUT_SEC"):
        from_env(BASE | {"AGENT_PROVIDER_TIMEOUT_SEC": "0"})


def test_speech_language_and_engine_settings():
    settings = from_env(BASE)
    assert (settings.tts_engine, settings.tts_language, settings.stt_language) == ("neural", None, None)

    settings = from_env(BASE | {"TTS_ENGINE": "generative", "TTS_LANGUAGE": "en-IN", "STT_LANGUAGE": "en-IN"})
    assert (settings.tts_engine, settings.tts_language, settings.stt_language) == (
        "generative",
        "en-IN",
        "en-IN",
    )
