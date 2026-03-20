# Voxly Security Measures

This document records the security measures currently implemented in Voxly and notes the main follow-up items for production hardening.

## Current Security Baseline

### 1. Authentication and Authorization

- User authentication is handled with NextAuth in [app/api/auth/[...nextauth]/route.ts](/Users/chason/Documents/GitHub/voxly-nextjs/app/api/auth/[...nextauth]/route.ts) and [lib/auth.ts](/Users/chason/Documents/GitHub/voxly-nextjs/lib/auth.ts).
- Protected API routes validate the current session with `getServerSession(authOptions)`.
- User-scoped data access is enforced in database queries by matching the authenticated user ID or email before reading, updating, or deleting records.

### 2. Security Headers

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

### 3. Same-Origin Protection

State-changing API routes now enforce same-origin checks in [lib/api/security.ts](/Users/chason/Documents/GitHub/voxly-nextjs/lib/api/security.ts).

This helps reduce CSRF-style abuse by rejecting requests whose `Origin` header does not match the app origin or configured public auth URL.

Applied to sensitive routes including:

- signup
- uploads
- assistant endpoints
- transcription update/delete/process endpoints

### 4. Rate Limiting

Basic in-memory rate limiting is implemented in [lib/api/security.ts](/Users/chason/Documents/GitHub/voxly-nextjs/lib/api/security.ts).

Current protection covers:

- signup requests
- upload requests
- assistant edit/chat requests
- manual transcription processing requests

Purpose:

- reduce brute-force and spam attempts
- limit abusive use of AI endpoints
- reduce accidental request floods

Note:

- current rate limiting is process-local memory only
- for multi-instance production deployment, Redis or another shared store should replace this

### 5. Input Validation

Shared request validation is implemented with `zod` in [lib/api/validation.ts](/Users/chason/Documents/GitHub/voxly-nextjs/lib/api/validation.ts).

Validated payloads include:

- sign-up requests
- assistant edit requests
- assistant chat requests
- transcription updates
- transcription deletions
- transcription process requests

Validation controls include:

- required fields
- string length limits
- allowed enum values where applicable
- normalized template values
- bounded array sizes for assistant payloads

### 6. Upload Safety Controls

Upload protections are enforced in [app/api/uploads/route.ts](/Users/chason/Documents/GitHub/voxly-nextjs/app/api/uploads/route.ts).

Implemented controls:

- authenticated access required
- same-origin protection
- rate limiting
- empty file rejection
- 500 MB maximum upload size
- allowlist for accepted audio/video MIME types
- filename sanitization before object storage key generation

### 7. Storage Security

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

### 8. Error Handling

API error behavior is centralized in [lib/api/errors.ts](/Users/chason/Documents/GitHub/voxly-nextjs/lib/api/errors.ts).

Current improvement:

- raw internal exception messages are no longer returned to clients by default
- database initialization failures return a controlled message and `503`
- unknown failures return generic internal server error responses

### 9. Development-Only Endpoint Protection

The training-data endpoint in [app/api/transcriptions/training-data/route.ts](/Users/chason/Documents/GitHub/voxly-nextjs/app/api/transcriptions/training-data/route.ts) is now blocked in production.

Purpose:

- prevents exposure of dev/testing functionality in live environments

## Security-Sensitive Areas in Voxly

These parts of the app should be treated as high-priority security surfaces:

- authentication routes
- file uploads
- assistant endpoints that send data to LLM providers
- transcription processing workflows
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

### Medium Priority

- add malware scanning for uploaded files
- add account lockout or stronger anti-abuse protections for auth flows
- add more structured authorization checks for future billing/admin features
- review CSP further if third-party scripts are introduced

### AWS Deployment Recommendations

For AWS-hosted production:

- use private S3 buckets
- use IAM roles instead of static credentials where possible
- place the database in private subnets
- use security groups to restrict DB access
- store secrets in Secrets Manager or Parameter Store
- forward logs and metrics to CloudWatch
- consider AWS WAF in front of the application

## Summary

Voxly now includes a practical application-layer security baseline:

- authenticated API access
- global security headers
- same-origin request enforcement
- rate limiting
- schema validation
- safer upload handling
- reduced error leakage
- production lockout for dev-only functionality

This is suitable as a documented foundation for ongoing hardening, capstone reporting, and cloud migration planning.
