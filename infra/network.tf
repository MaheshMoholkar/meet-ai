# Two public subnets for the load balancer, Fargate tasks and the media server,
# and two private subnets for Postgres. There is deliberately no NAT gateway
# (~$32/month): tasks get public IPs for outbound calls and only accept
# traffic their security groups allow.

locals {
  azs = slice(data.aws_availability_zones.available.names, 0, 2)
}

resource "aws_vpc" "main" {
  cidr_block           = "10.40.0.0/16"
  enable_dns_support   = true
  enable_dns_hostnames = true

  tags = { Name = var.project }
}

resource "aws_internet_gateway" "main" {
  vpc_id = aws_vpc.main.id
  tags   = { Name = var.project }
}

resource "aws_subnet" "public" {
  count = length(local.azs)

  vpc_id                  = aws_vpc.main.id
  availability_zone       = local.azs[count.index]
  cidr_block              = cidrsubnet(aws_vpc.main.cidr_block, 8, count.index)
  map_public_ip_on_launch = true

  tags = { Name = "${var.project}-public-${local.azs[count.index]}" }
}

resource "aws_subnet" "private" {
  count = length(local.azs)

  vpc_id            = aws_vpc.main.id
  availability_zone = local.azs[count.index]
  cidr_block        = cidrsubnet(aws_vpc.main.cidr_block, 8, 100 + count.index)

  tags = { Name = "${var.project}-private-${local.azs[count.index]}" }
}

resource "aws_route_table" "public" {
  vpc_id = aws_vpc.main.id

  route {
    cidr_block = "0.0.0.0/0"
    gateway_id = aws_internet_gateway.main.id
  }

  tags = { Name = "${var.project}-public" }
}

resource "aws_route_table_association" "public" {
  count = length(aws_subnet.public)

  subnet_id      = aws_subnet.public[count.index].id
  route_table_id = aws_route_table.public.id
}

# Private subnets keep the VPC's default (local-only) route table: no internet.

# --- Security groups -------------------------------------------------------------

resource "aws_security_group" "alb" {
  name        = "${var.project}-alb"
  description = "Public HTTPS to the web app"
  vpc_id      = aws_vpc.main.id
}

resource "aws_vpc_security_group_ingress_rule" "alb_https" {
  security_group_id = aws_security_group.alb.id
  cidr_ipv4         = "0.0.0.0/0"
  ip_protocol       = "tcp"
  from_port         = 443
  to_port           = 443
}

resource "aws_vpc_security_group_ingress_rule" "alb_http" {
  security_group_id = aws_security_group.alb.id
  description       = "Redirected to HTTPS"
  cidr_ipv4         = "0.0.0.0/0"
  ip_protocol       = "tcp"
  from_port         = 80
  to_port           = 80
}

resource "aws_vpc_security_group_egress_rule" "alb_to_web" {
  security_group_id            = aws_security_group.alb.id
  referenced_security_group_id = aws_security_group.web.id
  ip_protocol                  = "tcp"
  from_port                    = 3000
  to_port                      = 3000
}

# App tasks: no inbound except the ALB → web. Outbound anywhere (AWS APIs, ECR, LiveKit).
resource "aws_security_group" "web" {
  name        = "${var.project}-web"
  description = "Next.js tasks"
  vpc_id      = aws_vpc.main.id
}

resource "aws_vpc_security_group_ingress_rule" "web_from_alb" {
  security_group_id            = aws_security_group.web.id
  referenced_security_group_id = aws_security_group.alb.id
  ip_protocol                  = "tcp"
  from_port                    = 3000
  to_port                      = 3000
}

resource "aws_security_group" "worker" {
  name        = "${var.project}-worker"
  description = "Summarizer worker and migration tasks"
  vpc_id      = aws_vpc.main.id
}

resource "aws_security_group" "agent" {
  name        = "${var.project}-agent"
  description = "Voice agent tasks"
  vpc_id      = aws_vpc.main.id
}

resource "aws_vpc_security_group_egress_rule" "all_out" {
  for_each = {
    web    = aws_security_group.web.id
    worker = aws_security_group.worker.id
    agent  = aws_security_group.agent.id
    media  = aws_security_group.media.id
  }

  security_group_id = each.value
  cidr_ipv4         = "0.0.0.0/0"
  ip_protocol       = "-1"
}

# Media server: WebRTC from anywhere, HTTPS (Caddy) for signaling, LiveKit's API
# only from inside the VPC (web for room management, agent for its connection).
resource "aws_security_group" "media" {
  name        = "${var.project}-media"
  description = "LiveKit, Egress, Redis, Caddy"
  vpc_id      = aws_vpc.main.id
}

resource "aws_vpc_security_group_ingress_rule" "media_public" {
  for_each = {
    https   = { protocol = "tcp", port = 443, description = "Caddy: wss signaling" }
    http    = { protocol = "tcp", port = 80, description = "Caddy: ACME HTTP-01 and redirect" }
    rtc_tcp = { protocol = "tcp", port = 7881, description = "WebRTC over TCP fallback" }
    rtc_udp = { protocol = "udp", port = 7882, description = "WebRTC media (UDP mux)" }
  }

  security_group_id = aws_security_group.media.id
  description       = each.value.description
  cidr_ipv4         = "0.0.0.0/0"
  ip_protocol       = each.value.protocol
  from_port         = each.value.port
  to_port           = each.value.port
}

resource "aws_vpc_security_group_ingress_rule" "media_api" {
  for_each = {
    web   = aws_security_group.web.id
    agent = aws_security_group.agent.id
  }

  security_group_id            = aws_security_group.media.id
  description                  = "LiveKit API/signaling from ${each.key}"
  referenced_security_group_id = each.value
  ip_protocol                  = "tcp"
  from_port                    = 7880
  to_port                      = 7880
}

resource "aws_security_group" "db" {
  name        = "${var.project}-db"
  description = "Postgres from the app tasks only"
  vpc_id      = aws_vpc.main.id
}

resource "aws_vpc_security_group_ingress_rule" "db_from_app" {
  for_each = {
    web    = aws_security_group.web.id
    worker = aws_security_group.worker.id
  }

  security_group_id            = aws_security_group.db.id
  description                  = "Postgres from ${each.key}"
  referenced_security_group_id = each.value
  ip_protocol                  = "tcp"
  from_port                    = 5432
  to_port                      = 5432
}
