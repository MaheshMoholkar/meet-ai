#!/usr/bin/env bash
# Runs `node dist/migrate.mjs` as a one-off Fargate task and waits for it.
set -euo pipefail
cd "$(dirname "$0")/../.."

deploy_json="$(tofu -chdir=infra output -json deploy)"
get() { python3 -c "import json,sys; print(json.loads(sys.argv[1])[sys.argv[2]])" "$deploy_json" "$1"; }

region="$(get AWS_REGION)"
cluster="$(get ECS_CLUSTER)"

task_arn="$(aws ecs run-task --region "$region" --cluster "$cluster" \
  --task-definition "$(get MIGRATE_TASK_DEF)" --launch-type FARGATE \
  --network-configuration "awsvpcConfiguration={subnets=[$(get TASK_SUBNETS)],securityGroups=[$(get TASK_SECURITY_GRP)],assignPublicIp=ENABLED}" \
  --query 'tasks[0].taskArn' --output text)"
echo "Migration task: $task_arn"

aws ecs wait tasks-stopped --region "$region" --cluster "$cluster" --tasks "$task_arn"
exit_code="$(aws ecs describe-tasks --region "$region" --cluster "$cluster" --tasks "$task_arn" \
  --query 'tasks[0].containers[0].exitCode' --output text)"

if [ "$exit_code" != "0" ]; then
  echo "Migrations failed (exit code $exit_code). Logs: aws logs tail /meet-ai/migrate --region $region" >&2
  exit 1
fi
echo "Migrations applied."
