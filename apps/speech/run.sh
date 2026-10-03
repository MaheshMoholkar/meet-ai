#!/usr/bin/env bash
# Starts the local OpenAI-compatible speech server (Metal) on 127.0.0.1:8000.
set -euo pipefail
cd "$(dirname "$0")"
uv sync --quiet
# espeak-ng otherwise looks for its data at a path baked in at build time and crashes.
ESPEAK_DATA_PATH="$(uv run python -c 'import espeakng_loader, os; print(os.path.join(os.path.dirname(espeakng_loader.__file__), "espeak-ng-data"))')"
export ESPEAK_DATA_PATH
exec uv run mlx_audio.server --host 127.0.0.1 --port "${SPEECH_PORT:-8000}"
