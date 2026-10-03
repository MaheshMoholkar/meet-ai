# Meet AI — one entry point for the whole stack. Run `make help` for the list.
#
# Docker runs local infrastructure only (infra/local/compose.yml); the apps run
# natively. Every app reads the shared .env at the repository root.

# Pin the local Docker Desktop engine, so a globally selected remote context is never used.
export DOCKER_CONTEXT ?= desktop-linux
# LiveKit must advertise an address both the browser and the Egress container can reach.
export LIVEKIT_NODE_IP ?= $(shell ipconfig getifaddr en0 2>/dev/null || hostname -I 2>/dev/null | cut -d' ' -f1 || echo 127.0.0.1)

COMPOSE := docker compose -f infra/local/compose.yml --env-file .env
WEB     := pnpm --dir apps/web

.DEFAULT_GOAL := help
.PHONY: help setup up down logs dev worker db-migrate db-generate db-studio \
	speech warmup agent test agent-test e2e check

help: ## Show this help
	@grep -hE '^[a-z0-9-]+:.*## ' $(MAKEFILE_LIST) | awk -F':.*## ' '{printf "  \033[36m%-12s\033[0m %s\n", $$1, $$2}'

setup: ## Install dependencies for all apps
	$(WEB) install
	cd apps/agent && uv sync
	cd apps/speech && uv sync

up: ## Start local infrastructure (Postgres, LiveKit, Egress, Redis, AWS emulator)
	$(COMPOSE) up -d --wait
	$(WEB) aws:init

down: ## Stop local infrastructure (Postgres data is kept; the AWS emulator resets)
	$(COMPOSE) down

logs: ## Follow infrastructure logs
	$(COMPOSE) logs -f --tail=100

dev: up db-migrate ## Infrastructure + migrations + the web app on http://localhost:3000
	$(WEB) dev

worker: ## Summarizer worker (SQS → LLM → Postgres)
	$(WEB) worker

db-migrate: ## Apply database migrations
	$(WEB) db:migrate

db-generate: ## Generate a migration from apps/web/src/db/schema.ts
	$(WEB) db:generate

db-studio: ## Drizzle Studio
	$(WEB) db:studio

speech: ## Local Whisper + Kokoro server on port 8000 (Apple Silicon)
	./apps/speech/run.sh

warmup: ## Load the speech models and keep the Ollama model in memory
	./apps/speech/warmup.sh
	./apps/speech/llm-warmup.sh

agent: ## Voice agent worker in dev mode
	cd apps/agent && uv run -m livekit.agents start src/meet_agent/agent.py --dev

test: ## Web unit + integration tests (needs `make up`)
	$(WEB) test

agent-test: ## Agent tests and lint
	cd apps/agent && uv run pytest && uv run ruff check src tests

e2e: ## Playwright end-to-end tests (needs `make up`)
	$(WEB) test:e2e

check: ## Typecheck, lint and build the web app
	$(WEB) typecheck && $(WEB) lint && $(WEB) build
