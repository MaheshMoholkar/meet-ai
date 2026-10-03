#!/usr/bin/env bash
# Loads the Ollama model and keeps it in memory (keep_alive -1), so the voice
# agent's first reply doesn't wait for a cold load. Ollama only; Bedrock needs nothing.
set -euo pipefail
cd "$(dirname "$0")/../.."
set -a; source .env; set +a
native="${LLM_BASE_URL%/v1}"
curl -sf "$native/api/chat" -H 'content-type: application/json' \
  -d "{\"model\":\"$LLM_MODEL\",\"messages\":[{\"role\":\"user\",\"content\":\"hi\"}],\"stream\":false,\"think\":false,\"keep_alive\":-1}" \
  > /dev/null
echo "$LLM_MODEL is loaded at $native and will stay in memory."
