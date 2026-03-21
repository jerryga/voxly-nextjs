variable "aws_region" {
  description = "AWS region for Voxly infrastructure."
  type        = string
  default     = "ca-central-1"
}

variable "project_name" {
  description = "Project name used in resource naming."
  type        = string
  default     = "voxly"
}

variable "environment_name" {
  description = "Deployment environment name."
  type        = string
  default     = "staging"
}

variable "elastic_beanstalk_application_name" {
  description = "Elastic Beanstalk application name."
  type        = string
  default     = "voxly"
}

variable "elastic_beanstalk_environment_name" {
  description = "Elastic Beanstalk environment name."
  type        = string
  default     = "voxly-staging"
}

variable "solution_stack_name" {
  description = "Elastic Beanstalk solution stack for the Node.js app."
  type        = string
  default     = "64bit Amazon Linux 2023 v6.6.2 running Node.js 22"
}

variable "elastic_beanstalk_service_role_arn" {
  description = "Existing Elastic Beanstalk service role ARN."
  type        = string
}

variable "elastic_beanstalk_ec2_instance_profile" {
  description = "Existing EC2 instance profile name for Elastic Beanstalk instances."
  type        = string
}

variable "instance_type" {
  description = "EC2 instance type used by Elastic Beanstalk."
  type        = string
  default     = "t3.small"
}

variable "create_network" {
  description = "Whether to create a dedicated VPC, subnets, route tables, and a NAT gateway for Voxly."
  type        = bool
  default     = false
}

variable "vpc_cidr_block" {
  description = "CIDR block for the dedicated Voxly VPC when create_network is enabled."
  type        = string
  default     = "10.0.0.0/16"
}

variable "availability_zones" {
  description = "Availability zones used for the dedicated Voxly network."
  type        = list(string)
  default     = []
}

variable "public_subnet_cidr_blocks" {
  description = "CIDR blocks for public subnets when create_network is enabled."
  type        = list(string)
  default     = []
}

variable "private_subnet_cidr_blocks" {
  description = "CIDR blocks for private subnets when create_network is enabled."
  type        = list(string)
  default     = []
}

variable "vpc_id" {
  description = "Existing VPC ID used for AWS resources when create_network is disabled."
  type        = string
  default     = ""
}

variable "public_subnet_ids" {
  description = "Public subnet IDs for load balancers or internet-facing resources when create_network is disabled."
  type        = list(string)
  default     = []
}

variable "private_subnet_ids" {
  description = "Private subnet IDs for internal resources such as RDS and Redis when create_network is disabled."
  type        = list(string)
  default     = []
}

variable "allowed_app_cidr_blocks" {
  description = "CIDR blocks allowed to access database and cache resources."
  type        = list(string)
  default     = []
}

variable "uploads_bucket_name" {
  description = "S3 bucket name for Voxly uploads."
  type        = string
}

variable "app_environment" {
  description = "Application environment variables passed to Elastic Beanstalk."
  type        = map(string)
  default     = {}
  sensitive   = true
}

variable "tags" {
  description = "Additional tags applied to resources."
  type        = map(string)
  default     = {}
}

variable "create_secrets_manager_secret" {
  description = "Whether to create a Secrets Manager secret for Voxly app configuration."
  type        = bool
  default     = false
}

variable "secrets_manager_secret_name" {
  description = "Name of the Secrets Manager secret used for Voxly."
  type        = string
  default     = "voxly/app"
}

variable "secrets_manager_values" {
  description = "Key/value payload stored as JSON in Secrets Manager."
  type        = map(string)
  default     = {}
  sensitive   = true
}

variable "create_rds" {
  description = "Whether to create an RDS PostgreSQL instance."
  type        = bool
  default     = false
}

variable "db_identifier" {
  description = "Identifier for the RDS PostgreSQL instance."
  type        = string
  default     = "voxly-postgres"
}

variable "db_name" {
  description = "Database name for Voxly."
  type        = string
  default     = "voxly"
}

variable "db_username" {
  description = "Master username for RDS."
  type        = string
  default     = "voxly_admin"
}

variable "db_password" {
  description = "Master password for RDS."
  type        = string
  default     = ""
  sensitive   = true
}

variable "db_instance_class" {
  description = "Instance class for RDS PostgreSQL."
  type        = string
  default     = "db.t4g.micro"
}

variable "db_allocated_storage" {
  description = "Allocated storage in GB for RDS PostgreSQL."
  type        = number
  default     = 20
}

variable "db_engine_version" {
  description = "PostgreSQL engine version."
  type        = string
  default     = "16.3"
}

variable "db_multi_az" {
  description = "Whether to enable Multi-AZ for the RDS instance."
  type        = bool
  default     = false
}

variable "db_skip_final_snapshot" {
  description = "Whether to skip the final snapshot when destroying RDS."
  type        = bool
  default     = true
}

variable "create_elasticache" {
  description = "Whether to create an ElastiCache Redis Serverless cache."
  type        = bool
  default     = false
}

variable "elasticache_serverless_name" {
  description = "Name for the ElastiCache Serverless Redis cache."
  type        = string
  default     = "voxly-redis"
}

variable "create_dns" {
  description = "Whether to create DNS records in Route 53 when AWS is managing DNS."
  type        = bool
  default     = false
}

variable "route53_zone_name" {
  description = "Existing Route 53 hosted zone name, for example example.com, only if create_dns is enabled."
  type        = string
  default     = ""
}

variable "app_domain_name" {
  description = "Application domain name, for example staging.example.com."
  type        = string
  default     = ""
}

variable "create_acm_certificate" {
  description = "Whether to request an ACM certificate for the application domain."
  type        = bool
  default     = false
}
