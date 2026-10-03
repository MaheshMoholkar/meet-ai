"""Settings from the environment (the repo's .env in dev), validated at startup."""

from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path
from typing import Literal

Provider = Literal["openai_compatible", "aws"]

# agent/src/meet_agent/config.py → repo root
REPO_ROOT = Path(__file__).resolve().parents[3]


class ConfigError(ValueError):
    """A required setting is missing or invalid."""


def load_dotenv(path: Path = REPO_ROOT / ".env") -> None:
    """Minimal .env loader: KEY="value" lines; existing env vars win."""
    if not path.exists():
        return
    for line in path.read_text().splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, value = line.partition("=")
        value = value.strip()
        if len(value) >= 2 and value[0] == value[-1] and value[0] in "\"'":
            value = value[1:-1]
        os.environ.setdefault(key.strip(), value)


@dataclass(frozen=True)
class Settings:
    livekit_url: str
    livekit_api_key: str
    livekit_api_secret: str
    agent_name: str

    stt_provider: Provider
    stt_base_url: str | None
    stt_model: str
    tts_provider: Provider
    tts_base_url: str | None
    tts_model: str
    tts_voice: str
    llm_provider: Provider
    llm_base_url: str | None
    llm_api_key: str
    llm_model: str
    llm_reasoning_effort: str | None

    aws_region: str
    aws_endpoint_url: str | None
    aws_access_key_id: str | None
    aws_secret_access_key: str | None
    s3_bucket: str
    sqs_queue_url: str


def _provider(env: dict[str, str], key: str) -> Provider:
    value = env.get(key, "openai_compatible") or "openai_compatible"
    # The web app calls Bedrock "bedrock"; for the agent every AWS service is "aws".
    if value == "bedrock":
        value = "aws"
    if value not in ("openai_compatible", "aws"):
        raise ConfigError(f"{key} must be 'openai_compatible' or 'aws', got {value!r}")
    return value  # type: ignore[return-value]


def from_env(env: dict[str, str] | None = None) -> Settings:
    env = dict(os.environ if env is None else env)
    missing: list[str] = []

    def required(key: str) -> str:
        value = (env.get(key) or "").strip()
        if not value:
            missing.append(key)
        return value

    def optional(key: str, default: str | None = None) -> str | None:
        value = (env.get(key) or "").strip()
        return value or default

    stt_provider = _provider(env, "STT_PROVIDER")
    tts_provider = _provider(env, "TTS_PROVIDER")
    llm_provider = _provider(env, "LLM_PROVIDER")

    # LiveKit's server SDK talks HTTP; the agent worker wants the WebSocket URL.
    livekit_url = required("LIVEKIT_URL").replace("http://", "ws://").replace("https://", "wss://")

    settings = Settings(
        livekit_url=livekit_url,
        livekit_api_key=required("LIVEKIT_API_KEY"),
        livekit_api_secret=required("LIVEKIT_API_SECRET"),
        agent_name=optional("LIVEKIT_AGENT_NAME", "meet-agent") or "meet-agent",
        stt_provider=stt_provider,
        stt_base_url=required("STT_BASE_URL") if stt_provider == "openai_compatible" else None,
        stt_model=optional("STT_MODEL", "") or "",
        tts_provider=tts_provider,
        tts_base_url=required("TTS_BASE_URL") if tts_provider == "openai_compatible" else None,
        tts_model=optional("TTS_MODEL", "") or "",
        tts_voice=optional("TTS_VOICE", "") or "",
        llm_provider=llm_provider,
        llm_base_url=required("LLM_BASE_URL") if llm_provider == "openai_compatible" else None,
        llm_api_key=optional("LLM_API_KEY", "ollama") or "ollama",
        llm_model=required("LLM_MODEL"),
        llm_reasoning_effort=optional("LLM_REASONING_EFFORT"),
        aws_region=optional("AWS_REGION", "us-east-1") or "us-east-1",
        aws_endpoint_url=optional("AWS_ENDPOINT_URL"),
        aws_access_key_id=optional("AWS_ACCESS_KEY_ID"),
        aws_secret_access_key=optional("AWS_SECRET_ACCESS_KEY"),
        s3_bucket=required("S3_BUCKET"),
        sqs_queue_url=required("SQS_QUEUE_URL"),
    )

    if stt_provider == "openai_compatible" and not settings.stt_model:
        missing.append("STT_MODEL")
    if tts_provider == "openai_compatible" and not (settings.tts_model and settings.tts_voice):
        missing.extend(key for key, value in (("TTS_MODEL", settings.tts_model), ("TTS_VOICE", settings.tts_voice)) if not value)

    if missing:
        raise ConfigError("missing environment variables: " + ", ".join(sorted(set(missing))))
    return settings
