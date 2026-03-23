# GitHub Actions CI/CD for Voxly

This project now includes a GitHub Actions pipeline at:

- [ci-cd.yml](/Users/chason/Documents/GitHub/voxly-nextjs/.github/workflows/ci-cd.yml)

It is designed for the current Voxly deployment model:

- GitHub repository hosting
- Elastic Beanstalk runtime
- Supabase database
- Cloudflare DNS
- standalone Beanstalk deployment package

## What the Workflow Does

On every pull request and push:

1. installs dependencies with `npm ci`
2. runs `npx prisma generate`
3. runs `npx tsc --noEmit`
4. runs `npm run build`

On pushes to `main` and on manual workflow dispatch:

1. re-runs the validation steps
2. builds `.dist/voxly-beanstalk.zip`
3. authenticates to AWS using GitHub OIDC
4. uploads the artifact to S3
5. creates a new Elastic Beanstalk application version
6. updates the Beanstalk environment to that version

## Recommended GitHub Setup

Use GitHub repository or environment variables for non-secret values:

- `AWS_REGION`
- `AWS_BEANSTALK_APPLICATION_NAME`
- `AWS_BEANSTALK_ENVIRONMENT_NAME`
- `AWS_BEANSTALK_DEPLOY_BUCKET`

`AWS_BEANSTALK_DEPLOY_BUCKET` should be the dedicated deployment-artifacts bucket, not the runtime uploads bucket.

Use GitHub secrets for sensitive values:

- `AWS_ROLE_TO_ASSUME`

Recommended environment:

- GitHub Environment: `staging`

That lets you add approvals later if you want deployment protection rules.

## AWS OIDC Setup

Create a GitHub OIDC provider in AWS, then create an IAM role that GitHub Actions can assume.

Recommended trust policy shape:

For this repo, the safest trust policy is the `staging` environment subject because the deploy job uses:

- `environment: staging`

Exact template:

- [github-oidc-trust-policy.example.json](/Users/chason/Documents/GitHub/voxly-nextjs/aws/github-oidc-trust-policy.example.json)

That produces this effective subject:

```txt
repo:jerryga/voxly-nextjs:environment:staging
```

This is safer than allowing every `main` push subject because only jobs running with the protected GitHub environment can assume the role.

Recommended permission policy template:

- [github-actions-beanstalk-deploy-policy.example.json](/Users/chason/Documents/GitHub/voxly-nextjs/aws/github-actions-beanstalk-deploy-policy.example.json)

Grant that role the minimum permissions needed for:

- `s3:PutObject`
- `s3:GetObject`
- `s3:ListBucket`
- `s3:CreateBucket`
- `s3:GetBucketLocation`
- `elasticbeanstalk:CreateApplicationVersion`
- `elasticbeanstalk:UpdateEnvironment`
- `elasticbeanstalk:DescribeEnvironments`
- `elasticbeanstalk:DescribeEvents`
- `elasticbeanstalk:DescribeApplicationVersions`

If the deploy bucket is encrypted with KMS, also allow the corresponding KMS actions.

Elastic Beanstalk may also touch its own regional service bucket during `CreateApplicationVersion`, even when the workflow uploads the zip to your dedicated deploy bucket first. The Terraform-managed GitHub deploy role in this repo now grants the extra S3 permissions needed for:

```txt
elasticbeanstalk-<region>-<account-id>
```

## Create the AWS Side

1. In AWS IAM, add the GitHub OIDC provider:

```txt
Provider URL: https://token.actions.githubusercontent.com
Audience: sts.amazonaws.com
```

2. Create an IAM role, for example:

```txt
voxly-github-actions-beanstalk-deploy
```

3. Use the trust policy from:

- [github-oidc-trust-policy.example.json](/Users/chason/Documents/GitHub/voxly-nextjs/aws/github-oidc-trust-policy.example.json)

4. Attach a permissions policy based on:

- [github-actions-beanstalk-deploy-policy.example.json](/Users/chason/Documents/GitHub/voxly-nextjs/aws/github-actions-beanstalk-deploy-policy.example.json)
- [create-github-actions-oidc-role.example.sh](/Users/chason/Documents/GitHub/voxly-nextjs/aws/create-github-actions-oidc-role.example.sh)

Replace:

- `<AWS_ACCOUNT_ID>`
- `<DEPLOY_BUCKET_NAME>`

If you prefer AWS CLI, you can use the example script above after replacing the placeholders.

If you manage AWS with Terraform, this repo can now create the GitHub OIDC provider and deploy role for you. After `tofu apply`, use the Terraform output:

- [github_actions_role_arn](/Users/chason/Documents/GitHub/voxly-nextjs/terraform/outputs.tf)

and copy that value into the GitHub secret `AWS_ROLE_TO_ASSUME`.

## Required GitHub Variables

Set these in the repository or the `staging` environment:

```txt
AWS_REGION=ca-central-1
AWS_BEANSTALK_APPLICATION_NAME=voxly
AWS_BEANSTALK_ENVIRONMENT_NAME=voxly-staging
AWS_BEANSTALK_DEPLOY_BUCKET=your-beanstalk-deployments-bucket
```

Set this as a secret:

```txt
AWS_ROLE_TO_ASSUME=arn:aws:iam::<AWS_ACCOUNT_ID>:role/<YOUR_GITHUB_ACTIONS_DEPLOY_ROLE>
```

## Notes About Build-Time Environment Variables

The workflow intentionally uses placeholder values for:

- `DATABASE_URL`
- `NEXTAUTH_URL`
- `NEXTAUTH_SECRET`

That is enough for CI builds because the pipeline validates compile-time behavior, not live external integrations.

Runtime secrets still belong in Elastic Beanstalk environment configuration.

Prisma note:

- the schema includes `binaryTargets = ["native", "rhel-openssl-3.0.x"]`
- that ensures GitHub Actions and local packaging include the Linux query engine Beanstalk needs

## First Deployment Checklist

Before enabling automatic deploys from `main`, confirm:

- the Beanstalk environment is already healthy
- manual deployment with `.dist/voxly-beanstalk.zip` works
- the S3 deployment bucket exists
- the OIDC role can be assumed from GitHub Actions
- the Beanstalk environment variables are configured in AWS
- the GitHub `staging` environment exists and has protection rules if desired

If you manage infrastructure with Terraform, the deploy bucket is now provisioned separately from the uploads bucket. Use the Terraform output:

- [deploy_bucket_name](/Users/chason/Documents/GitHub/voxly-nextjs/terraform/outputs.tf)

## Why the Trust Policy Uses the Environment Subject

GitHub’s OIDC subject format changes when a workflow job uses an environment. GitHub documents that the `sub` claim must reference the environment name in that case, and AWS recommends constraining the `sub` claim as tightly as possible.

Sources:

- [AWS IAM: configuring a role for GitHub OIDC](https://docs.aws.amazon.com/IAM/latest/UserGuide/id_roles_create_for-idp_oidc.html)
- [GitHub: configuring OpenID Connect in AWS](https://docs.github.com/en/actions/security-for-github-actions/security-hardening-your-deployments/configuring-openid-connect-in-amazon-web-services)

## Manual Trigger

You can also run the deploy job manually from GitHub Actions using `workflow_dispatch`.

That is useful for:

- redeploying the current main branch
- validating the AWS role and bucket setup
- controlled staging releases
