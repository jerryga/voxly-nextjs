# Voxly Migration Runbook

This runbook describes the recommended migration path for moving Voxly from `Supabase PostgreSQL` to `AWS RDS PostgreSQL` using `AWS Database Migration Service (DMS)`, then deploying the application on `AWS Elastic Beanstalk`.

It is written for a capstone-style migration project where the goal is to demonstrate a clean AWS migration flow.

## 1. Migration Goal

Target architecture:

- source database: `Supabase PostgreSQL`
- database migration service: `AWS DMS`
- target database: `Amazon RDS for PostgreSQL`
- application hosting: `AWS Elastic Beanstalk`
- object storage: `Amazon S3`

Recommended migration order:

1. prepare AWS database
2. migrate database with DMS
3. validate the AWS target database
4. update app configuration
5. deploy app to Elastic Beanstalk
6. run end-to-end validation

## 2. Before You Start

Confirm these prerequisites:

- Supabase database access works
- AWS account is ready
- RDS target database can be created
- Elastic Beanstalk environment exists or is ready to be created
- S3 bucket exists or is ready to be created
- all required app secrets are available

Important note:

- for the assignment, do not export/download the database first unless the instructor explicitly asks for dump/restore
- if the goal is to use `AWS DMS`, the cleaner story is direct source-to-target migration

## 3. Step 1: Prepare Target Database

Create an `Amazon RDS for PostgreSQL` instance.

Checklist:

- choose a PostgreSQL version compatible with the source database
- place it in the correct VPC/subnets
- configure security groups
- record:
  - endpoint
  - port
  - database name
  - username
  - password

Recommended for initial migration:

- keep the target private
- allow only the DMS replication instance and app path to reach it

## 4. Step 2: Prepare AWS DMS

Create:

- a DMS replication instance
- a source endpoint for Supabase PostgreSQL
- a target endpoint for RDS PostgreSQL

Source endpoint notes for Supabase:

- use the correct PostgreSQL connection string
- direct connection is usually preferable if reachable
- if connection mode or IP compatibility causes issues, verify Supabase connection options carefully before proceeding

Target endpoint notes:

- point to the RDS PostgreSQL instance
- verify network and credential access before creating tasks

## 5. Step 3: Run the Database Migration

Recommended first approach:

- run a `full load` migration task

Why:

- easiest to explain
- easiest to validate
- most appropriate for a capstone unless near-zero downtime is required

Optional:

- enable `CDC` only if the assignment explicitly expects continuous replication or live cutover behavior

During migration, monitor:

- task status
- table load status
- row copy progress
- endpoint connection health
- DMS task logs

## 6. Step 4: Validate the Target Database

Before deploying the app, validate the migrated AWS database.

Check:

- expected tables exist
- schema looks correct
- row counts are reasonable
- important application data is present

Recommended Voxly tables to verify:

- `User`
- `Account`
- `Session`
- `VerificationToken`
- `Subscription`
- `CreditTransaction`
- `StripeWebhookEvent`
- `Promotion`
- `PromotionRedemption`
- `Transcription`

Validation methods:

- inspect with SQL client
- compare counts between source and target
- test key reads through Prisma where practical

## 7. Step 5: Update App Configuration

After the AWS target database is ready, update Voxly configuration so the app points to RDS.

At minimum:

- `DATABASE_URL`

Also confirm:

- `NEXTAUTH_URL`
- `NEXTAUTH_SECRET`
- Stripe secrets and price IDs
- Resend config
- OpenAI and Deepgram keys
- S3 configuration

Important:

- point the deployed app to the AWS target DB only after validation is complete
- if you later need a dedicated migration-only connection, handle that separately from the app runtime connection

## 8. Step 6: Prisma Migration and App Readiness

Before switching the app fully:

```bash
npx prisma migrate deploy
npx prisma generate
```

Why:

- confirms Prisma is aligned with the AWS target database
- ensures later app queries and writes match the expected schema

Run this carefully and only after confirming the migrated DB is the intended target.

## 9. Step 7: Deploy the App to Elastic Beanstalk

Deploy Voxly after the database is ready.

Post-deploy checks:

- homepage loads
- sign-up works
- email verification works
- sign-in works
- upload works
- transcript processing works
- billing page works
- promo code flow works

If using Cloudflare:

- verify the app domain resolves correctly
- verify `NEXTAUTH_URL` uses the public HTTPS app domain
- verify webhook and callback paths still work through the chosen Cloudflare mode

## 10. Step 8: Billing and Webhook Validation

Because Voxly includes billing, validate these after deployment:

- Stripe checkout redirects correctly
- Stripe webhooks reach `/api/stripe/webhook`
- subscription state updates correctly
- credit balances update correctly
- top-up purchases update correctly

## 11. Step 9: Promo and Security Validation

Validate:

- admin can create promotions
- eligible user can redeem
- one-time redemption is enforced
- prior-purchase restriction is enforced
- email verification is required where expected

## 12. Step 10: Final Cutover

After all validation passes:

- treat AWS RDS as the primary database
- treat the Elastic Beanstalk deployment as the active app environment

If using DMS `CDC`:

- monitor replication lag
- confirm final sync
- stop replication after cutover is complete

## 13. Suggested Demo Flow For The Assignment

For the final presentation:

1. show Supabase as the original source database
2. show AWS DMS as the migration service
3. show RDS as the AWS target database
4. show Elastic Beanstalk as the app host
5. demonstrate:
   - sign in
   - upload audio
   - transcript generation
   - billing page
   - promo flow

This creates a clear migration story:

- source system
- migration mechanism
- target system
- working cloud-hosted application

## 14. Common Mistakes To Avoid

- deploying the app before the target database is validated
- pointing the app at the wrong database during migration
- treating DMS as optional while claiming a DMS migration
- relying on frontend redirects instead of webhook-confirmed billing state
- forgetting to update `NEXTAUTH_URL` and webhook endpoints to the public domain
- mixing stale local credentials into deployment config

## 15. Final Recommendation

For Voxly, the cleanest migration sequence is:

1. `Supabase PostgreSQL`
2. `AWS DMS full load`
3. `RDS PostgreSQL validation`
4. `update app config`
5. `deploy Elastic Beanstalk`
6. `run application smoke tests`

That is the safest and clearest path for both real execution and capstone presentation.
