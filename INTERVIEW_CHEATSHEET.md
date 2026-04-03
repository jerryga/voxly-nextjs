# Voxly Interview Cheat Sheet

## 30-Second Project Summary

Voxly is a full-stack Next.js app for uploading audio, generating transcripts, turning them into structured AI summaries, and letting users ask follow-up questions through an assistant chat. It also includes authentication, Stripe billing, usage credits, promo codes, admin tools, and AWS-ready deployment support.

## 10-Second Version

I built a transcription and AI-notes workspace with Next.js, Prisma, Postgres, S3, Deepgram, OpenAI/Gemini, Inngest, and Stripe.

## What I Built

- Authenticated user signup and sign-in
- Email verification flow
- Audio/video upload pipeline
- S3-based file storage
- Deepgram transcription
- AI-generated structured summaries
- Assistant chat on top of saved notes
- Stripe subscriptions and credit top-ups
- Promo code admin tools

## Architecture Answer

The app uses Next.js App Router for both UI and backend route handlers. Prisma connects the app to Postgres, S3 stores uploaded media, Deepgram handles speech-to-text, OpenAI or Gemini handles summarization and chat, Inngest handles background processing, and Stripe manages subscriptions and payments.

## Why This Stack

### Why Next.js?

It let me build the product UI and API in one codebase, which was great for speed and reduced complexity early on.

### Why Prisma?

It gave me a clear schema, easy migrations, and a clean way to manage relational data like users, subscriptions, webhook events, and transcriptions.

### Why S3?

Large media files don’t belong in the database, so S3 was the right place for scalable object storage.

### Why Inngest?

Transcription and summarization are long-running tasks, so I pushed them into an async workflow instead of blocking the request cycle.

## Main Flow

1. User signs up and verifies email.
2. User uploads audio or video.
3. File is stored in S3.
4. A transcription job is queued.
5. Deepgram generates transcript text.
6. OpenAI or Gemini turns it into structured notes.
7. The result is saved in Postgres.
8. The user can chat with an assistant about the summary.

## Best Talking Points

### On product thinking

This is not just a transcript demo. I also handled billing, credit enforcement, webhook idempotency, admin controls, and failure recovery.

### On reliability

I added explicit processing states, refund logic for failed jobs, webhook deduplication, and an inline fallback if the async queue environment is unavailable.

### On AI design

I grounded the assistant on a structured summary format instead of only raw transcript text, which makes the responses more consistent and easier to use in the UI.

### On billing

I stored billing and credit state in my own database so the app can enforce usage quickly and keep a real audit trail instead of depending only on Stripe objects.

## Good "I’m Proud Of This" Answer

I’m proud that I built the whole workflow end to end, not just the happy path. The project includes real-world concerns like async processing, billing, credits, webhook handling, admin tools, and error recovery.

## Good "Biggest Challenge" Answer

One challenge was making the transcription pipeline reliable, because it touches storage, external APIs, background jobs, and billing. I solved that by using explicit statuses, fallback behavior, and refund logic when processing fails.

## Challenge Answers You Can Use

### Technical challenge

The biggest technical challenge was coordinating a workflow that depends on several external systems. A single upload touches S3, Deepgram, an LLM provider, Postgres, and billing logic, so I had to design for partial failures and keep the system state consistent.

### Reliability challenge

One major challenge was making sure failed processing didn’t leave the product in a broken state. I handled that with explicit transcription statuses, async processing, inline fallback behavior, and refund logic so users don’t lose credits when something downstream fails.

### Product challenge

The product challenge was making the output useful, not just technically correct. It wasn’t enough to return a raw transcript, so I structured the AI result into decisions, key points, next steps, and action items to make it easier for users to act on.

### Scaling challenge

The scaling challenge is that this kind of app has expensive operations like media upload, transcription, summarization, and billing coordination. I addressed that by pushing processing into an async workflow and separating storage, app logic, and billing state so the architecture can evolve more cleanly.

### Security challenge

A security challenge was preventing abuse in a workflow that can trigger paid AI and transcription usage. I added same-origin checks, email verification, request validation, rate limiting, admin gating, and webhook verification to reduce both product abuse and billing risk.

### Billing challenge

Billing was challenging because subscription state alone is not enough for product enforcement. I had to keep local subscription and credit records, process Stripe webhooks safely, and make the system idempotent so duplicate events wouldn’t create incorrect balances.

## Good "What Would You Improve?" Answer

I’d add automated integration tests around billing and transcription flows, replace in-memory rate limiting with a distributed store like Redis, and standardize the backend utility layer to TypeScript for stronger type safety.

## What I Learned

### Strong answer

One thing I learned from this project is that building a real product is very different from building a feature in isolation. Once billing, external APIs, async jobs, and user-facing reliability are involved, you have to think much more carefully about state management, failure handling, and trust.

### Technical learning

I learned how important it is to design around external service failure. It’s not enough to integrate an API successfully once. You need retries, fallback behavior, status tracking, and safe recovery paths.

### Product learning

I learned that technically correct output is not always useful output. Users need structure and clarity, which is why the app moved beyond raw transcripts into decisions, key points, next steps, and action items.

### Engineering learning

I learned the value of keeping important product state in my own database, especially for billing and credits. That gives the app more control, better auditability, and safer enforcement than depending only on external providers.

## What I Would Do Differently

### Strong answer

If I were starting again, I would invest earlier in automated testing and distributed infrastructure for the critical workflows. The app works well as a product foundation, but those two areas would reduce risk as usage grows.

### Testing answer

I would add integration tests earlier, especially around the transcription pipeline and Stripe webhook handling, because those are the most failure-sensitive parts of the system.

### Architecture answer

I would likely move rate limiting and some async orchestration to more scalable shared infrastructure earlier, instead of keeping those concerns inside the app process.

### Type safety answer

I would standardize the backend utilities to TypeScript sooner. The mixed JavaScript and TypeScript approach works, but full type coverage would make the core service layer easier to maintain.

### Security answer

I would tighten production security controls earlier, especially around CSP and distributed abuse prevention, because AI and billing features create stronger incentives for misuse.

## My Role And Contributions

### Strong answer

My role was building the product end to end across both frontend and backend. I worked on the core architecture, user flows, integrations, data modeling, and operational concerns so the app would function like a real product rather than just a prototype.

### Short version

I owned the full-stack implementation, including the UI, APIs, database design, third-party integrations, and reliability-focused backend workflows.

### What I contributed technically

- Built the authenticated Next.js application structure
- Designed the Prisma/Postgres data model
- Implemented file upload and S3 storage flow
- Integrated Deepgram for transcription
- Integrated OpenAI and Gemini behind a shared abstraction layer
- Built assistant chat over structured summary data
- Implemented Stripe subscriptions, credit packs, and webhook processing
- Added promo code admin functionality
- Added security controls like validation, origin checks, rate limiting, and webhook verification

### Leadership / ownership angle

I was responsible not just for getting features working, but for making the system hold together across product, data, billing, and reliability concerns. That meant thinking through the full user journey and the failure cases, not only the happy path.

### Good answer if they ask "What part was most yours?"

The parts I’d highlight most are the transcription pipeline, the billing and credits model, and the way the assistant is grounded on structured summary data. Those areas shaped both the technical architecture and the product experience.

## Timed Project Answers

### 1-minute version

Voxly is a full-stack Next.js app I built for uploading audio, generating transcripts, and turning those into structured AI notes that users can chat with afterward. On the backend, I used Prisma with Postgres, S3 for media storage, Deepgram for transcription, OpenAI and Gemini for summarization and assistant features, Inngest for async processing, and Stripe for subscriptions and usage credits. One thing I’m proud of is that I treated it like a real product, so I also built billing, admin tools, webhook handling, and failure recovery instead of only the core feature.

### 2-minute version

This project started as a transcription and AI-notes product, but it grew into a more complete full-stack system. Users can sign up, verify email, upload audio or video, and then the app stores the file in S3, sends it through a transcription pipeline, and saves both the transcript and a structured summary into Postgres. I used Deepgram for speech-to-text and an abstraction layer over OpenAI and Gemini so the summarization and assistant chat features were flexible.

On the application side, I used Next.js App Router for both the frontend and route handlers, which helped me keep the product UI and backend logic in one codebase. I also implemented Stripe billing with monthly plans, top-up credits, and webhook processing, because this kind of AI workflow has real usage costs and needed enforcement. One of the biggest challenges was making the whole pipeline reliable across several external systems, so I added explicit processing states, async background handling, fallback behavior, and refund logic when something fails.

### 5-minute version

Voxly is a production-oriented transcription workspace I built to turn recorded conversations into something more actionable than raw transcript text. The user flow starts with authentication and email verification, then users upload audio or video files through the dashboard. Those files are validated, stored in S3, and represented in the database as transcription records with explicit lifecycle states.

From there, the app kicks off an async processing flow through Inngest. The worker fetches the uploaded media through a signed S3 URL, sends it to Deepgram for transcription, extracts duration metadata, and then passes the transcript into an LLM summarization layer. I designed that layer behind a provider abstraction so the app can use OpenAI or Gemini and fall back more gracefully if needed. Instead of storing only one blob of generated text, I structured the output into decisions, key points, next steps, and action items, which makes the results easier to render in the UI and also gives the assistant chat a cleaner grounding context.

On the product side, I also built billing and credit enforcement because this workflow has real variable costs. I used Stripe for subscriptions and one-time top-up packs, and I store subscription and credit state in Postgres so the app can enforce usage and maintain an audit trail. I also added webhook idempotency to avoid duplicate Stripe event handling, plus admin tools for promo codes and some abuse prevention controls like origin checks, rate limiting, and verification requirements.

The hardest part was reliability across the full workflow, because one user action depends on storage, AI providers, background jobs, and billing logic. I solved that by modeling state transitions clearly, handling failures explicitly, refunding credits when needed, and adding inline fallback behavior if the queue environment is unavailable. If I continued the project, I’d invest next in automated integration tests and more scalable shared infrastructure for rate limiting and async coordination.

## Honest Tradeoffs

- Rate limiting is currently in-memory, so it is not ideal for horizontal scaling
- There is no formal automated test suite yet
- Some backend logic is still in JavaScript, not TypeScript
- CSP could be tightened further for a more hardened production setup

## Fast Answers

### How are credits calculated?

Credits are tied to media duration and rounded up by the minute, so longer files consume more credits.

### How do you prevent duplicate Stripe processing?

I persist Stripe webhook event state in the database and mark events as processing/processed to make handling idempotent.

### How do you prevent abuse?

I used email verification, same-origin checks, rate limiting, validation, admin gating, and promo redemption fingerprinting.

### How do you handle provider failures?

The LLM layer supports provider and model fallback, so if one path fails or rate-limits, the app can try another.

### Why structured summaries?

Because they’re easier to render, search, edit, and reuse in assistant prompts than one large unstructured block of text.

## Study Last

Make sure you can explain:

- upload -> S3 -> Deepgram -> LLM -> Postgres
- why credits exist
- how Stripe webhooks are made safe
- what you would improve for scale
- why the assistant uses summary context
