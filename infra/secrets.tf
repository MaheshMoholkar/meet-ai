# Secrets live in SSM Parameter Store (SecureString, free tier) and reach the
# tasks through ECS `secrets`, never as plain environment values in the task
# definition. They are also in the OpenTofu state: keep the state encrypted (see
# backend.tf.example).

resource "random_password" "better_auth" {
  length  = 48
  special = false
}

resource "random_password" "livekit" {
  length  = 48
  special = false
}

locals {
  ssm_prefix = "/${var.project}"

  secret_values = merge(
    {
      DATABASE_URL       = local.database_url
      BETTER_AUTH_SECRET = random_password.better_auth.result
      LIVEKIT_API_SECRET = random_password.livekit.result
    },
    var.github_oauth == null ? {} : { GITHUB_CLIENT_SECRET = var.github_oauth.client_secret },
    var.google_oauth == null ? {} : { GOOGLE_CLIENT_SECRET = var.google_oauth.client_secret },
  )
}

resource "aws_ssm_parameter" "secret" {
  for_each = nonsensitive(toset(keys(local.secret_values)))

  name  = "${local.ssm_prefix}/${each.key}"
  type  = "SecureString"
  value = local.secret_values[each.key]
}
