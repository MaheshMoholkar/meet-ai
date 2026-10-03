# Docker runs infrastructure only; app processes run natively.
# Pin the local Docker Desktop engine so a globally selected remote context is never used.
export DOCKER_CONTEXT := desktop-linux

.PHONY: up down logs dev db-generate db-migrate db-studio test test-unit test-integration e2e check

up: ## Start infrastructure and wait until healthy
	docker compose up -d --wait

down: ## Stop infrastructure (data is kept)
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

test: up ## Unit + integration tests
	pnpm test

e2e: up ## Playwright end-to-end tests (builds and starts the app on the test database)
	pnpm test:e2e

check: ## Typecheck, lint, build
	pnpm typecheck && pnpm lint && pnpm build
