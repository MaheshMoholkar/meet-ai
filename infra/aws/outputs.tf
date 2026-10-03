output "dns_records_to_create" {
  description = "Create these at your DNS provider when not using Route 53 (the certificate validation record first: see README)."
  value = var.route53_zone_id != null ? {} : merge(
    { for k, r in local.acm_validation_records : "acm-validation (${k})" => r },
    {
      app = { name = var.app_domain, type = "CNAME", value = aws_lb.web.dns_name }
      rtc = { name = var.rtc_domain, type = "A", value = aws_eip.media.public_ip }
    },
  )
}

output "app_url" {
  value = "https://${var.app_domain}"
}

output "ecr_repositories" {
  value = { for k, r in aws_ecr_repository.app : k => r.repository_url }
}

output "deploy" {
  description = "Values the GitHub Actions deploy workflow needs (repository variables)."
  value = {
    AWS_REGION        = var.region
    AWS_DEPLOY_ROLE   = var.github_repository == null ? null : aws_iam_role.deploy[0].arn
    ECS_CLUSTER       = aws_ecs_cluster.main.name
    ECR_REGISTRY      = split("/", aws_ecr_repository.app["web"].repository_url)[0]
    ECR_PREFIX        = var.project
    APP_URL           = "https://${var.app_domain}"
    MIGRATE_TASK_DEF  = aws_ecs_task_definition.migrate.family
    TASK_SUBNETS      = join(",", aws_subnet.public[*].id)
    TASK_SECURITY_GRP = aws_security_group.worker.id
  }
}

output "media_server" {
  value = {
    instance_id = aws_instance.media.id
    public_ip   = aws_eip.media.public_ip
    shell       = "aws ssm start-session --target ${aws_instance.media.id} --region ${var.region}"
  }
}

output "s3_bucket" {
  value = aws_s3_bucket.media.bucket
}

output "acm_validation_records" {
  description = "Create these first when not using Route 53: the certificate must validate before the load balancer's HTTPS listener can be created."
  value       = local.acm_validation_records
}
