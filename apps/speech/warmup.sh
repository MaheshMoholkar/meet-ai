#!/usr/bin/env bash
# Loads both models so the first call doesn't hit LiveKit's 30 s request timeout.
set -euo pipefail
cd "$(dirname "$0")"
set -a; source ../../.env; set +a
tmp="$(mktemp -d)"
curl -sf "$TTS_BASE_URL/audio/speech" -H 'content-type: application/json' \
  -d "{\"model\":\"$TTS_MODEL\",\"voice\":\"$TTS_VOICE\",\"input\":\"Warming up.\",\"response_format\":\"wav\"}" \
  -o "$tmp/warmup.wav"
curl -sf "$STT_BASE_URL/audio/transcriptions" -F "file=@$tmp/warmup.wav" -F "model=$STT_MODEL" -F "response_format=json"
echo
rm -r "$tmp"
