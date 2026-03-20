# Voxly Security Measures

This document records the security measures currently implemented in Voxly and notes the main follow-up items for production hardening.

## Current Security Baseline

### 1. Authentication and Authorization

- User authentication is handled with NextAuth in [app/api/auth/[...nextauth]/route.ts](/Users/chason/Documents/GitHub/voxly-nextjs/app/api/auth/[...nextauth]/route.ts) and [lib/auth.ts](/Users/chason/Documents/GitHub/voxly-nextjs/lib/auth.ts).
- Credentials-based sign-in requires a verified email address before a session can be created.
- Protected API routes validate the current session with `getServerSession(authOptions)`.
- User-scoped data access is enforced in database queries by matching the authenticated user ID or email before reading, updating, or deleting records.
- Passwords are hashed with `bcryptjs` before storage in [app/api/auth/signup/route.ts](/Users/chason/Documents/GitHub/voxly-nextjs/app/api/auth/signup/route.ts).

### 2. Email Verification

Email verification is implemented through:

- [lib/email-verification.ts](/Users/chason/Documents/GitHub/voxly-nextjs/lib/email-verification.ts)
- [app/api/auth/verification/resend/route.ts](/Users/chason/Documents/GitHub/voxly-nextjs/app/api/auth/verification/resend/route.ts)
- [app/auth/verify-email/page.tsx](/Users/chason/Documents/GitHub/voxly-nextjs/app/auth/verify-email/page.tsx)

Current controls:

- verification tokens are randomly generated with Node `crypto.randomBytes`
- tokens expire after 24 hours
- previous tokens for the same email are invalidated when a new one is created
- invalid and expired tokens are rejected with controlled user-facing messages
- promo redemption is blocked until email verification succeeds

Operational note:

- email delivery currently uses Resend when `RESEND_API_KEY` and `EMAIL_FROM` are configured
- in local development without email config, the verification link is logged to the server console rather than silently failing

### 3. Security Headers

Global security headers are configured in [next.config.ts](/Users/chason/Documents/GitHub/voxly-nextjs/next.config.ts).

Implemented headers:

- `Content-Security-Policy`
- `X-Frame-Options: DENY`
- `X-Content-Type-Options: nosniff`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy`
- `Strict-Transport-Security` in production

Purpose:

- reduce clickjacking risk
- reduce MIME sniffing issues
- limit external content execution
- improve browser-side hardening

### 4. Same-Origin Protection

State-changing API routes now enforce same-origin checks in [lib/api/security.ts](/Users/chason/Documents/GitHub/voxly-nextjs/lib/api/security.ts).

This helps reduce CSRF-style abuse by rejecting requests whose `Origin` header does not match the app origin or configured public auth URL.

Applied to sensitive routes including:

- signup
- email verification resend
- uploads
- assistant endpoints
- transcription update/delete/process endpoints
- billing checkout, portal, and promo redemption endpoints
- admin promotion management endpoints

### 5. Rate Limiting and Abuse Controls

Basic in-memory rate limiting is implemented in [lib/api/security.ts](/Users/chason/Documents/GitHub/voxly-nextjs/lib/api/security.ts).

Current protection covers:

- signup requests
- signup daily IP cap
- verification resend requests
- upload requests
- assistant edit/chat requests
- manual transcription processing requests
- promo redemption requests
- promo redemption daily IP cap

Purpose:

- reduce brute-force and spam attempts
- limit abusive use of AI endpoints
- reduce accidental request floods

Note:

- current rate limiting is process-local memory only
- for multi-instance production deployment, Redis or another shared store should replace this
- rate limiting currently uses client IP from `x-forwarded-for` / `x-real-ip` headers, so proxy/load-balancer configuration must be trusted in production

### 6. Promotion Code Controls

Promotion-code protections are implemented through:

- [app/api/billing/promo/redeem/route.ts](/Users/chason/Documents/GitHub/voxly-nextjs/app/api/billing/promo/redeem/route.ts)
- [lib/billing.ts](/Users/chason/Documents/GitHub/voxly-nextjs/lib/billing.ts)
- [app/api/admin/promotions/route.ts](/Users/chason/Documents/GitHub/voxly-nextjs/app/api/admin/promotions/route.ts)
- [app/admin/promotions/page.tsx](/Users/chason/Documents/GitHub/voxly-nextjs/app/admin/promotions/page.tsx)

Implemented controls:

- promo redemption is verified entirely on the backend
- codes can be activated or deactivated
- codes can be time-limited with `startsAt` and `endsAt`
- codes can be configured as `newUsersOnly`
- each user can redeem a given code only once
- promo redemptions are blocked for accounts with prior paid billing history when the code requires that restriction
- each successful redemption writes both a `PromotionRedemption` record and a `CreditTransaction` ledger entry

Admin access:

- promotion management is restricted by server-side email allowlist via `ADMIN_EMAILS`
- admin APIs verify the signed-in session before allowing create/update actions

Privacy note:

- Voxly does not persist raw IP addresses for promo abuse review
- instead it stores `ipHash` and `userAgentHash` on `PromotionRedemption`

### 7. Input Validation

Shared request validation is implemented with `zod` in [lib/api/validation.ts](/Users/chason/Documents/GitHub/voxly-nextjs/lib/api/validation.ts).

Validated payloads include:

- sign-up requests
- verification resend requests
- assistant edit requests
- assistant chat requests
- transcription updates
- transcription deletions
- transcription process requests
- billing checkout requests
- billing portal requests
- billing promo redemption requests
- admin promotion create/update requests

Validation controls include:

- required fields
- string length limits
- allowed enum values where applicable
- normalized template values
- bounded array sizes for assistant payloads

### 8. Upload Safety Controls

Upload protections are enforced in [app/api/uploads/route.ts](/Users/chason/Documents/GitHub/voxly-nextjs/app/api/uploads/route.ts).

Implemented controls:

- authenticated access required
- same-origin protection
- rate limiting
- empty file rejection
- 500 MB maximum upload size
- allowlist for accepted audio/video MIME types
- filename sanitization before object storage key generation
- explicit upload lifecycle states (`uploading`, `uploaded`, `processing`, `done`, `error`)
- S3 object cleanup when upload succeeds but later queueing fails

### 9. Storage Security

File storage integration is implemented in [lib/storage/s3.js](/Users/chason/Documents/GitHub/voxly-nextjs/lib/storage/s3.js).

Current security characteristics:

- files are stored in S3-compatible object storage
- file access for processing uses signed URLs
- credentials are resolved from environment or AWS provider chain
- bucket names are not hardcoded into business logic

Recommended production posture:

- private bucket only
- least-privilege IAM role for upload/read access
- server-side encryption enabled

### 10. Billing and Payment Integrity

Billing-sensitive logic is implemented in:

- [app/api/stripe/webhook/route.ts](/Users/chason/Documents/GitHub/voxly-nextjs/app/api/stripe/webhook/route.ts)
- [lib/billing.ts](/Users/chason/Documents/GitHub/voxly-nextjs/lib/billing.ts)
- [app/api/billing/checkout/route.ts](/Users/chason/Documents/GitHub/voxly-nextjs/app/api/billing/checkout/route.ts)
- [app/api/billing/portal/route.ts](/Users/chason/Documents/GitHub/voxly-nextjs/app/api/billing/portal/route.ts)

Current controls:

- Stripe is treated as the billing source of truth
- subscription and top-up state changes are applied from server-side webhook handling rather than frontend redirect state
- webhook events are tracked in `StripeWebhookEvent` for idempotency and replay protection
- credit changes are recorded in `CreditTransaction` as an audit ledger
- promo credits, top-ups, monthly refills, usage charges, and usage refunds all go through the same ledgered path
- credits are deducted on the server during processing, not by the browser
- processing failures after a charge trigger a refund ledger entry

### 11. Error Handling

API error behavior is centralized in [lib/api/errors.ts](/Users/chason/Documents/GitHub/voxly-nextjs/lib/api/errors.ts).

Current improvement:

- raw internal exception messages are no longer returned to clients by default
- database initialization failures return a controlled message and `503`
- unknown failures return generic internal server error responses

### 12. Development-Only Endpoint Protection

The training-data endpoint in [app/api/transcriptions/training-data/route.ts](/Users/chason/Documents/GitHub/voxly-nextjs/app/api/transcriptions/training-data/route.ts) is now blocked in production.

Purpose:

- prevents exposure of dev/testing functionality in live environments

## Security-Sensitive Areas in Voxly

These parts of the app should be treated as high-priority security surfaces:

- authentication routes
- email verification flow
- file uploads
- assistant endpoints that send data to LLM providers
- transcription processing workflows
- Stripe checkout, portal, and webhook handling
- promo code issuance and redemption
- admin promotion management
- database connection secrets
- S3 bucket access
- third-party API keys for OpenAI, Gemini, Deepgram, and Inngest

## Remaining Gaps and Recommended Next Steps

The current implementation is a strong baseline, but these areas should still be improved for a more production-grade deployment:

### High Priority

- move rate limiting to Redis or another shared backend
- add request logging and security audit trails
- review NextAuth cookie settings for production deployment
- store secrets in AWS Secrets Manager or SSM Parameter Store
- enforce HTTPS at the load balancer / reverse proxy layer
- configure a real transactional email provider and verified sender domain for production email verification
- rotate any credentials that have been exposed in local development or shared `.env` files

### Medium Priority

- add malware scanning for uploaded files
- add CAPTCHA or Turnstile for signup and promo redemption
- add account lockout or stronger anti-abuse protections for auth flows
- add more structured authorization checks for future billing/admin features
- review CSP further if third-party scripts are introduced
- consider stronger abuse heuristics across email domain, device fingerprint, and promo redemption clusters

### AWS Deployment Recommendations

For AWS-hosted production:

- use private S3 buckets
- use IAM roles instead of static credentials where possible
- place the database in private subnets
- use security groups to restrict DB access
- store secrets in Secrets Manager or Parameter Store
- forward logs and metrics to CloudWatch
- consider AWS WAF in front of the application
- ensure webhook endpoints are reachable over HTTPS with correctly managed TLS certificates

## Summary

Voxly now includes a practical application-layer security baseline:

- authenticated API access
- verified-email gate before sign-in
- global security headers
- same-origin request enforcement
- rate limiting
- promo abuse controls with hashed audit fingerprints
- schema validation
- safer upload handling
- billing ledgering and webhook idempotency
- reduced error leakage
- production lockout for dev-only functionality

This is suitable as a documented foundation for ongoing hardening, capstone reporting, and cloud migration planning.
