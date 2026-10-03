locals {
  account_id = data.aws_caller_identity.current.account_id

  # Cross-region inference: the apac. profile in this region, plus the Nova
  # foundation models in every APAC destination region it may route to.
  bedrock_resources = [
    "arn:aws:bedrock:${var.region}:${local.account_id}:inference-profile/*",
    "arn:aws:bedrock:*::foundation-model/amazon.nova-*",
  ]
}

data "aws_iam_policy_document" "ecs_tasks_assume" {
  statement {
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["ecs-tasks.amazonaws.com"]
    }
  }
}

# --- Execution role: pull images, write logs, read the SSM secrets -------------

resource "aws_iam_role" "execution" {
  name               = "${var.project}-ecs-execution"
  assume_role_policy = data.aws_iam_policy_document.ecs_tasks_assume.json
}

resource "aws_iam_role_policy_attachment" "execution" {
  role       = aws_iam_role.execution.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy"
}

resource "aws_iam_role_policy" "execution_secrets" {
  name = "read-secrets"
  role = aws_iam_role.execution.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect   = "Allow"
      Action   = ["ssm:GetParameters"]
      Resource = [for p in aws_ssm_parameter.secret : p.arn]
    }]
  })
}

# --- Task roles: what each service's code may call ------------------------------

resource "aws_iam_role" "task" {
  for_each = toset(["web", "worker", "agent"])

  name               = "${var.project}-${each.key}"
  assume_role_policy = data.aws_iam_policy_document.ecs_tasks_assume.json
}

locals {
  bedrock_statement = {
    Effect   = "Allow"
    Action   = ["bedrock:InvokeModel", "bedrock:InvokeModelWithResponseStream", "bedrock:Converse", "bedrock:ConverseStream"]
    Resource = local.bedrock_resources
  }

  task_policies = {
    # Presigned recording links and Ask AI.
    web = [
      { Effect = "Allow", Action = ["s3:GetObject"], Resource = ["${aws_s3_bucket.media.arn}/recordings/*"] },
      local.bedrock_statement,
    ]
    # Read transcripts, consume jobs, summarize.
    worker = [
      { Effect = "Allow", Action = ["s3:GetObject"], Resource = ["${aws_s3_bucket.media.arn}/transcripts/*"] },
      {
        Effect   = "Allow"
        Action   = ["sqs:ReceiveMessage", "sqs:DeleteMessage", "sqs:ChangeMessageVisibility", "sqs:GetQueueAttributes"]
        Resource = [aws_sqs_queue.summarize.arn]
      },
      local.bedrock_statement,
    ]
    # Speech in and out, the LLM, and the transcript hand-off.
    agent = [
      { Effect = "Allow", Action = ["transcribe:StartStreamTranscription", "transcribe:StartStreamTranscriptionWebSocket"], Resource = ["*"] },
      { Effect = "Allow", Action = ["polly:SynthesizeSpeech"], Resource = ["*"] },
      local.bedrock_statement,
      { Effect = "Allow", Action = ["s3:PutObject"], Resource = ["${aws_s3_bucket.media.arn}/transcripts/*"] },
      { Effect = "Allow", Action = ["sqs:SendMessage"], Resource = [aws_sqs_queue.summarize.arn] },
    ]
  }
}

resource "aws_iam_role_policy" "task" {
  for_each = local.task_policies

  name   = "app"
  role   = aws_iam_role.task[each.key].id
  policy = jsonencode({ Version = "2012-10-17", Statement = each.value })
}

# --- Media server (EC2): Egress uploads recordings; SSM for shell access ------

data "aws_iam_policy_document" "ec2_assume" {
  statement {
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["ec2.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "media" {
  name               = "${var.project}-media"
  assume_role_policy = data.aws_iam_policy_document.ec2_assume.json
}

resource "aws_iam_role_policy_attachment" "media_ssm" {
  role       = aws_iam_role.media.name
  policy_arn = "arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore"
}

resource "aws_iam_role_policy" "media" {
  name = "media"
  role = aws_iam_role.media.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect   = "Allow"
        Action   = ["s3:PutObject", "s3:AbortMultipartUpload"]
        Resource = ["${aws_s3_bucket.media.arn}/recordings/*"]
      },
      {
        # The LiveKit secret is read from SSM at boot instead of living in user data.
        Effect   = "Allow"
        Action   = ["ssm:GetParameter"]
        Resource = [aws_ssm_parameter.secret["LIVEKIT_API_SECRET"].arn]
      },
    ]
  })
}

resource "aws_iam_instance_profile" "media" {
  name = "${var.project}-media"
  role = aws_iam_role.media.name
}

# --- GitHub Actions deploy role (OIDC, no stored AWS keys) ----------------------

resource "aws_iam_openid_connect_provider" "github" {
  count = var.github_repository != null && var.create_github_oidc_provider ? 1 : 0

  url            = "https://token.actions.githubusercontent.com"
  client_id_list = ["sts.amazonaws.com"]
}

locals {
  github_oidc_arn = var.github_repository == null ? null : (
    var.create_github_oidc_provider
    ? aws_iam_openid_connect_provider.github[0].arn
    : "arn:aws:iam::${local.account_id}:oidc-provider/token.actions.githubusercontent.com"
  )
}

resource "aws_iam_role" "deploy" {
  count = var.github_repository == null ? 0 : 1

  name = "${var.project}-github-deploy"
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Federated = local.github_oidc_arn }
      Action    = "sts:AssumeRoleWithWebIdentity"
      Condition = {
        StringEquals = { "token.actions.githubusercontent.com:aud" = "sts.amazonaws.com" }
        # Jobs that use a GitHub environment get an environment-scoped subject.
        StringLike = { "token.actions.githubusercontent.com:sub" = [
          "repo:${var.github_repository}:ref:refs/heads/main",
          "repo:${var.github_repository}:environment:production",
        ] }
      }
    }]
  })
}

resource "aws_iam_role_policy" "deploy" {
  count = var.github_repository == null ? 0 : 1

  name = "deploy"
  role = aws_iam_role.deploy[0].id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      { Effect = "Allow", Action = ["ecr:GetAuthorizationToken"], Resource = ["*"] },
      {
        Effect = "Allow"
        Action = [
          "ecr:BatchCheckLayerAvailability", "ecr:BatchGetImage", "ecr:CompleteLayerUpload",
          "ecr:InitiateLayerUpload", "ecr:PutImage", "ecr:UploadLayerPart",
        ]
        Resource = [for r in aws_ecr_repository.app : r.arn]
      },
      {
        Effect    = "Allow"
        Action    = ["ecs:UpdateService", "ecs:DescribeServices", "ecs:RunTask", "ecs:DescribeTasks"]
        Resource  = ["*"]
        Condition = { ArnEquals = { "ecs:cluster" = aws_ecs_cluster.main.arn } }
      },
      {
        Effect   = "Allow"
        Action   = ["iam:PassRole"]
        Resource = concat([aws_iam_role.execution.arn], [for r in aws_iam_role.task : r.arn])
      },
    ]
  })
}
