# Voxly AWS Readiness Checklist

This checklist records what Voxly already has in place for AWS deployment, what should be completed before staging, and what should be hardened before production.

## 1. Readiness Summary

Current status:

- ready for a guided staging deployment on AWS
- not yet fully hardened for production-scale deployment

Why:

- the application already runs as a deployable Next.js full-stack service
- uploads, transcription processing, billing, promo controls, and email verification are implemented
- storage, database, and external integrations are already separated into reusable modules
- security baseline is documented in [SECURITY.md](/Users/chason/Documents/GitHub/voxly-nextjs/SECURITY.md)

Main remaining gaps:

- in-memory rate limiting
- no infrastructure-as-code yet
- no CI/CD pipeline yet
- no cloud-native secret management yet
- limited centralized logging/monitoring setup

## 2. What Is Already Ready

### Application structure

- Next.js application can run as a single deployable web service
- API routes and UI are already integrated in one codebase
- authenticated and unauthenticated flows are clearly separated

Relevant files:

- [app/page.tsx](/Users/chason/Documents/GitHub/voxly-nextjs/app/page.tsx)
- [app/dashboard/page.tsx](/Users/chason/Documents/GitHub/voxly-nextjs/app/dashboard/page.tsx)
- [lib/auth.ts](/Users/chason/Documents/GitHub/voxly-nextjs/lib/auth.ts)

### Database integration

- Prisma is already configured for PostgreSQL
- billing, promo, auth, and transcription models are already structured in the schema

Relevant files:

- [prisma/schema.prisma](/Users/chason/Documents/GitHub/voxly-nextjs/prisma/schema.prisma)
- [lib/prisma.ts](/Users/chason/Documents/GitHub/voxly-nextjs/lib/prisma.ts)

### Object storage

- upload and retrieval logic already targets S3-compatible object storage
- signed URLs are already used for controlled processing access

Relevant files:

- [lib/storage/s3.js](/Users/chason/Documents/GitHub/voxly-nextjs/lib/storage/s3.js)
- [app/api/uploads/route.ts](/Users/chason/Documents/GitHub/voxly-nextjs/app/api/uploads/route.ts)

### Billing and payments

- Stripe checkout and customer portal are implemented
- webhook-driven billing sync is implemented
- credit ledgering and idempotent webhook tracking are in place

Relevant files:

- [lib/billing.ts](/Users/chason/Documents/GitHub/voxly-nextjs/lib/billing.ts)
- [app/api/billing/checkout/route.ts](/Users/chason/Documents/GitHub/voxly-nextjs/app/api/billing/checkout/route.ts)
- [app/api/billing/portal/route.ts](/Users/chason/Documents/GitHub/voxly-nextjs/app/api/billing/portal/route.ts)
- [app/api/stripe/webhook/route.ts](/Users/chason/Documents/GitHub/voxly-nextjs/app/api/stripe/webhook/route.ts)

### Security baseline

- security headers are configured
- same-origin checks are enforced on sensitive routes
- validated request payloads are used
- promo abuse controls and hashed audit fingerprints are implemented
- email verification is required before sign-in

Relevant files:

- [next.config.ts](/Users/chason/Documents/GitHub/voxly-nextjs/next.config.ts)
- [lib/api/security.ts](/Users/chason/Documents/GitHub/voxly-nextjs/lib/api/security.ts)
- [lib/api/validation.ts](/Users/chason/Documents/GitHub/voxly-nextjs/lib/api/validation.ts)
- [SECURITY.md](/Users/chason/Documents/GitHub/voxly-nextjs/SECURITY.md)

## 3. Must Complete Before AWS Staging

### Hosting decision

Choose one AWS runtime path:

- `App Runner`
- `ECS Fargate`
- `Elastic Beanstalk`

Recommended first choice:

- `App Runner` for the simplest managed staging deployment

### Database target

Choose one:

- keep `Supabase` temporarily for staging
- move to `Amazon RDS for PostgreSQL`

Recommendation:

- staging can keep `Supabase` temporarily if speed matters
- production should move to `RDS PostgreSQL` if the goal is a more AWS-native deployment

### Object storage

- provision an S3 bucket for uploads
- configure the correct bucket name and region
- verify upload, signed-read, and cleanup behavior against AWS S3

### Environment variables

All required runtime secrets and config must be defined in the target environment:

- `DATABASE_URL`
- `DIRECT_URL`
- `NEXTAUTH_URL`
- `NEXTAUTH_SECRET`
- `OPENAI_API_KEY`
- `DEEPGRAM_API_KEY`
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `STRIPE_PRICE_STARTER_MONTHLY`
- `STRIPE_PRICE_PRO_MONTHLY`
- `STRIPE_PRICE_TEAM_MONTHLY`
- `STRIPE_PRICE_TOPUP_100`
- `STRIPE_PRICE_TOPUP_500`
- `RESEND_API_KEY`
- `EMAIL_FROM`
- `ADMIN_EMAILS`
- S3-related variables used by [lib/storage/s3.js](/Users/chason/Documents/GitHub/voxly-nextjs/lib/storage/s3.js)

### Secrets handling

Before staging, move app secrets out of local-only `.env` usage and into:

- `AWS Secrets Manager`
or
- `AWS Systems Manager Parameter Store`

### Public domain and HTTPS

Configure a public HTTPS URL so the following work correctly:

- NextAuth callbacks and session logic
- Stripe webhook delivery
- Stripe success/cancel redirects
- email verification links

Recommended AWS services:

- `Route 53`
- `ACM`

### Migrations

Before staging goes live:

- ensure Prisma migration history is up to date
- run `npx prisma migrate deploy`
- run `npx prisma generate`
- verify the target database includes the latest billing and promo fields

## 4. Recommended AWS Architecture

### Simple staging architecture

- Web app: `AWS App Runner`
- Database: `Supabase` or `RDS PostgreSQL`
- File storage: `Amazon S3`
- Secrets: `AWS Secrets Manager`
- Logs: `Amazon CloudWatch`

### Stronger production architecture

- Web app: `ECS Fargate` or `App Runner`
- Database: `Amazon RDS for PostgreSQL`
- File storage: `Amazon S3`
- Secrets: `AWS Secrets Manager`
- Logging and metrics: `CloudWatch`
- DNS and TLS: `Route 53 + ACM`
- Optional protection layer: `AWS WAF`
- Optional shared limiter/cache: `ElastiCache Redis`

## 5. Production Hardening Checklist

These items are strongly recommended before calling the AWS deployment production-ready.

### Reliability

- replace in-memory rate limiting with Redis or another shared backend
- ensure webhook retries and error handling are monitored
- confirm background processing remains reliable across restarts and scale events

### Security

- store all secrets in Secrets Manager or Parameter Store
- rotate any exposed local credentials
- verify production cookie and session settings for NextAuth
- restrict S3 bucket access with least-privilege IAM
- enforce HTTPS end to end

### Observability

- forward application logs to CloudWatch
- add alerts for:
  - failed uploads
  - failed Stripe webhooks
  - failed transcription jobs
  - repeated promo abuse signals
  - verification email send failures

### Delivery and operations

- add CI/CD pipeline for build, test, and deployment
- add infrastructure-as-code with Terraform, CDK, or CloudFormation
- define rollback procedure for failed deploys
- document staging vs production env separation

## 6. Recommended Verification Before Go-Live

Run these flows in AWS staging:

### Auth and verification

- sign up
- receive verification email
- verify email
- sign in
- resend verification email

### Upload and processing

- upload supported audio file
- confirm S3 object is created
- confirm transcription row moves through expected statuses
- confirm processing completes and results are stored

### Billing

- create subscription checkout
- complete payment in Stripe test mode
- verify webhook reaches `/api/stripe/webhook`
- verify credits refresh correctly
- buy top-up credits
- verify ledger and balances update

### Promo system

- create promo from admin page
- redeem valid promo as eligible user
- confirm one-time redemption enforcement
- confirm prior-purchase restriction works
- confirm daily promo abuse limit works

## 7. Final Readiness Verdict

Voxly is:

- ready for AWS staging with a guided deployment
- close to production-ready, but not fully hardened yet

Most important remaining work before production:

- shared rate limiting
- cloud-native secrets handling
- centralized logging and alerting
- CI/CD and infrastructure-as-code
- final AWS network, DNS, and TLS setup
