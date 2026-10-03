"""Speech-to-text, LLM and text-to-speech chosen by env (spec §4.1).

Dev: OpenAI-compatible endpoints (local Whisper/Kokoro server, Ollama).
Prod: AWS Transcribe, Bedrock and Polly.
"""

from __future__ import annotations

from typing import Any

from livekit.plugins import aws, openai

from meet_agent.config import Settings

# OpenAI-compatible servers ignore the key, but the plugin refuses an empty one.
_UNUSED_KEY = "unused"


def build_stt(settings: Settings) -> Any:
    if settings.stt_provider == "aws":
        return aws.STT(language=settings.stt_language or "en-US", region=settings.aws_region)
    return openai.STT(
        model=settings.stt_model,
        base_url=settings.stt_base_url,
        api_key=_UNUSED_KEY,
        # Whisper wants a bare language code ("en"), Transcribe a locale ("en-IN").
        language=(settings.stt_language or "en").split("-")[0],
    )


def build_llm(settings: Settings) -> Any:
    if settings.llm_provider == "aws":
        return aws.LLM(model=settings.llm_model, region=settings.aws_region)

    options: dict[str, Any] = {}
    if settings.llm_reasoning_effort:
        options["reasoning_effort"] = settings.llm_reasoning_effort
    return openai.LLM.with_ollama(
        model=settings.llm_model,
        base_url=settings.llm_base_url or "http://localhost:11434/v1",
        **options,
    )


def build_tts(settings: Settings) -> Any:
    if settings.tts_provider == "aws":
        options: dict[str, Any] = {}
        if settings.tts_language:
            options["language"] = settings.tts_language
        return aws.TTS(
            voice=settings.tts_voice or "Kajal",
            speech_engine=settings.tts_engine,
            region=settings.aws_region,
            **options,
        )
    return openai.TTS(
        model=settings.tts_model,
        voice=settings.tts_voice,
        base_url=settings.tts_base_url,
        api_key=_UNUSED_KEY,
        # pcm: mp3 would need ffmpeg on the speech server.
        response_format="pcm",
    )
