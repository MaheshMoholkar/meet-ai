variable "project" {
  description = "Name prefix for every resource."
  type        = string
  default     = "meet-ai"
}

variable "region" {
  description = "AWS region. ap-south-1 (Mumbai): Polly is neural-only there and Bedrock Nova runs through the apac. inference profile."
  type        = string
  default     = "ap-south-1"
}

# --- Domains -----------------------------------------------------------------

variable "app_domain" {
  description = "Public hostname of the web app, e.g. meetai.example.com."
  type        = string
}

variable "rtc_domain" {
  description = "Public hostname of the LiveKit server (browsers connect over wss), e.g. rtc.meetai.example.com."
  type        = string
}

variable "route53_zone_id" {
  description = "Route 53 hosted zone for the domains. Leave null to create the DNS records by hand at your DNS provider (see outputs)."
  type        = string
  default     = null
}

# --- Sizing (see README for the monthly cost of these defaults) ---------------

variable "db_instance_class" {
  type    = string
  default = "db.t4g.micro"
}

variable "db_deletion_protection" {
  description = "Keep on for a real deployment; turn off before `tofu destroy`."
  type        = bool
  default     = true
}

variable "media_instance_type" {
  description = "EC2 instance for LiveKit, Egress and Redis (Graviton). Egress renders in headless Chrome: 4 GB is the floor."
  type        = string
  default     = "t4g.medium"
}

variable "web" {
  description = "Fargate size and capacity for the Next.js app."
  type = object({
    cpu               = number
    memory            = number
    capacity_provider = string
  })
  default = { cpu = 512, memory = 1024, capacity_provider = "FARGATE" }
}

variable "worker" {
  description = "Fargate size and capacity for the summarizer worker. Spot is fine: SQS redelivers interrupted work."
  type = object({
    cpu               = number
    memory            = number
    capacity_provider = string
  })
  default = { cpu = 256, memory = 512, capacity_provider = "FARGATE_SPOT" }
}

variable "agent" {
  description = "Fargate size and capacity for the voice agent. Spot can cut a live call when AWS reclaims capacity (rare, 2-minute notice); use FARGATE to avoid that."
  type = object({
    cpu               = number
    memory            = number
    capacity_provider = string
  })
  default = { cpu = 512, memory = 1024, capacity_provider = "FARGATE_SPOT" }
}

variable "image_tag" {
  description = "Tag of the web, worker and agent images in ECR. CI pushes `latest` and forces a new deployment."
  type        = string
  default     = "latest"
}

# --- App settings -------------------------------------------------------------

variable "daily_budget_minutes" {
  description = "Global call-minute budget per UTC day (spec §5.1)."
  type        = number
  default     = 30
}

variable "recording_retention_days" {
  description = "Recordings and transcripts in S3 are deleted after this many days."
  type        = number
  default     = 30
}

variable "livekit_api_key" {
  description = "LiveKit API key name (not secret; the secret is generated)."
  type        = string
  default     = "meetai"
}

variable "llm_model" {
  description = "Bedrock model for summaries, Ask AI and the voice agent. In ap-south-1, Nova needs the apac. inference profile id."
  type        = string
  default     = "apac.amazon.nova-lite-v1:0"
}

variable "llm_max_input_tokens" {
  description = "Transcript chunk size for map-reduce summaries."
  type        = number
  default     = 20000
}

variable "speech" {
  description = "Transcribe and Polly settings for the agent. Kajal is Polly's Indian-English neural voice."
  type = object({
    stt_language = string
    tts_voice    = string
    tts_engine   = string
    tts_language = string
  })
  default = { stt_language = "en-IN", tts_voice = "Kajal", tts_engine = "neural", tts_language = "en-IN" }
}

variable "github_oauth" {
  description = "Optional GitHub sign-in. Leave null to hide the button."
  type = object({
    client_id     = string
    client_secret = string
  })
  default   = null
  sensitive = true
}

variable "google_oauth" {
  description = "Optional Google sign-in. Leave null to hide the button."
  type = object({
    client_id     = string
    client_secret = string
  })
  default   = null
  sensitive = true
}

# --- CI/CD ----------------------------------------------------------------------

variable "github_repository" {
  description = "owner/repo allowed to deploy through GitHub Actions OIDC. Leave null to skip the deploy role."
  type        = string
  default     = null
}

variable "create_github_oidc_provider" {
  description = "Create the GitHub Actions OIDC provider. Set false if the account already has one."
  type        = bool
  default     = true
}
