# Docker runs infrastructure only; app processes run natively.
# Pin the local Docker Desktop engine so a globally selected remote context is never used.
export DOCKER_CONTEXT := desktop-linux
# LiveKit must advertise an address that both the browser and the Egress container reach.
export LIVEKIT_NODE_IP ?= $(shell ipconfig getifaddr en0 2>/dev/null || echo 127.0.0.1)

.PHONY: up down logs dev db-generate db-migrate db-studio aws-init test e2e check \
	agent agent-test speech speech-warmup warmup

up: ## Start infrastructure, wait until healthy, create S3/SQS resources
	docker compose up -d --wait
	pnpm aws:init

down: ## Stop infrastructure (Postgres data is kept; the AWS emulator resets)
	docker compose down

logs:
	docker compose logs -f --tail=100

dev: up db-migrate ## Infrastructure + migrations + Next dev server
	pnpm dev

db-generate: ## Generate a SQL migration from src/db/schema.ts
	pnpm db:generate

db-migrate: ## Apply migrations to the dev database
	pnpm db:migrate

db-studio:
	pnpm db:studio

aws-init:
	pnpm aws:init

test: ## Unit + integration tests (needs `make up`)
	pnpm test

e2e: ## Playwright end-to-end tests (needs `make up`)
	pnpm test:e2e

check: ## Typecheck, lint, build
	pnpm typecheck && pnpm lint && pnpm build

agent: ## Voice agent worker in dev mode (needs `make up` and `make speech`)
	cd agent && uv run -m livekit.agents start src/meet_agent/agent.py --dev

agent-test:
	cd agent && uv run pytest && uv run ruff check src tests

speech: ## Local Whisper + Kokoro server (Metal), OpenAI-compatible, port 8000
	./speech/run.sh

speech-warmup: ## Load both speech models (first call would otherwise time out)
	./speech/warmup.sh

warmup: speech-warmup ## Load speech models and pin the Ollama model in memory
	./scripts/llm-warmup.sh
