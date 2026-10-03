# Postgres (RDS), S3 for recordings and transcripts, SQS for summarization jobs.

resource "random_password" "db" {
  length  = 32
  special = false
}

resource "aws_db_subnet_group" "main" {
  name       = var.project
  subnet_ids = aws_subnet.private[*].id
}

resource "aws_db_instance" "main" {
  identifier     = var.project
  engine         = "postgres"
  engine_version = "17"

  instance_class        = var.db_instance_class
  allocated_storage     = 20
  max_allocated_storage = 50
  storage_type          = "gp3"
  storage_encrypted     = true

  db_name  = "meetai"
  username = "meetai"
  password = random_password.db.result

  db_subnet_group_name   = aws_db_subnet_group.main.name
  vpc_security_group_ids = [aws_security_group.db.id]
  publicly_accessible    = false
  multi_az               = false

  backup_retention_period    = 7
  auto_minor_version_upgrade = true
  deletion_protection        = var.db_deletion_protection
  skip_final_snapshot        = !var.db_deletion_protection
  final_snapshot_identifier  = var.db_deletion_protection ? "${var.project}-final" : null
}

locals {
  # TLS with certificate verification against the RDS CA bundle baked into the images.
  database_url = format(
    "postgres://%s:%s@%s:%d/%s?sslmode=verify-full&sslrootcert=/app/certs/rds-ca.pem",
    aws_db_instance.main.username,
    random_password.db.result,
    aws_db_instance.main.address,
    aws_db_instance.main.port,
    aws_db_instance.main.db_name,
  )
}

# --- S3 -------------------------------------------------------------------------

resource "aws_s3_bucket" "media" {
  bucket_prefix = "${var.project}-media-"
}

resource "aws_s3_bucket_public_access_block" "media" {
  bucket = aws_s3_bucket.media.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_ownership_controls" "media" {
  bucket = aws_s3_bucket.media.id
  rule {
    object_ownership = "BucketOwnerEnforced"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "media" {
  bucket = aws_s3_bucket.media.id
  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

resource "aws_s3_bucket_lifecycle_configuration" "media" {
  bucket = aws_s3_bucket.media.id

  rule {
    id     = "expire-call-data"
    status = "Enabled"
    filter {}
    expiration {
      days = var.recording_retention_days
    }
    abort_incomplete_multipart_upload {
      days_after_initiation = 1
    }
  }
}

# --- SQS ------------------------------------------------------------------------

resource "aws_sqs_queue" "summarize_dlq" {
  name                      = "${var.project}-summarize-dlq"
  message_retention_seconds = 14 * 24 * 3600
}

resource "aws_sqs_queue" "summarize" {
  name                       = "${var.project}-summarize"
  visibility_timeout_seconds = 180
  receive_wait_time_seconds  = 20
  message_retention_seconds  = 4 * 24 * 3600

  redrive_policy = jsonencode({
    deadLetterTargetArn = aws_sqs_queue.summarize_dlq.arn
    maxReceiveCount     = 3
  })
}

# --- ECR ------------------------------------------------------------------------

resource "aws_ecr_repository" "app" {
  for_each = toset(["web", "worker", "agent"])

  name                 = "${var.project}/${each.key}"
  image_tag_mutability = "MUTABLE" # CI pushes `latest`; see README for the trade-off
  force_delete         = !var.db_deletion_protection

  image_scanning_configuration {
    scan_on_push = true
  }
}

resource "aws_ecr_lifecycle_policy" "app" {
  for_each   = aws_ecr_repository.app
  repository = each.value.name

  policy = jsonencode({
    rules = [{
      rulePriority = 1
      description  = "Keep the last 10 images"
      selection    = { tagStatus = "any", countType = "imageCountMoreThan", countNumber = 10 }
      action       = { type = "expire" }
    }]
  })
}
