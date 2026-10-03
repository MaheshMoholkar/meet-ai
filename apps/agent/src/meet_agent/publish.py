"""Hands a finished call to the summarizer: transcript to S3, then a message on SQS."""

from __future__ import annotations

import asyncio
import json
import logging
from typing import Any

import boto3

from .config import Settings

logger = logging.getLogger("meet-agent.publish")


def transcript_key(meeting_id: str) -> str:
    return f"transcripts/{meeting_id}.jsonl"


def _clients(settings: Settings) -> tuple[Any, Any]:
    # Endpoint and static keys only for the local emulator; in AWS the default
    # credential chain (task role) applies.
    common: dict[str, Any] = {"region_name": settings.aws_region}
    if settings.aws_endpoint_url:
        common["endpoint_url"] = settings.aws_endpoint_url
    if settings.aws_access_key_id and settings.aws_secret_access_key:
        common["aws_access_key_id"] = settings.aws_access_key_id
        common["aws_secret_access_key"] = settings.aws_secret_access_key

    s3_config = {}
    if settings.aws_endpoint_url:
        s3_config["config"] = boto3.session.Config(s3={"addressing_style": "path"})

    return boto3.client("s3", **common, **s3_config), boto3.client("sqs", **common)


def publish_transcript_sync(settings: Settings, meeting_id: str, jsonl: str) -> str:
    s3, sqs = _clients(settings)
    key = transcript_key(meeting_id)

    s3.put_object(
        Bucket=settings.s3_bucket,
        Key=key,
        Body=jsonl.encode("utf-8"),
        ContentType="application/x-ndjson",
    )
    sqs.send_message(
        QueueUrl=settings.sqs_queue_url,
        MessageBody=json.dumps({"meetingId": meeting_id, "transcriptKey": key}),
    )
    return key


async def publish_transcript(
    settings: Settings, meeting_id: str, jsonl: str, *, attempts: int = 3
) -> str | None:
    """Uploads with retries. Returns the key, or None if every attempt failed
    (the web app's processing timeout then marks the meeting failed)."""
    for attempt in range(1, attempts + 1):
        try:
            key = await asyncio.to_thread(publish_transcript_sync, settings, meeting_id, jsonl)
            logger.info("published transcript for meeting %s to %s", meeting_id, key)
            return key
        except Exception:
            logger.exception("publishing transcript failed (attempt %d/%d)", attempt, attempts)
            if attempt < attempts:
                await asyncio.sleep(2**attempt)
    return None
