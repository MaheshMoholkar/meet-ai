# AWS deployment (OpenTofu)

Sub-project 4 of the [design](../docs/superpowers/specs/2026-10-03-meet-ai-rebuild-design.md). Region **ap-south-1 (Mumbai)**, everything on **arm64 / Graviton**.

```
                    ┌──────────────── VPC 10.40.0.0/16 (no NAT gateway) ───────────────┐
 Browser ── HTTPS ──▶ ALB (ACM cert) ──▶ ECS Fargate: web ──┐                         │
    │                                    ECS Fargate Spot: worker ◀── SQS (+ DLQ)     │
    │                                    ECS Fargate Spot: agent ──▶ Transcribe, Polly, Bedrock
    │                                         │  ▲ ws :7880 (private)                   │
    └── wss + WebRTC ──▶ EC2 t4g.medium (Elastic IP): Caddy · LiveKit · Egress · Redis │
                                              │ recordings                            │
                         S3 (private, expires after 30 days) ◀── transcripts (agent)   │
                         RDS Postgres 17 (private subnets, TLS verified)               │
                    └────────────────────────────────────────────────────────────────────┘
```

| Concern | Where |
|---|---|
| Web app, summarizer, voice agent | ECS Fargate, ARM64; images in ECR |
| LiveKit server, Egress, Redis | One EC2 instance, Docker Compose, host networking (WebRTC needs real ports) |
| TLS | ACM on the ALB for the app; Caddy + Let's Encrypt on the EC2 instance for `wss://` |
| Postgres | RDS, single-AZ, encrypted, 7-day backups, private subnets |
| Secrets | SSM Parameter Store (SecureString) → ECS `secrets`; the media server reads its one secret at boot |
| AI | Transcribe (en-IN), Polly neural (Kajal, en-IN), Bedrock Nova Lite through the `apac.` inference profile |
| Deploys | GitHub Actions with OIDC (no stored keys): build → push → migrate → roll out |

## Monthly cost (estimate, ap-south-1, on-demand list prices)

Check with the [AWS Pricing Calculator](https://calculator.aws/) before relying on these; they're rounded and AWS prices change.

| Item | Size | ≈ USD / month |
|---|---|---|
| Application Load Balancer | 1 ALB, low traffic | 19 |
| Public IPv4 addresses ($0.005/hour each) | ALB ×2, Elastic IP, 3 tasks | 22 |
| Fargate: web | 0.5 vCPU / 1 GB, on-demand | 14 |
| Fargate: agent | 0.5 vCPU / 1 GB, Spot | 5 |
| Fargate: worker | 0.25 vCPU / 0.5 GB, Spot | 2 |
| EC2 media server | t4g.medium + 30 GB gp3 | 19 |
| RDS Postgres | db.t4g.micro + 20 GB gp3 | 18 |
| CloudWatch Logs, S3, SQS, ECR, data transfer | demo traffic | 5 |
| **Infrastructure** | | **≈ 105** |
| AI usage, worst case | 30 call-minutes/day × 30 days ≈ $0.03/min (Transcribe + Polly + Nova Lite) | ≤ 30 |

That is slightly above the $100 target. Levers, biggest first:

- **Pause between demos.** ECS services to 0 tasks, stop the EC2 instance and the RDS instance (RDS restarts itself after 7 days). What's left — ALB, Elastic IP, storage — is about $30.
- **The web task on Spot** (`web.capacity_provider = "FARGATE_SPOT"`): −$10, at the cost of rare restarts.
- **Agent on on-demand** costs about +$10 but never cuts a call when AWS reclaims Spot capacity.

New AWS accounts usually come with sign-up credits; check what yours has.

## First deploy

### 0. Unverified until the first real deploy

The configuration validates and was applied end to end against the [moto](https://github.com/getmoto/moto) emulator, but these depend on real AWS behaviour:

1. **Egress → S3 with the instance role.** The app sends Egress an `S3Upload` with empty keys; Egress is expected to fall back to the EC2 instance role through IMDSv2 (hop limit 2 is set). Check `docker compose logs egress` on the media server after the first call.
2. **Egress reaching LiveKit's media through the Elastic IP** from the same instance (hairpin). If recordings come out silent or Egress never joins, add the private IP to LiveKit's advertised addresses.
3. **Polly `Kajal` neural with `en-IN`** and **Transcribe streaming `en-IN`** in ap-south-1.
4. **Bedrock `apac.amazon.nova-lite-v1:0`** from ap-south-1. If it returns `AccessDeniedException`, enable Nova in the Bedrock console (Model access).

### 1. Tools and credentials

```bash
brew install awscli opentofu
aws configure            # or: aws configure sso  — needs admin rights for the first apply
aws sts get-caller-identity
```

### 2. Configure

```bash
cd infra
cp terraform.tfvars.example terraform.tfvars   # set app_domain, rtc_domain, …
tofu init
```

Optional, recommended: remote state — see `backend.tf.example` (the state holds the database password and generated keys).

### 3. Certificate and image repositories first

```bash
tofu apply -target=aws_acm_certificate.app -target='aws_ecr_repository.app'
tofu output acm_validation_records    # without Route 53: add this CNAME at your DNS provider now
```

### 4. Images

```bash
./scripts/push-images.sh              # builds arm64 images locally (Docker Desktop) and pushes :latest
```

### 5. Everything else

```bash
tofu apply                            # waits for the certificate to validate (up to 60 min)
tofu output dns_records_to_create     # without Route 53: app → CNAME to the ALB, rtc → A to the Elastic IP
```

Caddy on the media server requests its certificate once `rtc_domain` resolves to the Elastic IP; until then browsers can't connect to calls.

### 6. Database, then the first real rollout

```bash
./scripts/run-migrations.sh
./scripts/redeploy.sh                 # fresh deployment of web, worker, agent; waits until stable
```

Expect the services' **first** deployment (from step 5) to show as failed: the web and worker tasks start before the database has tables, and ECS's deployment circuit breaker stops the rollout instead of retrying. `redeploy.sh` after the migrations is what brings them up. Later deploys run migrations first, so this only happens once.

### 7. GitHub Actions

Set `github_repository = "owner/repo"` in `terraform.tfvars`, `tofu apply`, then copy `tofu output deploy` into the repository's **Variables** (Settings → Secrets and variables → Actions → Variables) and create a `production` environment. The **Deploy** workflow (manual for now) builds the images on an arm64 runner, pushes them, runs migrations and rolls out the services.

GitHub's `ubuntu-24.04-arm` runners are free for **public** repositories. For a private repository, either use a paid larger runner or switch the job to `ubuntu-24.04` with `docker/setup-qemu-action` (emulated arm64 builds; the Python image gets slow).

### 8. Smoke test

Sign up → create an agent → start a meeting → talk for a minute → leave. Within a couple of minutes the meeting should show a transcript, a summary and a playable recording; Ask AI should answer about it.

## Operating it

```bash
aws logs tail /meet-ai/web --follow          # also: worker, agent, migrate
aws ssm start-session --target <instance-id> # shell on the media server (no SSH keys, no port 22)
#   sudo docker compose -f /opt/meetai/docker-compose.yml logs -f livekit egress caddy
```

- **Deploys:** the Deploy workflow, or `push-images.sh` + `run-migrations.sh` + `aws ecs update-service --force-new-deployment` per service.
- **Images are mutable `:latest`** (plus an immutable `:<git sha>` tag from CI). Simple, but a rollback means redeploying an older SHA by hand; pinning task definitions to the SHA is the next step if that matters.
- **Changing the media server's configuration** replaces the instance (`user_data_replace_on_change`): calls in progress drop, the Elastic IP stays.

## Tearing it down

```bash
tofu apply -var db_deletion_protection=false   # also allows deleting non-empty ECR repositories
tofu destroy
```

Empty the S3 bucket first if it still has objects.
