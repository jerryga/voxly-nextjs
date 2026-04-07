# Voxly Interview Prep

## Project In One Sentence

Voxly is a production-oriented Next.js 16 application for authenticated audio uploads, AI transcription, structured meeting summaries, assistant chat, and Stripe-based credit billing.

## Elevator Pitch

Use this if someone asks, "What does this project do?"

> I built a full-stack transcription workspace where users can sign up, upload audio, store files in S3, transcribe them with Deepgram, summarize them with OpenAI or Gemini, and then chat with an assistant over the structured notes. The app also includes subscription billing, usage credits, promo codes, admin tools, and AWS deployment support.

## Core Stack

### Frontend

- Next.js 16 App Router
- React 19
- Tailwind CSS 4
- Server-rendered pages plus client-side dashboard interactions

### Backend

- Next.js route handlers under `app/api`
- NextAuth with credentials auth
- Prisma ORM
- PostgreSQL

### Integrations

- AWS S3 for uploaded media storage
- Deepgram for speech-to-text
- OpenAI and Gemini for summarization and assistant chat
- Stripe for subscriptions, credit top-ups, billing portal, and webhooks
- Inngest for async processing with an inline fallback path

## What The Product Does

### Main user flow

1. User signs up with email/password.
2. User verifies email.
3. User uploads an audio or video file.
4. File is stored in S3 and a `Transcription` record is created.
5. Processing is queued through Inngest, or handled inline if the queue environment is unavailable.
6. The app generates a transcript through Deepgram.
7. The transcript is summarized into structured sections:
   - `decisions`
   - `keyPoints`
   - `nextSteps`
   - `actionItems`
8. The result is saved to PostgreSQL.
9. The user can review the transcript and ask follow-up questions in an assistant chat UI.

### Business model

- Monthly subscription plans: Starter, Pro, Team
- Credit packs for top-ups
- Credits are consumed based on recording duration, rounded up by the minute
- Promotions can grant credits and are managed through an admin interface

## Architecture Summary

### App structure

- `app/`: UI pages and API routes
- `lib/`: shared business logic for auth, billing, storage, security, LLMs, transcription
- `prisma/`: schema and migrations
- `inngest/`: async event client and background function
- `terraform/` and AWS docs: deployment/infrastructure support

### Key architectural decisions

- Kept frontend and backend in one Next.js codebase for faster product iteration
- Used App Router with route handlers to avoid running a separate API service
- Used Prisma to centralize data access and schema evolution
- Used S3 + signed URLs so large media files do not live in the database
- Decoupled transcription processing with Inngest, but added inline fallback for resiliency
- Abstracted LLM usage behind an agent layer so OpenAI and Gemini can be swapped or used as failover

## Important Data Models

### `User`

- Stores email, hashed password, profile fields, verification status
- Owns sessions, accounts, transcriptions, subscriptions, credits, assistant messages

### `Transcription`

- Stores uploaded file metadata and processing state
- Holds transcript text and structured summary JSON fields
- Tracks duration for credit usage

### `AssistantMessage`

- Stores user and assistant chat history per transcription

### `Subscription`

- Stores Stripe customer/subscription identifiers
- Tracks plan, status, monthly credits, top-up credits, aggregate balances

### `CreditTransaction`

- Audit trail for refills, top-ups, usage, refunds, and billing-linked events

### `Promotion` and `PromotionRedemption`

- Support promo code campaigns with redemption caps, date windows, and anti-abuse metadata

### `StripeWebhookEvent`

- Tracks webhook processing state to make Stripe event handling idempotent

## End-To-End Flow Details

### Authentication flow

- Uses NextAuth with the Prisma adapter and a credentials provider
- Passwords are hashed with `bcryptjs`
- Sign-in is blocked until `emailVerified` is set
- Signup route validates input, checks for duplicate emails, hashes the password, creates the user, and sends a verification email

Interview talking point:

> I intentionally required email verification before credential sign-in to reduce fake accounts and abuse in a product that triggers paid AI/transcription workloads.

### Upload flow

- Upload API validates same-origin requests, rate limits traffic, checks auth, validates MIME type and size, and estimates credit availability
- Allowed media includes common audio types
- Max upload size is 500 MB
- Files are uploaded to S3 under a user-scoped key like `users/<userId>/<timestamp>-<filename>`
- Database state progresses through `uploading` to `uploaded`

Interview talking point:

> I separated binary storage from relational data so the database only stores metadata while S3 handles scalable object storage.

### Transcription + summarization flow

- Upload emits an Inngest event named `voxly/audio.uploaded`
- Background function calls `processUploadedAudio`
- The processor:
  - fetches a signed S3 URL
  - calls Deepgram `nova-3`
  - extracts transcript text and duration
  - calls the LLM summarizer
  - applies credit usage
  - persists transcript + structured summary
- On failure, credits are refunded and the transcription is marked `error`

Interview talking point:

> I treated processing as a state machine with explicit error handling so failures don’t silently burn credits or leave records in an ambiguous state.

### Assistant chat flow

- Assistant chat is tied to a specific transcription
- The route loads existing chat history from the database
- The current structured summary is included as context
- User messages and assistant responses are persisted
- LLM provider/model can be selected through the abstraction layer

Interview talking point:

> I used structured summary JSON as grounding context so the assistant can answer based on normalized notes instead of only a raw transcript blob.

### Billing flow

- Plans are configured through env-backed Stripe price IDs
- Checkout supports subscription purchases and one-time top-up packs
- Webhooks handle:
  - completed top-up payments
  - successful invoices
  - failed invoices
  - subscription updates/deletes
- Subscription state is synced back into PostgreSQL
- Credit history is maintained separately for auditability

Interview talking point:

> I kept billing state in my own database instead of relying only on Stripe objects so the product can enforce credits quickly and keep a durable audit trail.

## Security And Reliability

### Security controls already in the code

- Same-origin enforcement on mutating routes
- IP-based rate limiting using an in-memory store
- Email verification before login
- Strong schema validation using Zod
- File type and file size restrictions on uploads
- CSP, HSTS, X-Frame-Options, Referrer-Policy, and Permissions-Policy headers in `next.config.ts`
- Admin routes gated by `ADMIN_EMAILS`
- Promo redemption stores hashed IP/user-agent fingerprints for abuse analysis
- Stripe webhook signature verification
- Webhook idempotency tracking through `StripeWebhookEvent`

### Reliability patterns

- Prisma client singleton in development
- Queue-based background processing
- Inline fallback when Inngest environment config is missing
- Credit refund on processing failure
- S3 region redirect retry logic
- LLM provider/model fallback behavior

## Good Engineering Decisions To Highlight

- Full-stack monorepo style app reduced coordination overhead and sped up shipping
- Background jobs plus fallback path balanced scalability and operational simplicity
- Provider abstraction for LLMs avoided lock-in
- Billing and credits were designed as first-class product concerns, not added later
- JSON summary structure gave the UI and assistant predictable data
- Deployment docs and Terraform show production intent beyond local development

## Tradeoffs / Weaknesses To Acknowledge Honestly

These are useful when an interviewer asks, "What would you improve?"

- Rate limiting is in-memory, so it does not scale cleanly across multiple app instances; Redis or another distributed store would be better
- No formal test suite is present in this repository; the biggest gap is API/integration coverage around billing and processing
- Some core backend files are JavaScript while the app uses TypeScript elsewhere, so type safety is not consistent end to end
- The app uses route handlers inside the web app, which is fast to build with, but a future high-scale version might split heavy processing into more dedicated services
- CSP currently allows `'unsafe-inline'` and `'unsafe-eval'`, which is practical during development but should be tightened in a hardened production setup

## Likely Interview Questions And Strong Answers

### "Why Next.js for this?"

Because the product needed marketing pages, authenticated app pages, and backend endpoints in one place. Next.js App Router let me ship the product surface and API surface together while still supporting server rendering and modern React patterns.

### "Why Prisma?"

Prisma gave me a clear schema, strong query ergonomics, and easy migrations. It was a good fit for a relational domain with users, subscriptions, transcriptions, audit records, and webhook state.

### "Why store summary sections separately instead of one blob?"

Because the UI and assistant both benefit from predictable structure. It makes rendering easier, lets us selectively update sections, and avoids reparsing arbitrary freeform text later.

### "How did you handle failures in the transcription pipeline?"

I explicitly tracked statuses, used background jobs, added a synchronous fallback if queue config was unavailable, and refunded credits if downstream processing failed after charging.

### "How do you prevent abuse?"

I used same-origin checks, rate limiting, email verification, Stripe webhook verification, admin gating, validation, and promo redemption fingerprinting. The next step would be moving rate limits to a distributed store and possibly adding bot protection.

### "How would you scale this?"

I’d move rate limiting and queue state to managed infrastructure, isolate media processing workers, improve observability, and add stronger automated tests around billing and async flows. The current design already separates storage, background processing, and app logic well enough to evolve in that direction.

## Files Worth Mentioning In An Interview

- `app/api/uploads/route.ts`: upload validation, S3 handoff, enqueueing
- `lib/transcriptions/process.ts`: core processing pipeline
- `lib/llm/agent.js`: LLM provider abstraction
- `app/api/assistant/chat/route.ts`: grounded assistant workflow
- `lib/billing.ts`: pricing, credits, Stripe sync logic
- `app/api/stripe/webhook/route.ts`: idempotent billing event handling
- `prisma/schema.prisma`: data model design
- `lib/api/security.ts`: origin checks and rate limiting
- `next.config.ts`: security headers

## Short "Tell Me About The Architecture" Answer

> The app is a Next.js full-stack product with App Router pages and route handlers. Authentication runs through NextAuth with Prisma and Postgres. Uploaded media goes to S3, transcription runs through Deepgram, summarization and assistant features run through an LLM abstraction that supports OpenAI and Gemini, and async processing is handled by Inngest. Billing is managed with Stripe, and I store subscription and credit state locally so the app can enforce usage and keep an audit trail.

## Short "What Are You Most Proud Of?" Answer

> I’m proud that it isn’t just a demo transcript app. It includes real product concerns like async processing, billing, credits, promo controls, webhook idempotency, and failure handling. That made me think about the whole system, not just the happy path.

## Short "What Would You Improve Next?" Answer

> I’d add automated tests around billing and transcription flows, replace in-memory rate limiting with a distributed solution, tighten production security headers further, and standardize the backend utilities to TypeScript for stronger type safety.

## Personal Study Checklist

Before the interview, make sure you can speak clearly about:

- Why App Router + route handlers fit this product
- How uploads move from browser to S3 to Deepgram to summary
- Why credits are tied to duration and how refunds work
- How Stripe webhook idempotency is implemented
- Why the assistant uses structured summary context
- What the biggest scaling and security gaps are today
- What you would improve first if this app gained more users
