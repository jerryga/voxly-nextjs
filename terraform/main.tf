locals {
  base_tags = merge(
    {
      Project     = var.project_name
      Environment = var.environment_name
      ManagedBy   = "Terraform"
    },
    var.tags,
  )

  resolved_vpc_id             = var.create_network ? aws_vpc.voxly[0].id : var.vpc_id
  resolved_public_subnet_ids  = var.create_network ? aws_subnet.public[*].id : var.public_subnet_ids
  resolved_private_subnet_ids = var.create_network ? aws_subnet.private[*].id : var.private_subnet_ids
  resolved_beanstalk_service_role_arn = var.create_beanstalk_iam_roles ? aws_iam_role.beanstalk_service[0].arn : var.elastic_beanstalk_service_role_arn
  resolved_beanstalk_instance_profile = var.create_beanstalk_iam_roles ? aws_iam_instance_profile.beanstalk_ec2[0].name : var.elastic_beanstalk_ec2_instance_profile
  has_beanstalk_https_certificate = trimspace(var.beanstalk_https_certificate_arn) != ""
  use_private_subnets         = length(local.resolved_private_subnet_ids) > 0
  use_public_subnets          = length(local.resolved_public_subnet_ids) > 0
  create_zone_lookup          = var.create_dns || var.create_acm_certificate
}

resource "aws_security_group" "app_load_balancer" {
  name        = "${var.project_name}-${var.environment_name}-alb"
  description = "Application load balancer access for Voxly"
  vpc_id      = local.resolved_vpc_id

  ingress {
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  ingress {
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = merge(local.base_tags, {
    Name = "${var.project_name}-${var.environment_name}-alb"
    Role = "app-load-balancer"
  })
}

resource "aws_security_group" "app_instances" {
  name        = "${var.project_name}-${var.environment_name}-app"
  description = "Application instance access for Voxly"
  vpc_id      = local.resolved_vpc_id

  ingress {
    from_port       = 80
    to_port         = 80
    protocol        = "tcp"
    security_groups = [aws_security_group.app_load_balancer.id]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = merge(local.base_tags, {
    Name = "${var.project_name}-${var.environment_name}-app"
    Role = "app-instances"
  })
}

data "aws_route53_zone" "selected" {
  count        = local.create_zone_lookup && var.route53_zone_name != "" ? 1 : 0
  name         = var.route53_zone_name
  private_zone = false
}

resource "aws_s3_bucket" "uploads" {
  bucket = var.uploads_bucket_name

  tags = merge(
    local.base_tags,
    {
      Name = var.uploads_bucket_name
      Role = "uploads"
    },
  )
}

resource "aws_s3_bucket_versioning" "uploads" {
  bucket = aws_s3_bucket.uploads.id

  versioning_configuration {
    status = "Disabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "uploads" {
  bucket = aws_s3_bucket.uploads.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

resource "aws_s3_bucket_public_access_block" "uploads" {
  bucket = aws_s3_bucket.uploads.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket" "deploy_artifacts" {
  bucket = var.deploy_bucket_name

  tags = merge(
    local.base_tags,
    {
      Name = var.deploy_bucket_name
      Role = "deploy-artifacts"
    },
  )
}

resource "aws_s3_bucket_versioning" "deploy_artifacts" {
  bucket = aws_s3_bucket.deploy_artifacts.id

  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "deploy_artifacts" {
  bucket = aws_s3_bucket.deploy_artifacts.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

resource "aws_s3_bucket_public_access_block" "deploy_artifacts" {
  bucket = aws_s3_bucket.deploy_artifacts.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_secretsmanager_secret" "app" {
  count = var.create_secrets_manager_secret ? 1 : 0

  name = var.secrets_manager_secret_name
  tags = local.base_tags
}

resource "aws_secretsmanager_secret_version" "app" {
  count = var.create_secrets_manager_secret ? 1 : 0

  secret_id     = aws_secretsmanager_secret.app[0].id
  secret_string = jsonencode(var.secrets_manager_values)
}

resource "aws_db_subnet_group" "voxly" {
  count = var.create_rds ? 1 : 0

  name       = "${var.project_name}-${var.environment_name}-db-subnets"
  subnet_ids = local.resolved_private_subnet_ids

  tags = merge(local.base_tags, { Name = "${var.project_name}-${var.environment_name}-db-subnets" })
}

resource "aws_security_group" "rds" {
  count = var.create_rds ? 1 : 0

  name        = "${var.project_name}-${var.environment_name}-rds"
  description = "Database access for Voxly"
  vpc_id      = local.resolved_vpc_id

  ingress {
    from_port       = 5432
    to_port         = 5432
    protocol        = "tcp"
    security_groups = [aws_security_group.app_instances.id]
  }

  dynamic "ingress" {
    for_each = var.allowed_app_cidr_blocks
    content {
      from_port   = 5432
      to_port     = 5432
      protocol    = "tcp"
      cidr_blocks = [ingress.value]
    }
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = local.base_tags
}

resource "aws_db_instance" "voxly" {
  count = var.create_rds ? 1 : 0

  identifier                  = var.db_identifier
  db_name                     = var.db_name
  engine                      = "postgres"
  engine_version              = var.db_engine_version
  instance_class              = var.db_instance_class
  allocated_storage           = var.db_allocated_storage
  username                    = var.db_username
  password                    = var.db_password
  db_subnet_group_name        = aws_db_subnet_group.voxly[0].name
  vpc_security_group_ids      = [aws_security_group.rds[0].id]
  storage_encrypted           = true
  skip_final_snapshot         = var.db_skip_final_snapshot
  deletion_protection         = !var.db_skip_final_snapshot
  multi_az                    = var.db_multi_az
  publicly_accessible         = false
  backup_retention_period     = 7
  auto_minor_version_upgrade  = true
  apply_immediately           = true

  tags = local.base_tags
}

resource "aws_security_group" "redis" {
  count = var.create_elasticache ? 1 : 0

  name        = "${var.project_name}-${var.environment_name}-redis"
  description = "Redis access for Voxly"
  vpc_id      = local.resolved_vpc_id

  ingress {
    from_port       = 6379
    to_port         = 6379
    protocol        = "tcp"
    security_groups = [aws_security_group.app_instances.id]
  }

  dynamic "ingress" {
    for_each = var.allowed_app_cidr_blocks
    content {
      from_port   = 6379
      to_port     = 6379
      protocol    = "tcp"
      cidr_blocks = [ingress.value]
    }
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = local.base_tags
}

resource "aws_elasticache_serverless_cache" "voxly" {
  count = var.create_elasticache ? 1 : 0

  name                  = var.elasticache_serverless_name
  engine                = "redis"
  major_engine_version  = "7"
  subnet_ids            = local.resolved_private_subnet_ids
  security_group_ids    = [aws_security_group.redis[0].id]

  cache_usage_limits {
    data_storage {
      maximum = 2
      unit    = "GB"
    }

    ecpu_per_second {
      maximum = 1000
    }
  }

  tags = local.base_tags
}

resource "aws_acm_certificate" "app" {
  count = var.create_acm_certificate ? 1 : 0

  domain_name       = var.app_domain_name
  validation_method = "DNS"

  tags = local.base_tags

  lifecycle {
    create_before_destroy = true
  }
}

resource "aws_route53_record" "acm_validation" {
  for_each = var.create_acm_certificate && length(data.aws_route53_zone.selected) > 0 ? {
    for dvo in aws_acm_certificate.app[0].domain_validation_options : dvo.domain_name => {
      name   = dvo.resource_record_name
      record = dvo.resource_record_value
      type   = dvo.resource_record_type
    }
  } : {}

  zone_id = data.aws_route53_zone.selected[0].zone_id
  name    = each.value.name
  type    = each.value.type
  ttl     = 60
  records = [each.value.record]
}

resource "aws_acm_certificate_validation" "app" {
  count = var.create_acm_certificate && length(data.aws_route53_zone.selected) > 0 ? 1 : 0

  certificate_arn         = aws_acm_certificate.app[0].arn
  validation_record_fqdns = [for record in aws_route53_record.acm_validation : record.fqdn]
}

resource "aws_elastic_beanstalk_application" "voxly" {
  name        = var.elastic_beanstalk_application_name
  description = "Voxly Next.js application"

  tags = local.base_tags
}

resource "aws_elastic_beanstalk_environment" "voxly" {
  name                = var.elastic_beanstalk_environment_name
  application         = aws_elastic_beanstalk_application.voxly.name
  solution_stack_name = var.solution_stack_name

  setting {
    namespace = "aws:elasticbeanstalk:environment"
    name      = "ServiceRole"
    value     = local.resolved_beanstalk_service_role_arn
  }

  setting {
    namespace = "aws:autoscaling:launchconfiguration"
    name      = "IamInstanceProfile"
    value     = local.resolved_beanstalk_instance_profile
  }

  setting {
    namespace = "aws:autoscaling:launchconfiguration"
    name      = "InstanceType"
    value     = var.instance_type
  }

  setting {
    namespace = "aws:autoscaling:launchconfiguration"
    name      = "SecurityGroups"
    value     = aws_security_group.app_instances.id
  }

  setting {
    namespace = "aws:elbv2:loadbalancer"
    name      = "SecurityGroups"
    value     = aws_security_group.app_load_balancer.id
  }

  setting {
    namespace = "aws:elasticbeanstalk:environment"
    name      = "LoadBalancerType"
    value     = "application"
  }

  dynamic "setting" {
    for_each = local.use_private_subnets ? [1] : []

    content {
      namespace = "aws:ec2:vpc"
      name      = "VPCId"
      value     = local.resolved_vpc_id
    }
  }

  dynamic "setting" {
    for_each = local.use_private_subnets ? [1] : []

    content {
      namespace = "aws:ec2:vpc"
      name      = "Subnets"
      value     = join(",", local.resolved_private_subnet_ids)
    }
  }

  dynamic "setting" {
    for_each = local.use_public_subnets ? [1] : []

    content {
      namespace = "aws:ec2:vpc"
      name      = "ELBSubnets"
      value     = join(",", local.resolved_public_subnet_ids)
    }
  }

  dynamic "setting" {
    for_each = local.has_beanstalk_https_certificate ? [1] : []

    content {
      namespace = "aws:elbv2:listener:443"
      name      = "ListenerEnabled"
      value     = "true"
    }
  }

  dynamic "setting" {
    for_each = local.has_beanstalk_https_certificate ? [1] : []

    content {
      namespace = "aws:elbv2:listener:443"
      name      = "Protocol"
      value     = "HTTPS"
    }
  }

  dynamic "setting" {
    for_each = local.has_beanstalk_https_certificate ? [1] : []

    content {
      namespace = "aws:elbv2:listener:443"
      name      = "SSLCertificateArns"
      value     = var.beanstalk_https_certificate_arn
    }
  }

  setting {
    namespace = "aws:elasticbeanstalk:application:environment"
    name      = "S3_BUCKET"
    value     = aws_s3_bucket.uploads.bucket
  }

  dynamic "setting" {
    for_each = var.create_rds ? [1] : []

    content {
      namespace = "aws:elasticbeanstalk:application:environment"
      name      = "RDS_HOSTNAME"
      value     = aws_db_instance.voxly[0].address
    }
  }

  dynamic "setting" {
    for_each = var.create_elasticache ? [1] : []

    content {
      namespace = "aws:elasticbeanstalk:application:environment"
      name      = "REDIS_HOST"
      value     = aws_elasticache_serverless_cache.voxly[0].endpoint[0].address
    }
  }

  dynamic "setting" {
    for_each = var.create_elasticache ? [1] : []

    content {
      namespace = "aws:elasticbeanstalk:application:environment"
      name      = "REDIS_PORT"
      value     = tostring(aws_elasticache_serverless_cache.voxly[0].endpoint[0].port)
    }
  }

  dynamic "setting" {
    for_each = var.app_environment

    content {
      namespace = "aws:elasticbeanstalk:application:environment"
      name      = setting.key
      value     = setting.value
    }
  }

  tags = local.base_tags

  depends_on = [aws_acm_certificate.app]
}

resource "aws_route53_record" "app_cname" {
  count = var.create_dns && length(data.aws_route53_zone.selected) > 0 && var.app_domain_name != "" ? 1 : 0

  zone_id = data.aws_route53_zone.selected[0].zone_id
  name    = var.app_domain_name
  type    = "CNAME"
  ttl     = 300
  records = [aws_elastic_beanstalk_environment.voxly.cname]
}
