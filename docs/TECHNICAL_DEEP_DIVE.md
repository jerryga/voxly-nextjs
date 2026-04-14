# Voxly — Technical Deep Dive

> Complete engineering reference covering architecture, production data flow, core implementation details, and interview Q&A.

---

## Table of Contents

1. [Tech Stack](#1-tech-stack)
2. [System Architecture](#2-system-architecture)
3. [Database Schema](#3-database-schema)
4. [Core Workflows](#4-core-workflows)
   - 4.1 [Authentication & Registration](#41-authentication--registration)
   - 4.2 [Workspace Multi-Tenancy](#42-workspace-multi-tenancy)
   - 4.3 [Audio Upload Pipeline](#43-audio-upload-pipeline)
   - 4.4 [Transcription & AI Processing](#44-transcription--ai-processing)
   - 4.5 [AI Assistant (Chat)](#45-ai-assistant-chat)
   - 4.6 [Project Intelligence](#46-project-intelligence)
   - 4.7 [Digest Delivery System](#47-digest-delivery-system)
   - 4.8 [Billing & Credits](#48-billing--credits)
   - 4.9 [Notion Integration](#49-notion-integration)
   - 4.10 [Slack Integration](#410-slack-integration)
5. [Frontend Architecture](#5-frontend-architecture)
6. [API Surface](#6-api-surface)
7. [Background Jobs (Inngest)](#7-background-jobs-inngest)
8. [Production Deployment](#8-production-deployment)
9. [Environment Variables](#9-environment-variables)
10. [Interview Q&A](#10-interview-qa)

---

## 1. Tech Stack

| Layer | Technology | Version |
|---|---|---|
| Framework | Next.js (App Router) | ~16 |
| UI Library | React | 19 |
| Language | TypeScript | 5+ |
| Styling | Tailwind CSS | 4 |
| ORM | Prisma | 6 |
| Database | PostgreSQL | 15+ |
| Auth | NextAuth.js (JWT strategy) | 4 |
| Background jobs | Inngest | 3 (`^3.38.0`) |
| Transcription | Deepgram (`nova-3` model) | latest |
| Primary LLM | OpenAI `gpt-4o-mini` | latest |
| Fallback LLM | Google Gemini `gemini-2.5-flash` | latest |
| File storage | AWS S3 | SDK v3 |
| Email | Resend | latest |
| Payments | Stripe | latest |
| Notion API | `@notionhq/client` | latest |
| Markdown rendering | `react-markdown` + `remark-gfm` | latest |

---

## 2. System Architecture

```
Browser
  │
  ├─── Next.js App Router (Vercel / Cloud Run)
  │      ├─ Server Components  → Prisma queries, session checks
  │      ├─ Client Components  → interactive state, streaming
  │      └─ API Routes (/api/…) → REST endpoints
  │
  ├─── Inngest (event bus + cron)
  │      ├─ voxly/audio.uploaded  → processMeetingAudio
  │      ├─ cron hourly           → sendScheduledProjectDigests
  │      └─ cron hourly           → sendScheduledWorkspaceDigests
  │
  ├─── AWS S3      → raw audio file storage
  ├─── Deepgram    → speech-to-text (nova-3, diarization)
  ├─── OpenAI      → summarisation, formatting, chat, intelligence
  ├─── Gemini      → fallback LLM (configurable via LLM_PROVIDER env)
  ├─── Resend      → transactional email delivery
  ├─── Stripe      → subscription billing + one-time credit packs
  ├─── Notion API  → manual page publishing
  └─── Slack API   → digest & insight delivery
```

### Request Path (typical server component)

```
GET /dashboard
  1. next/headers → cookies → voxly_workspace cookie
  2. getServerSession(authOptions) → JWT → user.id
  3. requireWorkspaceContext(session, workspaceCookie)
     └── prisma.workspace.findUnique + WorkspaceMember check
  4. parallel prisma.findMany for transcriptions, projects, tasks
  5. render <DashboardShell> (server) + <TranscriptionClient> (client)
```

---

## 3. Database Schema

All models use `cuid()` primary keys. Key models:

### Core user / auth

```prisma
model User {
  id            String    @id @default(cuid())
  email         String    @unique
  password      String?           // bcrypt hash
  emailVerified DateTime?
  subscription  Subscription?
  creditTransactions CreditTransaction[]
  // ... relations to all owned resources
}
```

### Multi-tenancy

```prisma
model Workspace {
  id          String  @id @default(cuid())
  slug        String  @unique     // URL-safe, collision-safe
  ownerUserId String
  isPersonal  Boolean @default(false)
  members     WorkspaceMember[]
  // ... all workspace-scoped resources
}

model WorkspaceMember {
  workspaceId String
  userId      String
  role        String   // "owner" | "admin" | "member" | "viewer"
  status      String   // "active" | "invited" | "removed"
  @@unique([workspaceId, userId])
}
```

### Transcription (central entity)

```prisma
model Transcription {
  id                  String   @id @default(cuid())
  userId              String
  workspaceId         String?
  projectId           String?
  fileName            String
  fileUrl             String   // S3 key (not public URL)
  template            String   @default("default")
  status              String   // "uploaded" | "processing" | "done" | "error"
  rawTranscript       String?  @db.Text   // verbatim Deepgram output
  formattedTranscript String?  @db.Text   // AI-cleaned speaker turns
  transcript          String?  @db.Text   // effective transcript served to UI
  decisions           Json?    // string[]
  keyPoints           Json?    // string[]
  nextSteps           Json?    // string[]
  actionItems         Json?    // string[]
  duration            Int?     // seconds
  searchText          String?  @db.Text   // denormalized full-text field
}
```

### Polymorphic comments

```prisma
model WorkspaceComment {
  // Exactly one of the four FK columns is non-null:
  transcriptionId    String?
  actionTaskId       String?
  projectInsightId   String?
  workspaceInsightId String?
  content            String  @db.Text
  mentions           Json?   // array of { userId, name }
}
```

### Billing

```prisma
model Subscription {
  userId          String  @unique
  plan            String  // "starter" | "pro" | "team"
  stripeCustomerId String @unique
  stripeSubscriptionId String @unique
  status          String  // mirrors Stripe status
  monthlyCredits  Int     // allotted per renewal
  currentPeriodEnd DateTime
}

model CreditTransaction {
  userId         String
  transcriptionId String?
  type           String   // "monthly_allotment" | "usage" | "topup" | "refund"
  amount         Int      // positive = credit added, negative = credit used
  balanceAfter   Int
  note           String?
}
```

### Digest & reporting

```prisma
// Not in generated Prisma client (added via raw SQL migration)
// Accessed via type-cast delegate pattern:
//   const delegate = (prisma as typeof prisma & { projectDigestSettings: ... }).projectDigestSettings

ProjectDigestSettings {
  projectId       String @unique
  enabled         Boolean
  cadence         String  // "weekly" | "monthly"
  reportType      String  // "summary" | "new_insights" | "open_tasks" | "risk_watch"
  weekday         Int     // 0=Sun, 6=Sat
  dayOfMonth      Int
  hourLocal       Int     // 0–23
  timezone        String  // IANA timezone
  recipientScope  String  // "managers" | "all_members"
  sendEmail       Boolean
  sendSlack       Boolean
  lastSentAt      DateTime?
}
```

---

## 4. Core Workflows

### 4.1 Authentication & Registration

```
POST /api/auth/signup
  1. validate email + password
  2. bcrypt.hash(password, 10)
  3. prisma.user.create
  4. send email-verification link (Resend)
  5. return 201

GET /api/auth/verification?token=…
  1. validate token TTL
  2. prisma.user.update { emailVerified: new Date() }

POST /api/auth/[...nextauth] (credentials)
  1. prisma.user.findUnique by email
  2. check emailVerified — throw "EmailNotVerified" if null
  3. bcrypt.compare(input, hash)
  4. return { id, email, name } → NextAuth mints JWT

JWT payload:
  { sub: user.id, email, name, iat, exp }

Session strategy: "jwt" (no DB session rows; stateless)
```

**Key file:** `lib/auth.ts`

### 4.2 Workspace Multi-Tenancy

Every authenticated action is scoped to an **active workspace**. Selection is stored in a cookie.

```typescript
// lib/workspaces.ts
export const ACTIVE_WORKSPACE_COOKIE = "voxly_workspace"; // cookie name

// requireWorkspaceContext() — called from all server components and API routes:
export async function requireWorkspaceContext(session, workspaceIdFromCookie?) {
  // 1. load user's workspace memberships
  // 2. prefer cookie value; fall back to personal workspace
  // 3. verify membership is active
  // 4. return { activeWorkspace, allWorkspaces, role }
}
```

**Personal workspace:** Created automatically on first signup — `isPersonal: true`. Cannot be deleted.

**Slug generation:**

```typescript
function slugifyWorkspaceName(name: string) {
  return name.trim().toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}
// Collision-safe: appends -2, -3 … until unique
```

**Roles:** `owner` > `admin` > `member` > `viewer`

**Invite flow:**
1. Owner/admin POSTs to `/api/workspaces/invites` → unique token, 7-day TTL
2. Resend delivers invite email
3. Invitee GETs `/invite/[token]` → server validates token, creates `WorkspaceMember`

### 4.3 Audio Upload Pipeline

```
Browser → POST /api/uploads
  1. enforceSameOrigin + requireWorkspaceContext
  2. parse multipart/form-data (file + metadata)
  3. validate MIME type (audio/*, video/*)
  4. s3.PutObjectCommand → s3Key = workspaceId/userId/timestamp-filename
  5. prisma.transcription.create { status: "uploaded", fileUrl: s3Key }
  6. inngest.send("voxly/audio.uploaded", { transcriptionId, fileKey: s3Key, template })
  7. return { transcriptionId }

Browser polls GET /api/transcriptions?status=processing until status="done"
```

**S3 key pattern:** `{workspaceId}/{userId}/{Date.now()}-{sanitizedFilename}`

No public S3 bucket access — all file reads go through **signed URLs** with 1-hour TTL (`getSignedFileUrl()`).

### 4.4 Transcription & AI Processing

Triggered by Inngest event `voxly/audio.uploaded`. Implemented in `lib/transcriptions/process.ts`:

```
processUploadedAudio({ transcriptionId, fileKey, template, bucket })
  │
  ├─ 1. Load transcription from DB
  ├─ 2. Resolve template (built-in or custom)
  ├─ 3. Check for reuse (same template + already done → skip, return reusedExisting:true)
  ├─ 4. Billing: ensureCreditsAvailableForProcessing(userId)
  ├─ 5. Atomic status → "processing" (updateMany count=0 = cancelled elsewhere)
  ├─ 6. getSignedFileUrl(fileKey) → 1-hour S3 pre-signed URL
  ├─ 7. Deepgram nova-3: transcribeFromUrl(signedUrl)
  │      └── diarization enabled → utterances with speaker labels + timestamps
  ├─ 8. extractReadableTranscript(result)
  │      ├─ extractFormattedUtterances (speaker-turn merging)
  │      ├─ extractFormattedParagraphs (fallback)
  │      └─ extractRawTranscript (last resort)
  ├─ 9. formatTranscript(raw, readable, { template }) via LLM
  │      └── graceful fallback: if AI format fails, use readable
  ├─ 10. summarizeTranscript(effectiveText, { template, customInstructions })
  │       └── returns { decisions[], keyPoints[], nextSteps[], actionItems[] }
  ├─ 11. applyUsageCredits({ userId, transcriptionId, durationSeconds })
  ├─ 12. prisma.transcription.updateMany → status:"done", all fields
  │       └── updateMany count=0 = cancelled → refund credits
  └─ 13. return { transcriptionId }

On any error:
  - refundUsageCredits()
  - markTranscriptionError(transcriptionId) → status:"error"
  - re-throw (Inngest retries up to 3 times)
```

#### Speaker-turn merging logic

Short utterances (≤6 words) from the same speaker are merged with the previous block. Utterances not ending in `.!?` are merged. This produces clean paragraphs rather than sentence-per-line fragmentation.

```typescript
function shouldMergeUtterances(currentText, nextText, currentSpeaker, nextSpeaker) {
  if (currentSpeaker !== nextSpeaker) return false;
  if (currentWordCount <= 6 || nextWordCount <= 6) return true;
  if (!/[.!?]["']?$/.test(currentText)) return true;
  return /^[a-z0-9,(]/i.test(nextText); // continuation
}
```

#### LLM provider pattern

```typescript
// Configurable via LLM_PROVIDER env var
// Primary: OpenAI gpt-4o-mini
// Fallback: Google Gemini gemini-2.5-flash
```

Both `formatTranscript` and `summarizeTranscript` are in `lib/llm/agent.ts`. Template-aware system prompts adjust extraction focus (e.g., `interview` template extracts candidate signals; `brainstorm` extracts idea themes).

### 4.5 AI Assistant (Chat)

Two parallel API calls on every user message:

```
POST /api/assistant       → edit mode: may update summary fields
POST /api/assistant/chat  → conversational reply stored in AssistantMessage table

Both receive:
  - messages: AssistantMessage[]   (conversation history)
  - summary: { decisions, keyPoints, nextSteps, actionItems }
  - transcriptionId (chat endpoint only)

/api/assistant returns:
  { summary?: { decisions, keyPoints, nextSteps, actionItems } }
  → if summary changed, UI updates transcription state in-place

/api/assistant/chat returns:
  { message: string }
  → appended to assistantMessages state
```

History persistence: `AssistantMessage` rows linked to `transcriptionId`. Loaded via `GET /api/assistant/chat?transcriptionId=`.

### 4.6 Project Intelligence

Cross-recording semantic search within a project or workspace.

```
POST /api/intelligence/project
  body: { projectId, question }
  
  1. Load all transcriptions for project (transcript, keyPoints, decisions, etc.)
  2. Build context chunks via lib/intelligence/project-intelligence.ts:
     a. splitTranscript() → paragraphs
     b. chunkTranscript(text, maxLength=1200) → overlapping chunks
     c. flattenStrings(keyPoints/decisions/…) → bullet chunks
  3. Score chunks against question (TF-IDF-style keyword overlap, not vector embeddings)
  4. Take top-k chunks
  5. Feed chunks + question to LLM
  6. Return { answer, confidenceNote, sources[] }
```

Workspace-scope intelligence (`/api/intelligence/workspace`) works the same but across all projects.

### 4.7 Digest Delivery System

Digests are scheduled reports (weekly or monthly) delivered via email and/or Slack.

#### Trigger mechanism

```
Inngest cron: "TZ=UTC 0 * * * *"   (top of every UTC hour)
  │
  ├─ sendScheduledProjectDigests
  │    └─ sendDueProjectDigests(now)
  │         ├─ load all enabled ProjectDigestSettings
  │         ├─ for each: isDigestDue(settings, now)?
  │         │    ├─ check cadence (weekly: weekday+hour match, monthly: dayOfMonth+hour match)
  │         │    ├─ timezone-aware: Intl.DateTimeFormat with user's IANA tz
  │         │    └─ dedup: lastSentAt within same zoned hour → skip
  │         └─ sendProjectDigest({ projectId, trigger: "scheduled" })
  │
  └─ sendScheduledWorkspaceDigests  (identical pattern for workspace-level digests)
```

#### `isDigestDue()` — idempotency logic

```typescript
function isDigestDue(settings, now) {
  if (!settings.enabled) return false;
  const parts = getZonedDateParts(now, settings.timezone); // Intl-based
  // cadence check: weekday+hour or dayOfMonth+hour
  if (/* schedule doesn't match */) return false;
  // dedup: if we already sent this hour, skip
  if (settings.lastSentAt && isSameZonedHour(settings.lastSentAt, now, settings.timezone))
    return false;
  return true;
}
```

This makes the hourly cron **idempotent** — even if fired multiple times in the same hour, only the first call sends.

#### Email content

Rendered as inline HTML (no template engine). Report types:
- `summary` — recent insights + active tasks
- `new_insights` — insights only
- `open_tasks` — tasks only  
- `risk_watch` — risk-flagged items + follow-up watchlist

Each report type has a different subject line, intro paragraph, and section mix.

#### After sending

```typescript
await projectDigestDelegate.update({ where: { projectId }, data: { lastSentAt: new Date() } });
await createWorkspaceAuditLog({ action: "project.digest.sent_scheduled", ... });
await createRecurringReportRun({ trigger: "scheduled", status: "success", ... });
// In-app notifications to recipients
```

### 4.8 Billing & Credits

Credits are the unit of consumption. One credit ≈ one minute of audio processed.

#### Plans

| Plan | Price | Monthly Credits |
|---|---|---|
| Starter | $19/mo | 300 |
| Pro | $49/mo | 1,200 |
| Team | $149/mo | 4,000 |

Top-up packs: `pack_100` (100 credits), `pack_500` (500 credits).

#### Credit flow

```
Upload triggers processUploadedAudio:
  1. hasUsageCreditsApplied(transcriptionId) → idempotency check (avoids double-charge on retry)
  2. ensureCreditsAvailableForProcessing(userId)
     └── monthly balance + topup balance >= MIN_REQUIRED_CREDITS
     └── throws 402 if insufficient
  3. [process audio]
  4. applyUsageCredits({ userId, transcriptionId, durationSeconds })
     └── creates CreditTransaction { type: "usage", amount: -N }
  5. On failure: refundUsageCredits({ transcriptionId })
     └── reversal CreditTransaction { type: "refund", amount: +N }
```

#### Stripe integration

```
POST /api/billing/checkout
  → stripe.checkout.sessions.create (subscription)
  → redirect to Stripe hosted checkout

POST /api/stripe/webhook
  → verify signature (stripe.webhooks.constructEvent)
  → handle: checkout.session.completed → activate subscription + grant monthly credits
  → handle: invoice.paid → renew monthly credits
  → handle: customer.subscription.deleted → downgrade

POST /api/billing/portal
  → stripe.billingPortal.sessions.create → redirect
```

### 4.9 Notion Integration

Two distinct use cases handled by separate code paths:

| Use Case | Setting Required | API Route | Lib Function |
|---|---|---|---|
| Automatic insight publishing (via workspace digest) | `enabled: true` | — | `requireEnabledNotionSettings()` + `publishInsightToNotion()` |
| Manual session publishing | `configured: true` (token+pageId present) | `POST /api/transcriptions/[id]/notion` | `requireConnectedNotionSettings()` + `publishSessionToNotion()` |

**Key distinction:** `enabled` controls the automation toggle; `configured` means credentials exist. A user can have Notion "Connected" (configured=true) but the auto-publish toggle paused (enabled=false). Manual publish always works as long as credentials are present.

```typescript
// lib/notion.ts

// For automated publishing — requires both configured AND enabled
export async function requireEnabledNotionSettings(workspaceId: string) { ... }

// For manual publishing — only requires credentials to exist
export async function requireConnectedNotionSettings(workspaceId: string) { ... }
```

**Session → Notion format:**

```typescript
function formatTranscriptionMarkdown(transcription) {
  // Key Points as bullet list
  // Decisions as bullet list
  // Next Steps as bullet list
  // Action Items as checkbox list: "- [ ] item"
  // Full transcript as collapsible block
}
```

### 4.10 Slack Integration

```
WorkspaceSlackSettings { workspaceId, accessToken, teamId, teamName, botUserId }
WorkspaceSlackDestination { workspaceId, channelId, channelName, isDefault }
```

Digests can be delivered to a specific Slack channel or the default workspace channel. `sendProjectDigestToSlack()` formats a Block Kit message with stats cards and insight bullets.

Individual insights can be shared to Slack via `POST /api/intelligence/project/insights/[id]/slack`.

---

## 5. Frontend Architecture

### Component hierarchy

```
app/
  layout.tsx              ← root HTML, providers
  dashboard/
    page.tsx              ← server component: session + prisma
    TranscriptionClient.tsx ← "use client", all dashboard state
    WorkspaceTree.tsx     ← workspace switcher sidebar
    HistorySurface.tsx    ← transcription list + search
    IntelligenceSurface.tsx ← project insights
    OperationsSurface.tsx ← tasks, digests, reports
    SettingsSurface.tsx   ← workspace/user settings
  session/[id]/
    page.tsx              ← server: fetch transcription + workspace context
    SessionClient.tsx     ← "use client": all session state
    SessionSummaryPanel.tsx ← left column: summary, tasks, actions
    SessionAssistantPanel.tsx ← right column wrapper + warm-start
    SessionAssistantRail.tsx  ← full chat UI (scope tabs, messages, input)
    WhatNextPanel.tsx     ← action pills: Ask AI, Add to project, Share, Notion
    DigestUpsellBanner.tsx ← dismissible CTA
    OnboardingChecklist.tsx ← first-visit guide
    hooks/
      useOnboarding.ts    ← localStorage state machine
      useProactiveSuggestions.ts ← content-aware prompt suggestions
```

### Server / Client split

Server components fetch data with Prisma directly. Client components receive typed props and own interaction state. The boundary is always at the "Client" suffix component.

```typescript
// app/session/[id]/page.tsx  (server)
const [transcription, projects, digestSettings, notionSettings] = await Promise.all([
  prisma.transcription.findFirst({ where: { id, workspaceId } }),
  prisma.project.findMany({ where: { workspaceId } }),
  ensureWorkspaceDigestSettings(workspaceId),
  getWorkspaceNotionSettings(workspaceId),
]);

return (
  <DashboardShell>
    <SessionClient
      transcription={transcription}
      projects={projects}
      hasDigestConfigured={digestSettings.enabled}
      hasNotionConfigured={notionSettings.configured}  // NOT .enabled
    />
  </DashboardShell>
);
```

### SessionAssistantRail layout

The AI chat panel uses a 3-zone flex layout to fill the full viewport height:

```
┌─────────────────────────────┐  ← rounded-[28px], h-full flex flex-col
│  Header (shrink-0)          │    scope tabs (transcript / project / workspace)
│  ─ segmented control        │    sub-controls (project picker, workspace filter)
├─────────────────────────────┤
│  Messages (flex-1           │    auto-scroll to bottom on new message
│    overflow-y-auto)         │    typing indicator (3 bouncing dots)
│  ─ greeting + suggestions   │    shown only when no user messages yet
│  ─ chat bubbles             │    assistant: left-aligned, user: right-aligned
├─────────────────────────────┤
│  Input (shrink-0)           │    auto-grow textarea (max 120px)
│  ─ textarea + send button   │    Enter=send, Shift+Enter=newline
└─────────────────────────────┘
```

The parent sticky column: `lg:sticky lg:top-0 lg:h-screen lg:py-8`

### Workspace navigation (WorkspaceTree)

Controlled `useState<Set<string>>` for expanded workspaces — replaced the original `<details>/<summary>` HTML element which cannot be animated and creates state-management conflicts with React.

Two separate click handlers prevent coupling:
- Chevron button → toggles `expandedIds` (expand/collapse only)
- Name button → `handleSwitchWorkspace()` + optimistic expand

```typescript
const [expandedIds, setExpandedIds] = useState<Set<string>>(
  () => new Set([activeWorkspaceId]) // initially expand active workspace
);
```

---

## 6. API Surface

### Uploads & transcriptions

| Method | Path | Description |
|---|---|---|
| POST | `/api/uploads` | Upload audio file → S3 → Inngest event |
| GET | `/api/transcriptions` | List workspace transcriptions |
| PATCH | `/api/transcriptions` | Update transcription (projectId, etc.) |
| DELETE | `/api/transcriptions` | Delete transcription |
| POST | `/api/transcriptions/process` | Manually re-trigger processing |
| GET | `/api/transcriptions/[id]/export` | Export as PDF/Markdown |
| POST | `/api/transcriptions/[id]/notion` | Publish session to Notion |

### AI & intelligence

| Method | Path | Description |
|---|---|---|
| POST | `/api/assistant` | Edit summary fields via AI |
| GET/POST | `/api/assistant/chat` | Conversational AI (history stored) |
| POST | `/api/intelligence/project` | Cross-recording Q&A (project scope) |
| POST | `/api/intelligence/workspace` | Cross-recording Q&A (workspace scope) |
| GET/POST/PATCH/DELETE | `/api/intelligence/project/insights` | Project insight CRUD |
| GET/POST/PATCH/DELETE | `/api/intelligence/workspace/insights` | Workspace insight CRUD |

### Projects & tasks

| Method | Path | Description |
|---|---|---|
| GET/POST | `/api/projects` | List/create projects |
| GET/PATCH/DELETE | `/api/projects/[id]` | Project CRUD |
| GET/POST | `/api/tasks` | List/create action tasks |
| PATCH/DELETE | `/api/tasks/[id]` | Task updates |

### Digests & reports

| Method | Path | Description |
|---|---|---|
| GET/PUT | `/api/workspaces/digest` | Workspace digest settings |
| GET/PUT | `/api/projects/[id]/digest` | Project digest settings |
| GET/POST | `/api/report-runs` | Report run history |
| POST | `/api/report-runs/[id]/retry` | Retry failed report |
| POST | `/api/cron/project-digests` | HTTP manual trigger (fallback) |
| POST | `/api/cron/workspace-digests` | HTTP manual trigger (fallback) |

### Integrations

| Method | Path | Description |
|---|---|---|
| GET/POST/DELETE | `/api/workspaces/notion` | Notion settings CRUD |
| GET/POST/DELETE | `/api/workspaces/slack` | Slack settings CRUD |
| GET/POST | `/api/workspaces/slack/destinations` | Slack channel management |

### Auth & workspace

| Method | Path | Description |
|---|---|---|
| POST | `/api/auth/signup` | Register |
| GET | `/api/auth/verification` | Verify email |
| POST | `/api/auth/[...nextauth]` | NextAuth handler |
| GET/POST | `/api/workspaces` | List/create workspaces |
| GET/POST | `/api/workspaces/invites` | Manage invites |
| POST | `/api/workspaces/invites/accept` | Accept invite |
| PATCH | `/api/workspaces/active` | Switch active workspace |

### Billing

| Method | Path | Description |
|---|---|---|
| POST | `/api/billing/checkout` | Create Stripe checkout session |
| POST | `/api/billing/portal` | Create Stripe billing portal session |
| GET | `/api/billing/history` | Credit transaction history |
| POST | `/api/stripe/webhook` | Stripe event handler |
| POST | `/api/billing/promo/redeem` | Redeem promotion code |

---

## 7. Background Jobs (Inngest)

**File:** `inngest/functions.ts`

### processMeetingAudio

```typescript
inngest.createFunction(
  { id: "process-meeting-audio", retries: 3 },
  { event: "voxly/audio.uploaded" },
  async ({ event, step }) => {
    const result = await step.run("process-uploaded-audio", () =>
      processUploadedAudio({ transcriptionId, fileKey, template, bucket })
    );

    // Skip email if reusing a cached result (no new processing happened)
    if (!result.reusedExisting) {
      await step.run("send-session-ready-email", async () => {
        // fetch transcription → send Resend email with session URL
      });
    }

    return { transcriptionId };
  }
);
```

Retry logic: Inngest retries 3 times with exponential backoff. The `hasUsageCreditsApplied()` idempotency check prevents double-billing on retry.

### sendScheduledProjectDigests / sendScheduledWorkspaceDigests

```typescript
inngest.createFunction(
  { id: "send-scheduled-project-digests", retries: 1 },
  { cron: "TZ=UTC 0 * * * *" },   // top of every UTC hour
  async ({ step }) => {
    return step.run("send-due-project-digests", () => sendDueProjectDigests());
  }
);
```

**Why hourly?** `sendDueProjectDigests()` uses `isDigestDue()` to check each digest's timezone-local schedule. A user who configured "Monday 9 AM Tokyo" will have their digest sent when the UTC cron fires at 00:00 UTC on Monday (= 09:00 JST). The `lastSentAt` dedup guard prevents re-sending if the function fires multiple times.

**Registered in:** `app/api/inngest/route.ts`

```typescript
export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [processMeetingAudio, sendScheduledProjectDigests, sendScheduledWorkspaceDigests],
});
```

---

## 8. Production Deployment

### Infrastructure options

The repo contains Terraform configs for both AWS (ECS/Fargate) and GCP (Cloud Run). The Dockerfile builds a standalone Next.js image.

```dockerfile
# Multi-stage build
FROM node:20-alpine AS builder
WORKDIR /app
COPY . .
RUN npm ci && npm run build

FROM node:20-alpine AS runner
ENV NODE_ENV=production
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
CMD ["node", "server.js"]
```

### Database

PostgreSQL 15+ with connection pooling (PgBouncer or Prisma Data Proxy for serverless). Migrations via `prisma migrate deploy` in CI/CD.

Some models (e.g., `ProjectDigestSettings`, `WorkspaceMember`) were added via raw SQL migrations after the initial Prisma schema was frozen, and are accessed via a **type-cast delegate pattern**:

```typescript
const projectDigestDelegate = (prisma as typeof prisma & {
  projectDigestSettings: {
    findUnique: (...args: any[]) => Promise<any>;
    upsert: (...args: any[]) => Promise<any>;
    // ...
  };
}).projectDigestSettings;
```

This avoids regenerating the Prisma client for every schema addition while maintaining type safety at the call site.

### CI/CD

GitHub Actions pipeline (see `.github/workflows/`):
1. Lint + type-check (`tsc --noEmit`)
2. `prisma migrate deploy` against staging DB
3. Docker build + push to ECR / Artifact Registry
4. Deploy to ECS / Cloud Run

### Key production requirements

- `DATABASE_URL` — PostgreSQL connection string (with `?pgbouncer=true&connection_limit=1` for serverless)
- `NEXTAUTH_SECRET` — minimum 32-byte random string
- `NEXTAUTH_URL` — canonical origin (e.g., `https://app.voxly.ai`)
- `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` / `AWS_REGION` / `S3_BUCKET_NAME`
- `DEEPGRAM_API_KEY`
- `OPENAI_API_KEY`
- `RESEND_API_KEY` / `EMAIL_FROM`
- `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET` / `STRIPE_PRICE_*` env vars
- `INNGEST_EVENT_KEY` / `INNGEST_SIGNING_KEY`
- `NOTION_*` (optional, per-workspace via DB)
- `SLACK_*` (optional, per-workspace via DB)

---

## 9. Environment Variables

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | Yes | PostgreSQL connection URL |
| `NEXTAUTH_SECRET` | Yes | JWT signing secret |
| `NEXTAUTH_URL` | Yes | App origin URL |
| `AWS_ACCESS_KEY_ID` | Yes | S3 access key |
| `AWS_SECRET_ACCESS_KEY` | Yes | S3 secret |
| `AWS_REGION` | Yes | S3 region |
| `S3_BUCKET_NAME` | Yes | Primary audio bucket |
| `DEEPGRAM_API_KEY` | Yes | Deepgram transcription |
| `OPENAI_API_KEY` | Yes | OpenAI LLM |
| `GEMINI_API_KEY` | No | Fallback LLM |
| `LLM_PROVIDER` | No | `"openai"` (default) or `"gemini"` |
| `RESEND_API_KEY` | Yes | Email delivery |
| `EMAIL_FROM` | Yes | Sender address |
| `STRIPE_SECRET_KEY` | Yes | Stripe API key |
| `STRIPE_WEBHOOK_SECRET` | Yes | Stripe webhook signature |
| `STRIPE_PRICE_STARTER_MONTHLY` | Yes | Stripe price ID |
| `STRIPE_PRICE_PRO_MONTHLY` | Yes | Stripe price ID |
| `STRIPE_PRICE_TEAM_MONTHLY` | Yes | Stripe price ID |
| `INNGEST_EVENT_KEY` | Yes | Inngest event signing |
| `INNGEST_SIGNING_KEY` | Yes (prod) | Inngest webhook verification |
| `ADMIN_SECRET` | No | Admin API protection |
| `PROJECT_DIGEST_CRON_SECRET` | No | HTTP cron fallback auth |
| `WORKSPACE_DIGEST_CRON_SECRET` | No | HTTP cron fallback auth |

---

## 10. Interview Q&A

> Organized around the three resume bullets. Each section opens with the "walk me through" question an interviewer will most likely ask first, then drills into the specific claims made in the bullet.

---

### Bullet 1 — End-to-end async audio processing pipeline

**Q: Walk me through the audio processing pipeline from upload to structured summary.**

A: The browser POSTs the audio file to `/api/uploads`, which stores the raw file in S3 under a key structured as `{workspaceId}/{userId}/{timestamp}-{filename}` and immediately creates a `Transcription` row with `status: "uploaded"`. Then it fires an Inngest event (`voxly/audio.uploaded`) with the transcription ID and S3 key. The HTTP response returns right away — the heavy work is async.

Inngest picks up the event and runs `processMeetingAudio`, which calls `processUploadedAudio()`. That function:
1. Generates a 1-hour pre-signed S3 URL for Deepgram
2. Sends it to Deepgram nova-3 with speaker diarization enabled — gets back utterances with speaker labels and timestamps
3. Runs speaker-turn merging (`shouldMergeUtterances`) to produce clean paragraphs instead of sentence-per-line fragments
4. Calls the LLM twice: `formatTranscript()` (cleanup, non-critical) then `summarizeTranscript()` (extracts `decisions[]`, `keyPoints[]`, `nextSteps[]`, `actionItems[]` as typed JSON)
5. Saves everything to the DB and sets `status: "done"`

The client polls `GET /api/transcriptions` until status changes, then re-renders with the result.

---

**Q: Why use Inngest instead of just processing the audio synchronously in the upload API route?**

A: Three reasons. First, audio processing takes 30–120 seconds depending on file length — far beyond any HTTP timeout for a serverless function. Second, Inngest gives built-in retry with exponential backoff (3 retries) so transient Deepgram or OpenAI failures don't silently drop jobs. Third, the Inngest dashboard shows the full run history, step timelines, and error traces — much easier to debug than scanning CloudWatch logs for a failed background job.

---

**Q: You mentioned idempotency guards to prevent double-billing across retries. How does that work exactly?**

A: Before charging credits, `processUploadedAudio` calls `hasUsageCreditsApplied(transcriptionId)`, which checks whether a `CreditTransaction` row of type `"usage"` already exists for that transcription. If it does, the billing step is skipped entirely and the function proceeds to (re-)process. This means if Inngest retries after a crash mid-flight — say Deepgram succeeded but the DB write failed — the second attempt won't charge the user again. On top of that, credits are charged *after* processing succeeds, not before, and a `refundUsageCredits()` call is in the `catch` block so a failed run always restores the balance.

---

**Q: How does the dual-provider LLM work? What triggers the fallback?**

A: The LLM layer in `lib/llm/agent.ts` checks the `LLM_PROVIDER` environment variable. If it's `"gemini"`, all calls go to `gemini-2.5-flash`; otherwise they default to `gpt-4o-mini`. This is a deployment-time toggle, not a runtime fallback — you flip it when you want to switch providers globally, for example during an OpenAI outage or for cost experimentation. The `formatTranscript()` step additionally wraps its LLM call in `try/catch` with a fallback to the un-formatted readable transcript, so a model error there doesn't abort the whole pipeline.

---

**Q: What happens when Deepgram returns no utterances?**

A: `extractReadableTranscript()` has three fallback tiers: (1) speaker-turn utterances with timestamps — the richest format; (2) paragraph-formatted text from `channels[0].alternatives[0].paragraphs`; (3) raw flat transcript string. If all three are empty, a hard error is thrown, the transcription is marked `status: "error"`, and Inngest retries up to 3 times. Credits are refunded in the `catch` block via `refundUsageCredits()`.

---

**Q: What is speaker diarization and why does it matter here?**

A: Diarization is Deepgram's ability to detect and label different speakers in the audio. Each utterance comes back with a `speaker` index (`0`, `1`, `2`…) and a start timestamp. The output for a meeting then looks like `[0:32] Speaker 0: "We should prioritize the mobile redesign"` rather than a wall of undifferentiated text. This context is critical for the LLM summarization step — knowing who said what makes decisions, action items, and next steps far more accurate.

---

### Bullet 2 — Multi-tenant workspace architecture + AI features

**Q: Walk me through the multi-tenant workspace architecture.**

A: Every resource in the system — transcriptions, projects, tasks, insights, settings — has a `workspaceId` foreign key. There's no row-level security in Postgres; isolation is enforced at the application layer by a single function: `requireWorkspaceContext()`.

Every server component and API route calls it first. It reads the `voxly_workspace` cookie, verifies the authenticated user is an active `WorkspaceMember` of that workspace, and returns `{ activeWorkspace, role }`. From that point, every Prisma query includes `where: { workspaceId }`. If the cookie is stale or the membership was revoked, it falls back to the user's personal workspace — which every user gets on signup and which cannot be deleted.

Roles are `owner > admin > member > viewer`. Owner/admin can invite, remove members, and change settings. Members can upload and collaborate. Viewers are read-only.

---

**Q: Walk me through the invite flow.**

A: An owner or admin POSTs to `/api/workspaces/invites` with an email and role. The server creates a `WorkspaceInvite` row with a `token` (crypto random, unique), a 7-day `expiresAt`, and sends an email via Resend with a link to `/invite/[token]`. When the invitee visits that link — logged in or after signing up — the server validates the token hasn't expired or been revoked, creates a `WorkspaceMember` row with the specified role, and marks `acceptedAt`. The invite is single-use.

---

**Q: How does the AI chat assistant work? Walk me through a message being sent.**

A: When the user submits a message, the client fires two requests in parallel:

1. `POST /api/assistant` — receives the message plus the current `{ decisions, keyPoints, nextSteps, actionItems }` and may return an updated summary if the message is an edit command ("remove the second key point", "add a decision about X"). The UI applies the diff to the transcription state in-place.

2. `POST /api/assistant/chat` — receives the full conversation history (`AssistantMessage[]`) plus the same summary context, generates a natural language reply, and persists the new user + assistant messages as `AssistantMessage` rows in the DB.

Running both in parallel means the summary is updated and the chat reply arrives at the same time. History is loaded on page mount via `GET /api/assistant/chat?transcriptionId=` so conversations persist across sessions.

---

**Q: How does cross-recording semantic Q&A work?**

A: When the user asks a question at the project or workspace scope, the server loads all transcriptions in that scope and builds context chunks from each one: `splitTranscript()` breaks the transcript into paragraphs, `chunkTranscript()` creates overlapping 1,200-character chunks, and `flattenStrings()` extracts the structured fields (key points, decisions, etc.) as additional bullet-point chunks. Each chunk is scored against the user's question using TF-IDF-style keyword overlap — no vector embeddings. The top-k chunks are concatenated and sent to the LLM as context, which returns `{ answer, confidenceNote, sources[] }`. The sources list lets the UI show which recordings the answer drew from.

---

**Q: Why JWT sessions instead of database sessions?**

A: The app runs on ECS/Fargate or Cloud Run where many request-handling processes run simultaneously. Database sessions require a DB read on every authenticated request — at scale, that's a lot of overhead and a potential bottleneck if the connection pool is under pressure. JWT sessions are validated cryptographically with zero DB reads. The tradeoff is no server-side revocation, but there's no "log out all devices" requirement in this app and tokens have a short TTL, so it's acceptable.

---

### Bullet 3 — Credit billing, digest engine, and production infrastructure

**Q: Walk me through the credit-based billing system.**

A: Credits are the consumption unit — roughly one credit per minute of audio. There are three plan tiers (Starter $19/300 credits, Pro $49/1,200, Team $149/4,000) plus two one-time topup packs (100 or 500 credits). On upload, `ensureCreditsAvailableForProcessing()` checks the user's combined monthly + topup balance. If sufficient, processing starts and `applyUsageCredits()` creates a `CreditTransaction { type: "usage", amount: -N }` where N is derived from the audio duration. If processing fails, `refundUsageCredits()` creates a reversal transaction. Every credit event — monthly allotment, usage, topup, refund — is a row in `CreditTransaction`, so the history page is a complete audit trail.

Stripe handles the money. Subscriptions go through Stripe Checkout; monthly credits are granted on `invoice.paid` webhook events; topup packs are one-time checkout sessions. The webhook handler calls `stripe.webhooks.constructEvent()` with the raw request body (not parsed JSON) to verify the HMAC signature before processing anything.

---

**Q: How does the idempotency guard prevent double-billing on Inngest retries?**

A: Before charging, `processUploadedAudio` calls `hasUsageCreditsApplied(transcriptionId)`, which looks for an existing `CreditTransaction` row of type `"usage"` for that transcription. If one exists, the billing block is skipped. So if Inngest retries after a mid-flight crash — Deepgram succeeded, DB write failed — the second attempt reprocesses without charging again. This check runs before `ensureCreditsAvailableForProcessing()`, so it's the first thing evaluated on retry.

---

**Q: Walk me through how the timezone-aware digest engine works.**

A: Every `ProjectDigestSettings` row stores a `timezone` (IANA string like `"America/New_York"`), a `weekday` (0–6), an `hourLocal` (0–23), and a `lastSentAt` timestamp. An Inngest function fires at the top of every UTC hour (`cron: "TZ=UTC 0 * * * *"`). It calls `sendDueProjectDigests()`, which loads all enabled settings and runs each through `isDigestDue(settings, now)`.

`isDigestDue` uses `Intl.DateTimeFormat` to convert the current UTC instant into the user's local timezone parts (weekday, hour, day). If those match the configured schedule, it checks whether `lastSentAt` falls within the same zoned hour — if so, it already ran this window and skips. Otherwise it fires `sendProjectDigest()` and updates `lastSentAt`.

The key insight is that the function never computes "next fire time" and stores it. Instead, it asks "is now the right window?" every hour. This handles DST automatically — when clocks change, `Intl.DateTimeFormat` accounts for the offset change, and the check still works correctly.

---

**Q: What is the dedup guard and why do you need it even with a cron?**

A: Cron jobs are not guaranteed to fire exactly once. Inngest itself has `retries: 1` on the cron functions, meaning a transient failure could cause a second execution within the same hour. The `isSameZonedHour(lastSentAt, now, timezone)` check is the safety net: if `lastSentAt` is within the same timezone-local hour as `now`, `isDigestDue()` returns `false` and the send is skipped. Combined with the Inngest retry cap, even a pathological double-fire scenario won't send a duplicate email.

---

**Q: Walk me through the production infrastructure and CI/CD pipeline.**

A: The app is containerized using a two-stage Dockerfile — a `builder` stage runs `npm ci && npm run build` to produce a standalone Next.js output, then a minimal `runner` stage copies only the `.next/standalone` and `.next/static` artifacts. This keeps the final image small.

Terraform provisions the AWS infrastructure: ECS cluster, Fargate task definition, ALB, RDS PostgreSQL instance, S3 bucket, ECR repository, and IAM roles. Secrets are injected as ECS task environment variables from AWS Secrets Manager.

The GitHub Actions CI/CD pipeline runs in four steps: (1) lint + `tsc --noEmit` type check, (2) `prisma migrate deploy` against the target DB, (3) Docker build and push to ECR, (4) ECS service update to roll out the new task definition. The migration step runs before the deploy step so the new schema is always in place before the new code reaches it — this avoids the window where new code tries to query columns that don't exist yet.

---

**Q: How do you handle database schema changes that aren't in the generated Prisma client?**

A: Some models were added via raw SQL migrations after the initial schema was locked — regenerating the Prisma client on every schema addition would have required updating dozens of type references. Instead, those models are accessed via a type-cast delegate pattern:

```typescript
const projectDigestDelegate = (prisma as typeof prisma & {
  projectDigestSettings: {
    findUnique: (...args: any[]) => Promise<any>;
    upsert:     (...args: any[]) => Promise<any>;
    update:     (...args: any[]) => Promise<any>;
    findMany:   (...args: any[]) => Promise<any[]>;
  };
}).projectDigestSettings;
```

The cast is done once per module and the delegate is used everywhere. The `any` types at the boundary are intentional — the call sites still receive typed results because the return shapes are known. It's a pragmatic tradeoff: slightly weaker types at the persistence layer in exchange for not needing a full Prisma client regeneration cycle for every schema addition.

---

**Q: How are API routes protected against unauthorized access?**

A: Two layers. First, every state-mutating route calls `enforceSameOrigin(request)`, which compares the `Origin` or `Referer` header against `NEXTAUTH_URL` to block cross-origin requests. Second, `requireWorkspaceContext()` validates both authentication (valid JWT via NextAuth) and authorization (active workspace membership) before any business logic runs. The S3 bucket is private — all file reads require a server-generated pre-signed URL that's scoped to the requesting user's workspace.

---

*Last updated: April 2026*
