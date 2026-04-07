# Cloud Run Phase 1

This phase moves only the app runtime to Cloud Run.

Keep these services as they are for the first cut:

- external Postgres database
- S3-compatible object storage
- Stripe
- Deepgram
- OpenAI and/or Gemini
- Inngest

The goal is to remove the fixed-cost AWS runtime layer first, not to migrate every dependency at once.

## What Changed

- [Dockerfile](/Users/chason/Documents/GitHub/voxly-nextjs/Dockerfile) builds the app as a standalone Next.js server for Cloud Run
- [next.config.ts](/Users/chason/Documents/GitHub/voxly-nextjs/next.config.ts) already uses `output: "standalone"`
- [.dockerignore](/Users/chason/Documents/GitHub/voxly-nextjs/.dockerignore) keeps the image small and avoids copying AWS Terraform state and local secrets into the build context

## Runtime Assumptions

Cloud Run should be configured with:

- `min instances = 0`
- public ingress
- a small initial CPU and memory allocation
- an external domain only after the generated Cloud Run URL is validated

The app should continue to use:

- `DATABASE_URL` for Postgres
- the current S3-compatible storage credentials and bucket settings
- current Stripe webhook and checkout configuration, updated to the new app URL when cutting over
- current Inngest settings

## Environment Variables To Verify

Before deploying, confirm these values are set for the Cloud Run service:

- `NEXTAUTH_URL`
- `NEXTAUTH_SECRET`
- `DATABASE_URL`
- `ALLOWED_ORIGINS`
- `AWS_REGION`
- `S3_BUCKET`
- any S3-compatible storage endpoint and credential variables used by [lib/storage/s3.js](/Users/chason/Documents/GitHub/voxly-nextjs/lib/storage/s3.js)
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `STRIPE_PRICE_STARTER_MONTHLY`
- `STRIPE_PRICE_PRO_MONTHLY`
- `STRIPE_PRICE_TEAM_MONTHLY`
- `STRIPE_PRICE_TOPUP_100`
- `STRIPE_PRICE_TOPUP_500`
- `DEEPGRAM_API_KEY`
- `OPENAI_API_KEY` and/or `GOOGLE_GEMINI_API_KEY`
- `INNGEST_EVENT_KEY`
- `INNGEST_SIGNING_KEY`
- `INNGEST_ENV` if the target Inngest environment requires it
- `EMAIL_FROM`
- `ADMIN_EMAILS`

## First Validation Pass

Before switching DNS:

1. Deploy the image to a temporary Cloud Run URL.
2. Verify sign-in, sign-out, and session persistence.
3. Upload an audio file and confirm object storage writes succeed.
4. Trigger transcription processing and confirm Inngest or inline fallback works.
5. Run a Stripe checkout round-trip against the temporary URL.
6. Update webhook and callback URLs only after the temporary deployment is working.

## Cost Guidance

For the cost-effective version of this migration:

- do not add Cloud SQL in phase 1
- do not add a VPC connector in phase 1
- do not add Cloud NAT in phase 1
- do not add a load balancer in phase 1 unless a custom domain setup requires it

Those services can be revisited after the app is stable on Cloud Run.
