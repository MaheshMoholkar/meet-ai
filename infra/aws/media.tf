# One Graviton instance runs LiveKit, Egress, Redis and Caddy with Docker
# Compose (host networking: WebRTC needs real ports). Caddy gets a Let's
# Encrypt certificate for rtc_domain, so browsers connect over wss://.

data "aws_ssm_parameter" "al2023_arm64" {
  name = "/aws/service/ami-amazon-linux-latest/al2023-ami-kernel-default-arm64"
}

resource "aws_eip" "media" {
  domain = "vpc"
  tags   = { Name = "${var.project}-media" }
}

locals {
  livekit_config = templatefile("${path.module}/templates/livekit.yaml.tftpl", {
    node_ip     = aws_eip.media.public_ip
    api_key     = var.livekit_api_key
    webhook_url = "https://${var.app_domain}/api/webhooks/livekit"
  })

  egress_config = templatefile("${path.module}/templates/egress.yaml.tftpl", {
    api_key = var.livekit_api_key
  })

  media_user_data = templatefile("${path.module}/templates/media-user-data.sh.tftpl", {
    region               = var.region
    livekit_secret_param = aws_ssm_parameter.secret["LIVEKIT_API_SECRET"].name
    compose = templatefile("${path.module}/templates/media-compose.yml.tftpl", {
      region         = var.region
      livekit_image  = "livekit/livekit-server:v1.13.7"
      egress_image   = "livekit/egress:v1.14.1"
      livekit_config = indent(8, local.livekit_config)
      egress_config  = indent(8, local.egress_config)
    })
    caddyfile = templatefile("${path.module}/templates/Caddyfile.tftpl", {
      rtc_domain = var.rtc_domain
    })
  })
}

resource "aws_instance" "media" {
  ami                    = data.aws_ssm_parameter.al2023_arm64.value
  instance_type          = var.media_instance_type
  subnet_id              = aws_subnet.public[0].id
  vpc_security_group_ids = [aws_security_group.media.id]
  iam_instance_profile   = aws_iam_instance_profile.media.name

  user_data                   = local.media_user_data
  user_data_replace_on_change = true

  metadata_options {
    http_tokens                 = "required"
    http_put_response_hop_limit = 2 # containers reach the instance role through IMDSv2
  }

  root_block_device {
    volume_type = "gp3"
    volume_size = 30 # the Egress image alone is ~1.5 GB
    encrypted   = true
  }

  lifecycle {
    # A newer AMI shouldn't replace a running media server; roll it deliberately.
    ignore_changes = [ami]
  }

  tags = { Name = "${var.project}-media" }
}

resource "aws_eip_association" "media" {
  instance_id   = aws_instance.media.id
  allocation_id = aws_eip.media.id
}
