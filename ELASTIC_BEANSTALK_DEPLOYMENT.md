# Voxly Elastic Beanstalk Deployment Guide

This guide describes a practical deployment strategy for running Voxly on `AWS Elastic Beanstalk`.

For deployment day, use the companion runbook:

- [Launch runbook](/Users/chason/Documents/GitHub/voxly-nextjs/LAUNCH_RUNBOOK.md)
- [GitHub Actions CI/CD guide](/Users/chason/Documents/GitHub/voxly-nextjs/GITHUB_ACTIONS_CICD.md)

It is written for the current Voxly codebase:

- Next.js app router application
- Prisma with PostgreSQL
- S3-compatible upload storage
- Stripe billing and webhooks
- email verification
- optional Redis-backed hardening later

## 1. Deployment Strategy

Recommended first production path:

1. provision infrastructure with Terraform
2. create an Elastic Beanstalk Node.js environment
3. provide Voxly environment variables through Elastic Beanstalk configuration
4. package the app as a standalone Next.js artifact for Beanstalk
5. run Prisma migrations as a controlled deployment step
6. verify DNS, HTTPS, Stripe webhooks, and email verification links

Important recommendation:

- do **not** rely on every application instance to run `prisma migrate deploy` automatically at startup
- run migrations once as a controlled step before or during deployment

## 2. What Elastic Beanstalk Should Run

Current scripts in [package.json](/Users/chason/Documents/GitHub/voxly-nextjs/package.json):

- `npm run build` -> `next build`
- `npm run start` -> `next start`
- `npm run package:beanstalk` -> builds a standalone artifact and writes `.dist/voxly-beanstalk.zip`

For Beanstalk, the recommended deploy artifact is the standalone bundle rather than the full repository zip.

Recommended runtime behavior:

- build once locally or in CI
- upload `.dist/voxly-beanstalk.zip`
- let Beanstalk run the included `Procfile`

This is safer for Voxly because it:

- ships `/_next/static` alongside the server bundle
- avoids large on-instance installs
- reduces memory pressure during deployment
- behaves more predictably than uploading the whole repo

## 3. Required Environment Variables

At minimum, configure these in Elastic Beanstalk:

- `NEXTAUTH_URL`
- `NEXTAUTH_SECRET`
- `DATABASE_URL`
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
- S3 variables used by [lib/storage/s3.js](/Users/chason/Documents/GitHub/voxly-nextjs/lib/storage/s3.js)

For the current Beanstalk + Supabase deployment:

- `DATABASE_URL` should use the Supabase session pooler connection on port `5432`
- `DIRECT_URL` is no longer required by the app

If Redis is added later:

- `REDIS_HOST`
- `REDIS_PORT`
- `REDIS_URL` if using a single connection string

## 4. Recommended AWS Wiring

Pair Beanstalk with:

- `S3` for uploads
- `Supabase PostgreSQL` for the current rollout
- `terraform.tfvars` + Elastic Beanstalk environment variables for the current cost-effective secret/config path
- `Cloudflare` for public DNS
- `ACM` for the AWS-side TLS certificate
- `CloudWatch` for logs

Optional later:

- `RDS PostgreSQL`
- `Secrets Manager`
- `ElastiCache Redis` for shared rate limiting

## 5. Prisma Migration Strategy

Use this deployment order:

1. deploy infrastructure
2. confirm database connectivity
3. run:

```bash
npx prisma migrate deploy
npx prisma generate
```

4. deploy the new app version
5. smoke-test auth, uploads, billing, and promo flows

Why this is safer:

- avoids multiple Beanstalk instances racing migrations
- keeps deployment failures easier to reason about
- fits billing-sensitive schema changes better

## 6. Cloudflare Domain Setup

Because your domain is hosted on Cloudflare:

- keep Cloudflare as the public DNS provider
- point a subdomain such as `app.yourdomain.com` to the Elastic Beanstalk environment CNAME
- use that same public HTTPS domain for `NEXTAUTH_URL`
- use `Full (strict)` SSL mode once Beanstalk HTTPS is correctly configured with ACM

Practical recommendation:

- deploy Voxly behind a dedicated app subdomain instead of the root domain at first
- example:

```txt
app.example.com -> your-beanstalk-env.elasticbeanstalk.com
```

Important caution:

- if Stripe webhooks, uploads, or auth callbacks behave unexpectedly through Cloudflare proxying, test with the subdomain set to `DNS only`
- once behavior is stable, decide whether you want Cloudflare proxying enabled for that app subdomain

### Example Cloudflare DNS Records

Recommended pattern:

- keep the app on a dedicated subdomain
- point that subdomain to the Elastic Beanstalk environment CNAME

Example:

```txt
Type: CNAME
Name: app
Target: your-beanstalk-env.elasticbeanstalk.com
Proxy status: DNS only (recommended first)
```

If you also want a staging environment:

```txt
Type: CNAME
Name: staging
Target: your-staging-env.elasticbeanstalk.com
Proxy status: DNS only (recommended first)
```

Then set:

```txt
NEXTAUTH_URL=https://app.example.com
```

For staging:

```txt
NEXTAUTH_URL=https://staging.example.com
```

Recommended rollout:

1. create the CNAME in Cloudflare
2. wait for DNS to resolve
3. verify the Beanstalk app loads on the Cloudflare subdomain
4. verify Stripe webhook delivery to the Cloudflare subdomain
5. verify email verification links use the same domain
6. only then decide whether to turn Cloudflare proxying on

## 7. ACM With Cloudflare

For a Cloudflare-managed domain, use ACM in two passes:

1. set `create_acm_certificate = true`
2. keep `beanstalk_https_certificate_arn = ""`
3. apply Terraform to request the certificate
4. read the `acm_domain_validation_records` output
5. add those CNAME records in Cloudflare
6. wait until ACM shows the certificate as `Issued`
7. set `beanstalk_https_certificate_arn` to the issued certificate ARN
8. apply Terraform again to enable the HTTPS listener on Beanstalk

This avoids Terraform hanging while waiting for Route 53 validation that does not exist in a Cloudflare DNS setup.

For Elastic Beanstalk with an Application Load Balancer, the HTTPS listener must explicitly use:

- `aws:elbv2:listener:443`
- `ListenerEnabled = true`
- `Protocol = HTTPS`
- `SSLCertificateArns = <issued ACM ARN>`

AWS reference:

- [Configuring HTTPS termination at the load balancer](https://docs.aws.amazon.com/elasticbeanstalk/latest/dg/configuring-https-elb.html)

One practical note:

- for first deployment, avoid using the root/apex domain
- start with `app.yourdomain.com` or `staging.yourdomain.com`
- that is usually simpler and less risky with Elastic Beanstalk

### Pre-Launch Checklist

Before opening Voxly to real users, verify these four areas together.

#### Cloudflare

- `app.yourdomain.com` or `staging.yourdomain.com` resolves to the Beanstalk CNAME
- SSL mode is set appropriately, preferably `Full (strict)` once AWS TLS is correct
- proxy mode has been tested against uploads, auth callbacks, and Stripe webhooks
- if behavior is unstable, the app subdomain is temporarily set to `DNS only`

#### NextAuth

- `NEXTAUTH_URL` exactly matches the public HTTPS app domain
- `NEXTAUTH_SECRET` is set in the deployed environment
- sign-up, verification, sign-in, and sign-out all work on the public domain
- session cookies behave correctly under HTTPS

#### Stripe

- checkout redirects return to the correct public app domain
- Stripe webhook endpoint points to:

```txt
https://app.yourdomain.com/api/stripe/webhook
```

- `STRIPE_WEBHOOK_SECRET` matches the configured endpoint
- test events update subscription state and credits correctly

#### Resend

- `RESEND_API_KEY` is configured
- `EMAIL_FROM` is valid for the verified Resend domain
- verification emails are delivered successfully
- email verification links open the same public app domain used by `NEXTAUTH_URL`

## 7. Beanstalk Application Checklist

Before first deploy:

- confirm the Beanstalk environment has the correct Node.js platform
- confirm `NEXTAUTH_URL` uses the real HTTPS domain
- confirm the app can reach the database
- confirm the app can reach S3
- confirm the app can reach Stripe, Deepgram, OpenAI, and Resend

After first deploy:

- open the home page
- sign up
- verify email
- sign in
- upload a test file
- confirm transcript processing works
- test Stripe checkout in test mode
- confirm Stripe webhook delivery to `/api/stripe/webhook`
- test promo creation and redemption

## 8. Stripe and Webhook Notes

For Voxly, webhook correctness matters.

After Beanstalk is live:

- configure Stripe webhook endpoint to the public HTTPS domain
- point it to:

```txt
https://your-domain.com/api/stripe/webhook
```

- verify `STRIPE_WEBHOOK_SECRET`
- confirm:
  - `checkout.session.completed`
  - `invoice.paid`
  - `customer.subscription.updated`
  - `customer.subscription.deleted`

Cloudflare note:

- Stripe webhooks should target the public app domain, not the raw Beanstalk hostname
- if Cloudflare proxying causes delivery trouble, use `DNS only` for the app subdomain while troubleshooting

## 9. Email Verification Notes

Email verification depends on:

- `NEXTAUTH_URL`
- `RESEND_API_KEY`
- `EMAIL_FROM`

Make sure:

- `NEXTAUTH_URL` matches the public Cloudflare domain used by the app
- `EMAIL_FROM` is valid for your Resend setup
- verification links open the deployed domain, not localhost

## 10. What Not To Do

- do not commit production secrets into the repository
- do not run billing or promo flows without webhook verification
- do not depend on in-memory rate limiting as the final production solution
- do not treat Beanstalk instance-local state as durable

## 11. Recommended Next Improvements

After the first successful Beanstalk deployment, the next best upgrades are:

- add shared Redis-backed rate limiting
- move more configuration to Secrets Manager
- add CI/CD for build and deploy
- add health checks and alarms in CloudWatch
- add deployment hooks or automation for safe migration orchestration

## 12. Current Verdict

Voxly is a good fit for an Elastic Beanstalk deployment as long as:

- migrations are handled deliberately
- environment variables are managed carefully
- public HTTPS and webhooks are configured correctly
- production hardening continues after the first deployment
