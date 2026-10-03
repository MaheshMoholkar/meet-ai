# Voice agent worker. Built for linux/arm64 (Graviton Fargate).
FROM python:3.13-slim
COPY --from=ghcr.io/astral-sh/uv:0.11 /uv /bin/uv
WORKDIR /app
ENV UV_COMPILE_BYTECODE=1 UV_LINK_MODE=copy UV_PYTHON_DOWNLOADS=never

COPY pyproject.toml uv.lock ./
RUN --mount=type=cache,target=/root/.cache/uv uv sync --frozen --no-dev --no-install-project
COPY src ./src
RUN --mount=type=cache,target=/root/.cache/uv uv sync --frozen --no-dev

RUN useradd --create-home --uid 10001 agent
USER agent
ENV PATH=/app/.venv/bin:$PATH
# Production mode: registers with LiveKit and waits for dispatches.
CMD ["python", "-m", "livekit.agents", "start", "src/meet_agent/agent.py"]
