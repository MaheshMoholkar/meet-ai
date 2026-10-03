resource "aws_ecs_cluster" "main" {
  name = var.project

  setting {
    name  = "containerInsights"
    value = "disabled" # ~$3/month per service when on; turn on when debugging
  }
}

resource "aws_ecs_cluster_capacity_providers" "main" {
  cluster_name       = aws_ecs_cluster.main.name
  capacity_providers = ["FARGATE", "FARGATE_SPOT"]
}

resource "aws_cloudwatch_log_group" "app" {
  for_each = toset(["web", "worker", "agent", "migrate"])

  name              = "/${var.project}/${each.key}"
  retention_in_days = 14
}

locals {
  image = { for name, repo in aws_ecr_repository.app : name => "${repo.repository_url}:${var.image_tag}" }

  # The web app and the worker share one validated config (src/env.ts).
  app_environment = merge(
    {
      NODE_ENV             = "production"
      BETTER_AUTH_URL      = "https://${var.app_domain}"
      NEXT_PUBLIC_APP_URL  = "https://${var.app_domain}"
      LIVEKIT_URL          = "http://${aws_instance.media.private_ip}:7880"
      LIVEKIT_PUBLIC_URL   = "wss://${var.rtc_domain}"
      LIVEKIT_API_KEY      = var.livekit_api_key
      LIVEKIT_AGENT_NAME   = "meet-agent"
      DAILY_BUDGET_MIN     = tostring(var.daily_budget_minutes)
      RECORDING_ENABLED    = "true"
      AWS_REGION           = var.region
      S3_BUCKET            = aws_s3_bucket.media.bucket
      SQS_QUEUE_URL        = aws_sqs_queue.summarize.url
      LLM_PROVIDER         = "bedrock"
      LLM_MODEL            = var.llm_model
      LLM_MAX_INPUT_TOKENS = tostring(var.llm_max_input_tokens)
    },
    var.github_oauth == null ? {} : { GITHUB_CLIENT_ID = var.github_oauth.client_id },
    var.google_oauth == null ? {} : { GOOGLE_CLIENT_ID = var.google_oauth.client_id },
  )

  app_secret_names = nonsensitive([for k in keys(local.secret_values) : k])

  agent_environment = {
    LIVEKIT_URL        = "ws://${aws_instance.media.private_ip}:7880"
    LIVEKIT_API_KEY    = var.livekit_api_key
    LIVEKIT_AGENT_NAME = "meet-agent"
    STT_PROVIDER       = "aws"
    STT_LANGUAGE       = var.speech.stt_language
    TTS_PROVIDER       = "aws"
    TTS_VOICE          = var.speech.tts_voice
    TTS_ENGINE         = var.speech.tts_engine
    TTS_LANGUAGE       = var.speech.tts_language
    LLM_PROVIDER       = "bedrock"
    LLM_MODEL          = var.llm_model
    AWS_REGION         = var.region
    S3_BUCKET          = aws_s3_bucket.media.bucket
    SQS_QUEUE_URL      = aws_sqs_queue.summarize.url
  }

  services = {
    web = {
      size        = var.web
      environment = local.app_environment
      secrets     = local.app_secret_names
      command     = null
      port        = 3000
    }
    worker = {
      size        = var.worker
      environment = local.app_environment
      secrets     = local.app_secret_names
      command     = null
      port        = null
    }
    agent = {
      size        = var.agent
      environment = local.agent_environment
      secrets     = ["LIVEKIT_API_SECRET"]
      command     = null
      port        = null
    }
  }
}

resource "aws_ecs_task_definition" "app" {
  for_each = local.services

  family                   = "${var.project}-${each.key}"
  requires_compatibilities = ["FARGATE"]
  network_mode             = "awsvpc"
  cpu                      = each.value.size.cpu
  memory                   = each.value.size.memory
  execution_role_arn       = aws_iam_role.execution.arn
  task_role_arn            = aws_iam_role.task[each.key].arn

  runtime_platform {
    operating_system_family = "LINUX"
    cpu_architecture        = "ARM64"
  }

  # merge() leaves `command` out entirely when unset: a JSON null makes ECS report a perpetual diff.
  container_definitions = jsonencode([merge(each.value.command == null ? {} : { command = each.value.command }, {
    name      = each.key
    image     = local.image[each.key]
    essential = true

    portMappings = each.value.port == null ? [] : [{ containerPort = each.value.port, protocol = "tcp" }]

    environment = [for k, v in each.value.environment : { name = k, value = v }]
    secrets     = [for k in each.value.secrets : { name = k, valueFrom = aws_ssm_parameter.secret[k].arn }]

    # Long-running calls and the worker's long poll need time to finish on deploys.
    stopTimeout = each.key == "web" ? 30 : 120

    logConfiguration = {
      logDriver = "awslogs"
      options = {
        awslogs-group         = aws_cloudwatch_log_group.app[each.key].name
        awslogs-region        = var.region
        awslogs-stream-prefix = each.key
      }
    }
  })])
}

# One-off: `node dist/migrate.mjs` from the worker image, run by CI before each deploy.
resource "aws_ecs_task_definition" "migrate" {
  family                   = "${var.project}-migrate"
  requires_compatibilities = ["FARGATE"]
  network_mode             = "awsvpc"
  cpu                      = 256
  memory                   = 512
  execution_role_arn       = aws_iam_role.execution.arn
  task_role_arn            = aws_iam_role.task["worker"].arn

  runtime_platform {
    operating_system_family = "LINUX"
    cpu_architecture        = "ARM64"
  }

  container_definitions = jsonencode([{
    name      = "migrate"
    image     = local.image["worker"]
    essential = true
    command   = ["node", "dist/migrate.mjs"]
    secrets   = [{ name = "DATABASE_URL", valueFrom = aws_ssm_parameter.secret["DATABASE_URL"].arn }]
    logConfiguration = {
      logDriver = "awslogs"
      options = {
        awslogs-group         = aws_cloudwatch_log_group.app["migrate"].name
        awslogs-region        = var.region
        awslogs-stream-prefix = "migrate"
      }
    }
  }])
}

resource "aws_ecs_service" "app" {
  for_each = local.services

  name            = each.key
  cluster         = aws_ecs_cluster.main.id
  task_definition = aws_ecs_task_definition.app[each.key].arn
  desired_count   = 1

  capacity_provider_strategy {
    capacity_provider = each.value.size.capacity_provider
    weight            = 1
  }

  network_configuration {
    subnets          = aws_subnet.public[*].id
    security_groups  = [each.key == "web" ? aws_security_group.web.id : (each.key == "worker" ? aws_security_group.worker.id : aws_security_group.agent.id)]
    assign_public_ip = true # no NAT gateway: outbound goes straight out
  }

  dynamic "load_balancer" {
    for_each = each.key == "web" ? [1] : []
    content {
      target_group_arn = aws_lb_target_group.web.arn
      container_name   = "web"
      container_port   = 3000
    }
  }

  health_check_grace_period_seconds = each.key == "web" ? 60 : null

  # Replace rather than run two copies: one agent per worker slot, one summarizer.
  deployment_minimum_healthy_percent = each.key == "web" ? 100 : 0
  deployment_maximum_percent         = each.key == "web" ? 200 : 100

  deployment_circuit_breaker {
    enable   = true
    rollback = true
  }

  depends_on = [aws_lb_listener.https, aws_ecs_cluster_capacity_providers.main]
}
