#!/usr/bin/env bash
# Builds the web, worker and agent images (linux/arm64) and pushes them to ECR
# as :latest. Needs only the ECR repositories, so it works right after
# `tofu apply -target='aws_ecr_repository.app'` (README step 3).
set -euo pipefail
cd "$(dirname "$0")/../../.."

repos_json="$(tofu -chdir=infra/aws output -json ecr_repositories)"
repo() { python3 -c "import json,sys; print(json.loads(sys.argv[1])[sys.argv[2]])" "$repos_json" "$1"; }
app_url="$(tofu -chdir=infra/aws output -raw app_url)"

web="$(repo web)"; worker="$(repo worker)"; agent="$(repo agent)"
registry="${web%%/*}"                                   # <account>.dkr.ecr.<region>.amazonaws.com
region="$(echo "$registry" | cut -d. -f4)"

aws ecr get-login-password --region "$region" | docker login --username AWS --password-stdin "$registry"

docker buildx build --platform linux/arm64 -f apps/web/Dockerfile --build-arg "NEXT_PUBLIC_APP_URL=$app_url" \
  -t "$web:latest" --push apps/web
docker buildx build --platform linux/arm64 -f apps/web/Dockerfile.worker -t "$worker:latest" --push apps/web
docker buildx build --platform linux/arm64 -t "$agent:latest" --push apps/agent

echo "Pushed web, worker and agent to $registry."
