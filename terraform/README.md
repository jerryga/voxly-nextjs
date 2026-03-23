# Voxly Terraform Starter

This directory provides a Terraform starter structure for deploying Voxly to AWS with `Elastic Beanstalk` as the application runtime.

The current version includes:

- optional dedicated VPC, public/private subnets, route tables, and NAT gateway
- S3 bucket for uploaded media
- Elastic Beanstalk application
- Elastic Beanstalk environment
- environment-variable wiring for the Voxly app
- optional RDS PostgreSQL
- optional Secrets Manager secret
- optional Route 53 support for AWS-managed DNS users
- optional ACM setup for AWS-side TLS
- optional ElastiCache Redis Serverless

It is still a starter, not a full production stack.

## Recommended First Resources

Start with these in order:

1. choose whether to create a dedicated network or use an existing VPC
2. S3 upload bucket
3. Elastic Beanstalk application and environment
4. Elastic Beanstalk IAM roles and instance profile
5. app environment variables
6. optional RDS, Secrets Manager, DNS/TLS, and Redis

After that, add:

- CloudWatch alarms
- CI/CD deployment packaging
- tighter IAM policies
- stronger least-privilege IAM policies

## Files

- [versions.tf](/Users/chason/Documents/GitHub/voxly-nextjs/terraform/versions.tf)
- [network.tf](/Users/chason/Documents/GitHub/voxly-nextjs/terraform/network.tf)
- [iam.tf](/Users/chason/Documents/GitHub/voxly-nextjs/terraform/iam.tf)
- [variables.tf](/Users/chason/Documents/GitHub/voxly-nextjs/terraform/variables.tf)
- [main.tf](/Users/chason/Documents/GitHub/voxly-nextjs/terraform/main.tf)
- [outputs.tf](/Users/chason/Documents/GitHub/voxly-nextjs/terraform/outputs.tf)
- [terraform.tfvars.example](/Users/chason/Documents/GitHub/voxly-nextjs/terraform/terraform.tfvars.example)

## What You Need Before `terraform apply`

- an AWS account
- AWS credentials configured locally
- an application package or CI/CD path for deploying Voxly code

If `create_beanstalk_iam_roles = true`, Terraform will create:

- the Elastic Beanstalk service role
- the Elastic Beanstalk EC2 role
- the EC2 instance profile
- a bucket access policy for the uploads bucket

By default, this starter does not attach the optional managed-updates policy. That keeps the first rollout simpler and avoids a common IAM policy lookup failure in some accounts. If you later want managed updates, set `attach_beanstalk_managed_updates_policy = true`.

If `create_beanstalk_iam_roles = false`, this starter expects the following to already exist:

- `elastic_beanstalk_service_role_arn`
- `elastic_beanstalk_ec2_instance_profile`

If `create_network = false`, this starter expects the following to already exist:

- `vpc_id`
- subnet IDs

If `create_network = true`, Terraform will create:

- a dedicated VPC
- public subnets
- private subnets
- an internet gateway
- a public route table
- a private route table
- a single NAT gateway

That gives Voxly a cleaner production-style starting point while keeping the stack understandable.

## Usage

From the project root:

```bash
cd terraform
cp terraform.tfvars.example terraform.tfvars
terraform init
terraform plan
```

After review:

```bash
terraform apply
```

## Important Notes

- Do not commit real secrets into `terraform.tfvars`.
- For the current cost-effective starter, place runtime secrets in `terraform.tfvars` and pass them to Elastic Beanstalk through `app_environment`.
- `create_secrets_manager_secret` is off by default in the example because the app is not yet reading runtime secrets from Secrets Manager directly.
- For a later production-hardening step, prefer `AWS Secrets Manager` or `SSM Parameter Store`.
- The generated network uses a single NAT gateway to keep the starter simpler and cheaper. A stronger production setup may use one NAT gateway per availability zone.
- RDS and Redis now allow traffic from the Voxly application instance security group. `allowed_app_cidr_blocks` remains available only as an optional fallback or temporary bridge.
- The Route 53 pieces are optional. If your domain is hosted on Cloudflare, keep Cloudflare as public DNS and point your app subdomain at the Beanstalk environment CNAME.
- For a Cloudflare-based first deploy, keep `create_acm_certificate = false` until the Beanstalk environment and Cloudflare `CNAME` are working. Then add ACM as a second pass if you want AWS-side HTTPS on the load balancer.
- `t3.micro` is usually too tight for a Next.js + Prisma Beanstalk deployment because the platform still runs `npm install` on the instance. Start with at least `t3.small` for the first working deploy.
- If you later move from Elastic Beanstalk to ECS or App Runner, this folder is still a useful base for variables, tags, and shared AWS resources.
