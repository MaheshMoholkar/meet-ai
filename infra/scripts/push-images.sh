#!/usr/bin/env bash
# Builds the web, worker and agent images (linux/arm64) and pushes them to ECR
# as :latest. For the first deploy, or when GitHub Actions isn't set up yet.
set -euo pipefail
cd "$(dirname "$0")/../.."

deploy_json="$(tofu -chdir=infra output -json deploy)"
get() { python3 -c "import json,sys; print(json.loads(sys.argv[1])[sys.argv[2]])" "$deploy_json" "$1"; }

region="$(get AWS_REGION)"
registry="$(get ECR_REGISTRY)"
prefix="$(get ECR_PREFIX)"
app_url="$(get APP_URL)"

aws ecr get-login-password --region "$region" | docker login --username AWS --password-stdin "$registry"

docker buildx build --platform linux/arm64 -f Dockerfile.web --build-arg "NEXT_PUBLIC_APP_URL=$app_url" \
  -t "$registry/$prefix/web:latest" --push .
docker buildx build --platform linux/arm64 -f Dockerfile.worker -t "$registry/$prefix/worker:latest" --push .
docker buildx build --platform linux/arm64 -t "$registry/$prefix/agent:latest" --push agent

echo "Pushed web, worker and agent to $registry/$prefix."
