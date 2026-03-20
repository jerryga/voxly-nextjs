# Voxly Stripe Billing Plan

This document defines a safe implementation plan for `Stripe + subscriptions + credits` in Voxly.

The goal is to support:

- recurring subscription plans
- monthly included credits
- optional one-time credit top-ups
- secure, auditable credit deductions

This plan is intentionally conservative because it affects user payments and product access.

## 1. Billing Model

Voxly should use a hybrid billing model:

- `Subscription` controls plan access
- `Credits` control variable usage

Recommended unit:

- `1 credit = 1 minute of uploaded audio`

This keeps pricing understandable and aligns credit usage with the actual cost driver.

## 2. Recommended Plans

Example plan structure:

- `Starter`
  - $19/month subscription
  - 300 credits per month
  - single user
- `Pro`
  - $49/month subscription
  - 1200 credits per month
  - priority processing, richer exports, stronger assistant features
- `Team`
  - $149/month subscription
  - 4000 pooled credits per month
  - multiple users and team billing features later

Top-up products:

- `100-credit pack` for $9
- `500-credit pack` for $39

## 3. Cost Per Plan Estimate

The following unit-cost estimate is a planning model for Voxly as of `March 20, 2026`.

Assumptions:

- `1 credit = 1 minute of uploaded audio`
- transcription uses Deepgram `nova-3` monolingual with smart formatting, matching [lib/deepgram.js](/Users/chason/Documents/GitHub/voxly-nextjs/lib/deepgram.js)
- summarization and assistant calls use OpenAI `gpt-4o-mini` by default, matching [lib/llm/openai.js](/Users/chason/Documents/GitHub/voxly-nextjs/lib/llm/openai.js)
- Stripe fees use standard domestic card pricing
- S3 storage is estimated conservatively and remains a minor cost compared with transcription

Vendor reference pricing:

- Deepgram `nova-3` monolingual: `$0.0077/min`
  - source: [Deepgram pricing](https://deepgram.com/pricing)
- OpenAI `gpt-4o-mini`: `$0.15 / 1M input tokens`, `$0.60 / 1M output tokens`
  - source: [OpenAI pricing](https://platform.openai.com/docs/pricing/) and [gpt-4o-mini model page](https://platform.openai.com/docs/models/gpt-4o-mini)
- Stripe standard domestic card fees: `2.9% + 30 cents`
  - source: [Stripe pricing](https://stripe.com/us/pricing)
- AWS S3 pricing varies by region; for planning, assume standard low single-digit cents per GB-month and note that storage is not the dominant cost driver
  - source: [Amazon S3 pricing](https://aws.amazon.com/s3/pricing)

Estimated monthly cost by plan:

| Plan | Public price | Net after Stripe | Deepgram | OpenAI | S3 | Estimated vendor cost | Estimated gross margin |
|---|---:|---:|---:|---:|---:|---:|---:|
| Starter `300 credits` | `$19.00` | `$18.15` | `$2.31` | `$0.02-$0.05` | `~$0.01` | `~$2.35` | `~87%` |
| Pro `1,200 credits` | `$49.00` | `$47.28` | `$9.24` | `$0.06-$0.15` | `~$0.03` | `~$9.40` | `~80%` |
| Team `4,000 credits` | `$149.00` | `$144.38` | `$30.80` | `$0.20-$0.50` | `~$0.09` | `~$31.50` | `~78%` |

Interpretation:

- Deepgram is the main variable cost in Voxly.
- OpenAI cost is comparatively small because Voxly uses it for transcript summarization and assistant responses, not for speech-to-text.
- S3 cost is operationally important but financially minor at current plan sizes.
- The current pricing model leaves healthy margin room for app hosting, database, support, retries, and moderate usage variance.

Important caveats:

- these estimates do not include app hosting, Supabase/Postgres, monitoring, support, refunds, fraud losses, or engineering overhead
- if Deepgram diarization or additional speech features are enabled later, per-minute transcription cost will increase
- if assistant usage grows far beyond current assumptions, OpenAI cost will rise, but it is still unlikely to overtake transcription cost
- if users store large media libraries long-term, S3 cost should be revisited with the exact AWS region and retention policy

Practical conclusion:

- `Starter` is financially comfortable
- `Pro` remains strong and likely becomes the best-value growth plan
- `Team` is still healthy, but it is the plan most worth watching if transcription-heavy teams start consuming near the full `4,000` credits every month

## 4. Stripe Responsibilities vs Voxly Responsibilities

### Stripe is the billing source of truth

Stripe should own:

- subscription creation
- recurring billing
- one-time top-up charges
- invoices
- payment methods
- billing portal
- payment status

### Voxly is the product-access source of truth

Voxly should own:

- current plan stored for app logic
- current available credit balance
- every credit deduction
- every credit refill
- top-up credits
- access gating when credits are insufficient

## 5. Core Rule

Never trust the frontend for:

- whether a payment succeeded
- what plan a user has
- how many credits a user has
- whether credits should be refilled

All billing and credit state changes must come from:

- Stripe webhooks
- controlled server-side deduction logic

## 6. Recommended Stripe Products and Prices

Create these Stripe products:

- `Voxly Starter`
- `Voxly Pro`
- `Voxly Team`
- `Voxly Credit Pack 100`
- `Voxly Credit Pack 500`

Recommended Stripe setup:

- use recurring monthly prices for subscription plans
- use one-time prices for top-up packs
- use Checkout for initial purchase
- use Stripe Customer Portal for billing management

References:

- [Stripe subscriptions overview](https://docs.stripe.com/billing/subscriptions/overview)
- [Stripe Checkout subscriptions](https://docs.stripe.com/payments/subscriptions)
- [Stripe customer portal](https://docs.stripe.com/customer-management/configure-portal)

## 7. Recommended User Flows

### A. Subscribe to a plan

1. User clicks a plan on the Pricing page.
2. Voxly creates a Stripe Checkout Session in `subscription` mode.
3. User completes checkout on Stripe.
4. Stripe sends webhook events.
5. Voxly updates the user subscription record only after webhook confirmation.

### B. Buy top-up credits

1. User clicks `Buy Credits`.
2. Voxly creates a Stripe Checkout Session in `payment` mode.
3. User completes payment on Stripe.
4. Stripe sends webhook events.
5. Voxly adds purchased credits only after webhook confirmation.

### C. Manage billing

1. User clicks `Manage Billing`.
2. Voxly creates a Stripe Customer Portal session.
3. User updates card, plan, or cancellation in Stripe Portal.
4. Stripe sends webhook events.
5. Voxly updates local state based on webhook events.

## 8. Current Voxly Schema

Current billing-related schema already exists in [prisma/schema.prisma](/Users/chason/Documents/GitHub/voxly-nextjs/prisma/schema.prisma):

- `stripeCustomerId`
- `stripeSubscriptionId`
- `stripePriceId`
- `stripeCurrentPeriodEnd`
- `status`
- `plan`
- `creditsRemaining`
- `creditsTotal`

This is a good start, but it is not yet enough for safe financial tracking.

## 9. Required Schema Changes

Add stronger billing and auditability support.

### A. Expand `Subscription`

Recommended fields:

- `billingInterval` (`monthly`, later maybe `yearly`)
- `cancelAtPeriodEnd` (`Boolean`)
- `lastCreditRefreshAt` (`DateTime?`)
- `topUpCreditsRemaining` (`Int`)
- `monthlyCreditsRemaining` (`Int`)
- `monthlyCreditsTotal` (`Int`)

Why:

- separate monthly plan credits from purchased top-up credits
- make renewals and cancellations easier to reason about
- avoid mixing refillable credits with purchased credits

### B. Add `CreditTransaction`

Recommended model:

```prisma
model CreditTransaction {
  id               String   @id @default(cuid())
  userId           String
  user             User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  subscriptionId   String?
  type             String
  amount           Int
  balanceAfter     Int
  monthlyAfter     Int?
  topUpAfter       Int?
  transcriptionId  String?
  stripeEventId    String?
  stripeInvoiceId  String?
  stripeSessionId  String?
  note             String?
  createdAt        DateTime @default(now())

  @@index([userId, createdAt])
  @@index([stripeEventId])
}
```

Use cases:

- monthly refill
- top-up purchase
- usage deduction
- admin adjustment
- reversal or refund-related correction

### C. Add `StripeWebhookEvent`

Recommended model:

```prisma
model StripeWebhookEvent {
  id          String   @id @default(cuid())
  stripeEventId String @unique
  eventType   String
  processedAt DateTime @default(now())
}
```

Purpose:

- deduplicate webhook deliveries
- prevent duplicate credit grants

## 10. Credit Rules

### Monthly subscription credits

Monthly credits should:

- be granted only after successful payment
- reset on each successful renewal
- not be granted from redirect pages alone

### Top-up credits

Top-up credits should:

- be granted only after successful one-time payment
- remain available until used
- not expire unless product policy explicitly says they do

### Credit consumption order

Recommended order:

1. consume monthly credits first
2. consume top-up credits second

This is usually better for customers because subscription credits renew regularly.

### Credit deduction trigger

Recommended trigger:

- deduct credits only when a transcription job successfully begins processing or after completion, but use one consistent rule

For Voxly, the safest first rule is:

- deduct credits when the upload is accepted and processing is queued successfully

Reason:

- simple to reason about
- prevents free repeated heavy processing attempts

If processing fails due to internal error, credit can be returned by a compensating `CreditTransaction`.

## 10. Webhook Events To Handle

Use Stripe webhooks as the authoritative synchronization mechanism.

Important events:

- `checkout.session.completed`
- `invoice.paid`
- `invoice.payment_failed`
- `customer.subscription.updated`
- `customer.subscription.deleted`

References:

- [Stripe subscription webhooks](https://docs.stripe.com/billing/subscriptions/webhooks)
- [Stripe webhook signature verification](https://docs.stripe.com/webhooks/signatures)

### Recommended webhook behavior

#### `checkout.session.completed`

Use this to:

- record successful checkout context
- link the Stripe customer to the Voxly user
- capture metadata

Do not rely on this alone for recurring credit refills.

#### `invoice.paid`

Use this to:

- confirm successful subscription payment
- grant or refresh monthly credits
- mark subscription as active
- update current period end

This should be the main event for monthly credit refill.

#### `invoice.payment_failed`

Use this to:

- record billing issue
- notify user in app later
- avoid refreshing credits

#### `customer.subscription.updated`

Use this to:

- update plan
- update cancel-at-period-end state
- update current status
- react to upgrades/downgrades

#### `customer.subscription.deleted`

Use this to:

- mark the subscription inactive/canceled
- remove plan-based access after the billing period ends

## 11. Webhook Safety Rules

These rules are mandatory:

- verify Stripe signatures on every webhook
- process only required event types
- make webhook handling idempotent
- store processed event IDs
- return quickly and keep heavy work minimal
- never grant credits twice

Stripe recommends idempotent webhook handling and signature verification:

- [Stripe webhook signatures](https://docs.stripe.com/webhooks/signatures)

## 12. Metadata Strategy

When creating Stripe Checkout Sessions, include metadata such as:

- `userId`
- `plan`
- `creditPack`
- `purchaseType` (`subscription` or `topup`)

This makes webhook reconciliation safer and reduces lookup ambiguity.

## 13. Customer Portal

Use Stripe Customer Portal for:

- changing payment method
- viewing invoices
- canceling subscription
- switching plans

This reduces billing UI complexity inside Voxly and uses Stripe’s hardened billing UX.

Reference:

- [Stripe customer portal](https://docs.stripe.com/customer-management/configure-portal)

## 14. Access Control Rules Inside Voxly

### Allow access when

- subscription status is active or trialing
- or user still has valid top-up credits, depending on business rules

### Restrict access when

- subscription is canceled and billing period has ended
- subscription is unpaid and product policy says to stop service
- user has no available credits for transcription usage

### Recommended first version

- allow viewing history even if subscription lapses
- block new uploads or processing when there are insufficient credits
- allow billing management regardless of current status

## 15. Plan Change Rules

### Upgrade

Use Stripe prorations if desired.

App-side rule:

- switch plan after Stripe confirms subscription update
- do not manually guess the proration outcome

### Downgrade

Recommended:

- apply downgrade at next billing cycle
- update local plan when Stripe confirms the change

### Cancelation

Recommended:

- support `cancel_at_period_end`
- keep access until the current paid period ends

Reference:

- [Stripe cancellation events](https://docs.stripe.com/billing/subscriptions/cancel)

## 16. Refund Policy Implications

Before launch, define what happens if:

- a top-up is refunded after credits are partially used
- a chargeback occurs
- a duplicate charge is reversed

Recommended approach:

- keep all changes in `CreditTransaction`
- if a refund happens, add a compensating negative adjustment only if credits remain unused or policy allows clawback

This must be a deliberate business policy, not an ad hoc engineering rule.

## 17. Suggested Server Routes

Recommended new routes:

- `POST /api/billing/checkout`
  - create Stripe Checkout Session
- `POST /api/billing/portal`
  - create Stripe Customer Portal session
- `POST /api/stripe/webhook`
  - process Stripe webhook events
- `GET /api/billing/subscription`
  - return billing status for the authenticated user

## 18. Suggested Environment Variables

Add:

- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `STRIPE_PRICE_STARTER_MONTHLY`
- `STRIPE_PRICE_PRO_MONTHLY`
- `STRIPE_PRICE_TEAM_MONTHLY`
- `STRIPE_PRICE_TOPUP_100`
- `STRIPE_PRICE_TOPUP_500`

Optional:

- `STRIPE_PORTAL_CONFIGURATION_ID`

## 19. Suggested Implementation Order

To reduce risk, build in this order:

### Phase 1

- add schema changes
- add Stripe server client
- add checkout session route for subscriptions
- add customer portal route
- add webhook endpoint with signature verification

### Phase 2

- implement monthly credit refill on `invoice.paid`
- implement subscription state sync
- build billing status API
- show plan and credit balance in UI

### Phase 3

- add top-up purchases
- add credit ledger UI
- add billing history page

### Phase 4

- add admin adjustments
- add refund reconciliation logic
- add more advanced dunning and in-app billing alerts

## 20. Minimum Safe MVP

If you want the safest possible first release, ship only:

- monthly subscriptions
- monthly included credits
- Stripe Checkout
- Stripe Customer Portal
- webhook-based subscription sync
- credit ledger

Delay these until later:

- credit top-ups
- annual plans
- coupons
- seat-based billing
- complex prorations

## 21. Recommended Technical Decision

For Voxly, the best first production billing architecture is:

- Stripe Checkout for signup
- Stripe Customer Portal for self-service billing
- Stripe webhooks for authoritative billing updates
- Prisma-backed subscription record
- Prisma-backed credit ledger
- server-side credit enforcement on upload/processing

## 22. Summary

The safest Voxly billing model is:

- subscription grants access
- credits measure usage
- Stripe confirms payments
- Voxly tracks and enforces credits
- webhooks drive all financial state changes

This gives you:

- predictable recurring revenue
- cost-aware usage control
- auditability for disputes
- a billing flow that can scale with the product
