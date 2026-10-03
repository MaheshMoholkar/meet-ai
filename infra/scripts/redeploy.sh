#!/usr/bin/env bash
# Starts a fresh deployment of every service and waits until they're stable.
# Needed once after the first migrations: ECS's circuit breaker marks the very
# first deployment failed (the database was empty) and doesn't retry by itself.
set -euo pipefail
cd "$(dirname "$0")/../.."

deploy_json="$(tofu -chdir=infra output -json deploy)"
get() { python3 -c "import json,sys; print(json.loads(sys.argv[1])[sys.argv[2]])" "$deploy_json" "$1"; }
region="$(get AWS_REGION)"; cluster="$(get ECS_CLUSTER)"

for service in web worker agent; do
  aws ecs update-service --region "$region" --cluster "$cluster" --service "$service" \
    --force-new-deployment --query 'service.serviceName' --output text
done
aws ecs wait services-stable --region "$region" --cluster "$cluster" --services web worker agent
echo "web, worker and agent are stable."
