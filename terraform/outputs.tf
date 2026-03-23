output "uploads_bucket_name" {
  description = "S3 bucket used for Voxly uploads."
  value       = aws_s3_bucket.uploads.bucket
}

output "deploy_bucket_name" {
  description = "S3 bucket used for Elastic Beanstalk deployment artifacts."
  value       = aws_s3_bucket.deploy_artifacts.bucket
}

output "vpc_id" {
  description = "Effective VPC ID used by the stack."
  value       = local.resolved_vpc_id
}

output "public_subnet_ids" {
  description = "Effective public subnet IDs used by the stack."
  value       = local.resolved_public_subnet_ids
}

output "private_subnet_ids" {
  description = "Effective private subnet IDs used by the stack."
  value       = local.resolved_private_subnet_ids
}

output "elastic_beanstalk_service_role_arn" {
  description = "Elastic Beanstalk service role ARN in use."
  value       = local.resolved_beanstalk_service_role_arn
}

output "elastic_beanstalk_ec2_instance_profile" {
  description = "Elastic Beanstalk EC2 instance profile in use."
  value       = local.resolved_beanstalk_instance_profile
}

output "github_actions_role_arn" {
  description = "IAM role ARN for GitHub Actions deploys."
  value       = var.create_github_actions_oidc_role ? aws_iam_role.github_actions_deploy[0].arn : null
}

output "elastic_beanstalk_application_name" {
  description = "Elastic Beanstalk application name."
  value       = aws_elastic_beanstalk_application.voxly.name
}

output "elastic_beanstalk_environment_name" {
  description = "Elastic Beanstalk environment name."
  value       = aws_elastic_beanstalk_environment.voxly.name
}

output "elastic_beanstalk_environment_endpoint" {
  description = "Elastic Beanstalk environment endpoint URL."
  value       = aws_elastic_beanstalk_environment.voxly.endpoint_url
}

output "elastic_beanstalk_environment_cname" {
  description = "Elastic Beanstalk environment CNAME."
  value       = aws_elastic_beanstalk_environment.voxly.cname
}

output "secrets_manager_secret_arn" {
  description = "Secrets Manager secret ARN when enabled."
  value       = var.create_secrets_manager_secret ? aws_secretsmanager_secret.app[0].arn : null
}

output "rds_endpoint" {
  description = "RDS PostgreSQL endpoint when enabled."
  value       = var.create_rds ? aws_db_instance.voxly[0].address : null
}

output "redis_endpoint" {
  description = "ElastiCache Redis endpoint when enabled."
  value       = var.create_elasticache ? aws_elasticache_serverless_cache.voxly[0].endpoint[0].address : null
}

output "acm_certificate_arn" {
  description = "ACM certificate ARN when enabled."
  value       = var.create_acm_certificate ? aws_acm_certificate.app[0].arn : null
}

output "acm_domain_validation_records" {
  description = "DNS validation records to add in Cloudflare or another DNS provider when ACM is enabled."
  value = var.create_acm_certificate ? [
    for dvo in aws_acm_certificate.app[0].domain_validation_options : {
      domain_name = dvo.domain_name
      name        = dvo.resource_record_name
      type        = dvo.resource_record_type
      value       = dvo.resource_record_value
    }
  ] : []
}
