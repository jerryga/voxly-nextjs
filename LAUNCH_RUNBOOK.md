# Voxly Launch Runbook

This runbook is a deployment-day checklist for launching Voxly on `AWS Elastic Beanstalk` with a Cloudflare-hosted domain.

It is intentionally short and operational.

## 1. Before Deployment

Confirm these are ready:

- AWS infrastructure has been provisioned
- Elastic Beanstalk environment exists
- database is reachable
- S3 bucket exists
- public app subdomain has been chosen
- Stripe test or live products already exist
- Resend sender domain is configured

Recommended app domains:

- production: `app.yourdomain.com`
- staging: `staging.yourdomain.com`

## 2. Configure Environment Variables

Set the required application environment variables in Elastic Beanstalk:

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

- set `DATABASE_URL` to the Supabase session pooler connection on port `5432`
- a separate `DIRECT_URL` is not required

Confirm:

- `NEXTAUTH_URL` matches the final public HTTPS domain exactly
- secrets are not copied from stale local files

## 3. DNS and HTTPS

In Cloudflare:

1. create the app subdomain CNAME
2. point it to the Elastic Beanstalk environment CNAME
3. start with `DNS only` if you want the lowest-risk first validation

Example:

```txt
Type: CNAME
Name: app
Target: your-beanstalk-env.elasticbeanstalk.com
Proxy status: DNS only
```

In AWS:

1. confirm Beanstalk HTTPS listener configuration
2. confirm ACM certificate is valid if you are terminating TLS on AWS

## 4. Database Migration Step

Before switching traffic to the new version, run:

```bash
npx prisma migrate deploy
npx prisma generate
```

Run this once in a controlled deployment context.

Do not rely on every application instance to run migrations automatically.

## 5. Deploy Application Version

Deploy the new Voxly build to Elastic Beanstalk.

After deployment:

1. open the public app domain
2. confirm the homepage loads
3. confirm `/auth/sign-up` loads
4. confirm `/auth/sign-in` loads
5. confirm `/billing` redirects appropriately when unauthenticated

## 6. Smoke Test Auth

Run this exact flow:

1. sign up with a new email
2. confirm the check-inbox screen appears
3. verify the email arrives
4. click the verification link
5. sign in successfully
6. confirm an unverified user cannot sign in

If email is not arriving:

- check `RESEND_API_KEY`
- check `EMAIL_FROM`
- check Resend sender/domain verification
- check that the verification link uses the deployed domain, not localhost

## 7. Smoke Test Uploads

Run this flow:

1. sign in
2. upload a small supported audio file
3. confirm S3 object creation
4. confirm transcription status moves through:
   - `uploading`
   - `uploaded`
   - `processing`
   - `done`
5. confirm transcript and summary appear in the UI

If upload fails:

- check S3 permissions
- check S3 bucket env vars
- check Deepgram credentials

## 8. Smoke Test Billing

In Stripe test mode:

1. choose a plan
2. complete checkout
3. confirm redirect returns to the public app domain
4. confirm webhook updates billing state
5. confirm credits update
6. buy a top-up pack
7. confirm top-up credits appear
8. open billing portal

If billing looks stale:

- verify webhook endpoint
- verify `STRIPE_WEBHOOK_SECRET`
- check webhook delivery logs in Stripe

## 9. Smoke Test Promo Codes

1. sign in as admin
2. create a promo code
3. redeem it with an eligible account
4. confirm credit history updates
5. confirm one-time redemption rule works
6. confirm prior-purchase restriction works

## 10. Decide on Cloudflare Proxy Mode

After auth, uploads, Stripe webhooks, and email verification are confirmed:

- keep `DNS only` if you want the simplest and safest setup
or
- enable Cloudflare proxying and re-test:
  - sign-in
  - webhook delivery
  - uploads
  - email verification links

If anything becomes unreliable, switch back to `DNS only` and investigate before launch.

## 11. Final Go/No-Go Check

Go live only if all of these are true:

- homepage loads on the public domain
- sign-up works
- email verification works
- sign-in works
- upload and transcript processing work
- Stripe checkout works
- Stripe webhook updates work
- billing portal works
- promo redemption works
- admin promo management works

## 12. Immediate Post-Launch Monitoring

Watch closely for:

- failed sign-ins
- failed verification emails
- failed uploads
- failed transcript jobs
- failed Stripe webhooks
- suspicious promo redemption activity

If any of these spike right after launch, pause rollout and investigate before expanding traffic.
