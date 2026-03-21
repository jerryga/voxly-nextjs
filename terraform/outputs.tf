output "uploads_bucket_name" {
  description = "S3 bucket used for Voxly uploads."
  value       = aws_s3_bucket.uploads.bucket
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
  value       = var.create_acm_certificate && length(aws_acm_certificate_validation.app) > 0 ? aws_acm_certificate_validation.app[0].certificate_arn : null
}
