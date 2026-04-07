# Propel Career — Product Requirements Document

**Version:** 1.0  
**Date:** April 2026  
**Status:** Approved for Development

---

## 1. Product Overview

Propel Career is a web application that helps job seekers optimise their resumes for specific job descriptions. Users upload a PDF resume, paste a job description, and receive an AI-powered ATS (Applicant Tracking System) match score along with targeted wording suggestions. Accepted suggestions are applied and the result is exported as a polished PDF.

### 1.1 Core Value Proposition

- Instant ATS match analysis against any job description
- AI-generated, specific wording suggestions (not generic advice)
- One-click PDF export with accepted changes applied
- Pay-per-use credits — no subscription, no commitment

### 1.2 Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 15 (App Router) + TypeScript |
| Styling | Tailwind CSS + shadcn/ui |
| AI | Claude API (default) · OpenAI (swappable via env var) |
| Authentication | Clerk (email + Google OAuth, email confirmation enforced) |
| Payments | Stripe Checkout (one-time credit packs) |
| Database | PostgreSQL via Prisma ORM |
| PDF Parsing | pdf-parse |
| PDF Generation | @react-pdf/renderer |

---

## 2. User Roles & Permissions

The system has three distinct roles. Each role has a strictly bounded set of accessible pages and actions.

### 2.1 Guest (unauthenticated)

| Access | Detail |
|---|---|
| Landing page | ✅ Full access |
| Sign In / Sign Up | ✅ Full access |
| API Docs (`/api-docs`) | ✅ Full access |
| All other pages | ❌ Redirected to `/sign-in` |

### 2.2 Regular User (authenticated, email confirmed)

| Access | Detail |
|---|---|
| Resume analysis flow (`/analyze`) | ✅ — free tier (4 steps) or paid tier (5 steps) based on credit balance |
| My Account (`/account`) | ✅ — credit balance, usage history, alerts |
| Pricing (`/pricing`) | ✅ — view and purchase credit packs |
| Payment Success (`/payment-success`) | ✅ |
| API Docs (`/api-docs`) | ✅ |
| Admin Dashboard (`/admin`) | ❌ — forbidden |

### 2.3 Admin (authenticated, `role: "admin"` in Clerk metadata)

| Access | Detail |
|---|---|
| Admin Dashboard (`/admin`) | ✅ — full access |
| Resume analysis flow | ❌ — admins cannot use resume services |
| Pricing / credit purchase | ❌ — admins cannot buy credits |
| My Account | ❌ — no personal account page |
| API Docs (`/api-docs`) | ✅ |

> Admin accounts are operational accounts only. They exist solely to manage users and monitor platform health.

---

## 3. Authentication & Onboarding

### 3.1 Sign Up Flow

1. User clicks **"Try Free - Sign Up"** on the landing page
2. Clerk sign-up form collects name, email, and password (Google OAuth also available)
3. Clerk sends a confirmation email
4. User clicks the confirmation link → redirected to `/analyze`
5. All protected routes remain inaccessible until email is confirmed

### 3.2 Sign In Flow

1. User visits `/sign-in` or is redirected there from a protected route
2. Clerk sign-in form (email/password or Google OAuth)
3. On success → redirected to `/analyze`

### 3.3 Sign Out

- Accessible from the avatar dropdown in the Navbar (`<UserButton afterSignOutUrl="/" />`)
- On sign-out → redirected to the landing page

### 3.4 Route Protection

| Route Pattern | Protection |
|---|---|
| `/analyze(.*)` | Clerk auth required |
| `/account(.*)` | Clerk auth required |
| `/pricing` | Clerk auth required |
| `/payment-success` | Clerk auth required |
| `/admin(.*)` | Clerk auth + admin role check |
| `/api/*` (except `/api/docs`, `/api/stripe/webhook`) | Clerk auth required |
| `/`, `/sign-in`, `/sign-up`, `/api-docs`, `/api/docs` | Public |

---

## 4. Tier Model & Credit System

### 4.1 Free Tier

- Available to every signed-up user at no cost
- No credits required
- Full upload and analysis flow runs (steps 1–4)
- **Step 4 results are restricted:** only the match category label is shown (Low / Medium / High / Excellent); exact score, keyword breakdown, and suggestions are blurred with an upsell overlay
- Step 5 (PDF download) is not available
- Upsell overlay CTA: **"Unlock Full Results → Buy Credits"** → `/pricing`

### 4.2 Paid Tier

- Active when the user's credit balance is ≥ 1
- Each successful `POST /api/analyze-match` call deducts exactly 1 credit
- Full 5-step flow with unrestricted results

### 4.3 Match Category Labels

| Category | Score Range | Badge Colour |
|---|---|---|
| Low | 0 – 49% | Red |
| Medium | 50 – 69% | Orange |
| High | 70 – 79% | Yellow |
| Excellent | 80 – 100% | Green |

---

## 5. Credit Packs & Pricing

| Pack | Credits | Price | Per-Analysis Cost |
|---|---|---|---|
| Free Preview | — | $0.00 | Category label only |
| Starter | 10 | $2.99 | $0.30 |
| Pro | $4.80 | 20 | $0.24 (save 20%) |

- Payments are one-time (not recurring subscriptions)
- Processed via Stripe Checkout (hosted payment page)
- Credits are added instantly via Stripe webhook on `checkout.session.completed`
- Credits never expire

### 5.1 Credit Balance Alerts

Two global thresholds configurable via environment variables:

| Threshold | Default | Behaviour |
|---|---|---|
| `CREDIT_REMINDER_THRESHOLD` | 3 | Yellow banner + yellow Navbar badge when credits ≤ this |
| `CREDIT_WARNING_THRESHOLD` | 1 | Red banner + red Navbar badge when credits ≤ this |

Alert banner appears on `/analyze` and `/account`. Includes a **"Buy Credits →"** link to `/pricing`.

When credits reach 0: user remains in the free tier UI (no hard block or redirect).

---

## 6. Resume Analysis Flow (`/analyze`)

A multi-step Client Component (`AnalyzeFlow`) driven by a `useReducer` state machine.

### 6.1 Step 1 — Upload Resume

- Drag-and-drop PDF uploader (`react-dropzone`)
- Accepts PDF files only
- Server-side magic-byte validation (`buffer[0] === 0x25 && buffer[1] === 0x50`)
- On upload: calls `POST /api/parse-resume` → stores extracted text in state
- Shows filename and file size on success

### 6.2 Step 2 — Job Description

- Full-width textarea for pasting the job description
- Minimum 50 characters required
- **"Analyze Match"** button: triggers parallel API calls in step 3

### 6.3 Step 3 — Analyzing

- Loading screen with progressive status indicators
- Fires `POST /api/analyze-match` and `POST /api/suggest-improvements` in `Promise.all` (parallel, not sequential)
- Shows animated progress: resume extracted → JD parsed → AI analysis running → finalising

### 6.4 Step 4 — Results (conditional on tier)

**Free tier (`hasPaid === false`):**
- `MatchCategoryBadge` — large category label (e.g. "HIGH MATCH"), score range (e.g. "Score range: 70%–80%"), colour-coded border
- Score section: blurred + locked overlay
- Keyword breakdown section: blurred + locked overlay
- Suggestions section: blurred + locked overlay
- Upsell overlay card with gradient background: "Unlock Full Results → Buy Credits" → `/pricing`
- Step 5 button hidden

**Paid tier (`hasPaid === true`):**
- ATS score gauge (0–100), colour-coded: red <50, orange 50–69, yellow 70–79, green 80+
- Matched keywords (green tags) + missing keywords (red tags)
- 8–12 AI wording suggestion cards, each showing:
  - Resume section label
  - Before / After text diff
  - Reason (which JD keywords are being addressed)
  - Accept / Reject toggle (default: accepted)
- "Generate Resume" button enabled

### 6.5 Step 5 — Download (paid tier only)

- Calls `POST /api/generate-resume` with accepted suggestions
- Browser downloads the generated PDF via `URL.createObjectURL(blob)`
- Shows remaining credit balance

### 6.6 Step Indicator

- Displays progress at the top of the page
- Free tier: 4 steps (Upload → Job Description → Analyzing → Results)
- Paid tier: 5 steps (+ Download)

---

## 7. Pages & Screens

### 7.1 Landing Page (`/`)

- Hero section with value proposition
- **Signed-out CTAs:** "Try Free - Sign Up" (primary) → `/sign-up`; "Sign In" (secondary) → `/sign-in`
- **Signed-in user CTA:** "Go to Dashboard" → `/analyze`
- **Signed-in admin CTA:** "Go to Admin Dashboard" → `/admin`
- Feature highlights section (match scoring, AI suggestions, PDF export)

### 7.2 Pricing Page (`/pricing`)

Three-column layout:

| Column | Plan | CTA |
|---|---|---|
| 1 | Free Preview ($0) | "Try Free Now →" → `/analyze` |
| 2 | Starter (10cr · $2.99) | "Buy Starter Pack →" → Stripe Checkout |
| 3 (featured) | Pro (20cr · $4.80) | "Buy Pro Pack →" → Stripe Checkout |

Feature comparison table (rows: match category, exact score, keyword breakdown, suggestions, PDF download).

### 7.3 Payment Success Page (`/payment-success`)

- Reads `?session_id` from URL
- Shows: credits added, pack name, amount charged
- CTAs: "Start Analyzing →" (`/analyze`) and "View My Account" (`/account`)

### 7.4 My Account Page (`/account`)

- Credit status banner (if reminder or warning threshold breached)
- Stat cards: Credit Balance, Analyses Run (all time), Total Credits Purchased
- Usage history table: Feature (human-readable), Date, Credits Used
- Purchase history table: Pack, Date, Amount
- Quick actions: "Start New Analysis", "Buy More Credits"

Feature label mapping (used in usage history):

| API feature key | Human label |
|---|---|
| `analyze-match` | Resume Analysis |
| `suggest-improvements` | Suggestions |
| `parse-resume` | Resume Upload |
| `generate-resume` | PDF Generation |

### 7.5 Navbar

- **Guest:** Logo + "Sign In" button
- **Regular user:** Logo + nav links (Dashboard, My Account, Pricing, API Docs) + credit badge (colour-coded) + avatar dropdown (My Account, Buy Credits, Sign Out)
- **Admin:** Logo + "🛡 Admin Dashboard" nav link + avatar with red "ADMIN" badge + dropdown (Admin Dashboard, Sign Out only — no My Account or Buy Credits)

### 7.6 Admin Dashboard (`/admin`)

Tabbed layout with four views. Only accessible to users with `role: "admin"` in Clerk metadata.

#### Tab 1 — Overview

- 4 stat cards: Total Revenue (green), Total LLM Cost (red), Gross Margin (blue), Total Analyses (grey)
- Revenue breakdown table: pack, sales count, revenue
- LLM cost breakdown table: model, calls, token counts, cost

#### Tab 2 — Usage & Costs

- Feature usage table: feature name, call count, average latency, success rate
- LLM token and cost detail table: provider, model, operation, input tokens, output tokens, cost in USD

#### Tab 3 — User Management

- Searchable user table: email, credit balance, tier (Free/Paid), join date, last active date
- **"Edit Credits"** button per user row → expands an inline editor row showing current credits and a numeric input
- **Save Changes:** updates credit balance and creates an audit log entry; shows 3-second confirmation flash
- **Cancel:** collapses the editor without saving
- Export CSV button (cosmetic in v1)

#### Tab 4 — Audit Log

- Immutable log of all admin actions, newest first
- Columns: Timestamp, Admin email, Action type (Credit Update / Account View), Target user, Details
- "Credit Update" entries shown with a yellow tag; "Account View" with a grey tag
- All admin actions are recorded automatically on execution
- Entries cannot be modified or deleted
- Export Log button (cosmetic in v1)

---

## 8. API Routes

All routes require `export const runtime = "nodejs"` (pdf-parse and @react-pdf/renderer require Node.js runtime).

### 8.1 Resume Routes

| Method | Path | Auth | Input | Output |
|---|---|---|---|---|
| POST | `/api/parse-resume` | User | `FormData` with `resume` (PDF) | `{ text: string, fileName: string }` |
| POST | `/api/generate-resume` | User (paid) | `{ resumeText, acceptedSuggestions[] }` | PDF binary stream |

### 8.2 Analysis Routes

| Method | Path | Auth | Input | Output | Notes |
|---|---|---|---|---|---|
| POST | `/api/analyze-match` | User | `{ resumeText, jobDescription }` | `MatchAnalysis` | Deducts 1 credit; returns `402` if balance = 0 |
| POST | `/api/suggest-improvements` | User | `{ resumeText, jobDescription }` | `{ suggestions[] }` | Presence-check only (no deduction); returns `402` if balance = 0 |

### 8.3 Stripe Routes

| Method | Path | Auth | Input | Output |
|---|---|---|---|---|
| POST | `/api/stripe/checkout` | User | `{ packId: "starter" \| "pro" }` | `{ url: string }` |
| POST | `/api/stripe/webhook` | Public (Stripe-signed) | Raw Stripe event | `{ received: true }` |

### 8.4 User Routes

| Method | Path | Auth | Output |
|---|---|---|---|
| GET | `/api/user/credits` | User | `{ credits: number }` |
| GET | `/api/user/account` | User | `{ credits, status, thresholds, creditsUsed, recentUsage[] }` |
| GET | `/api/user/usage` | User | `{ events[] }` (last 50, with nested `llmUsage`) |

### 8.5 Admin Routes

| Method | Path | Auth | Output |
|---|---|---|---|
| GET | `/api/admin/usage` | Admin only | `{ featureStats[], llmStats[] }` |

### 8.6 Documentation Routes

| Method | Path | Auth | Output |
|---|---|---|---|
| GET | `/api/docs` | Public | OpenAPI 3.0 JSON spec |

---

## 9. AI Integration

### 9.1 Provider Abstraction

The AI layer is abstracted behind an `AIProvider` interface. The active provider is resolved at module load via the `AI_PROVIDER` environment variable (`"claude"` or `"openai"`). Switching providers requires only an env var change — no code changes.

### 9.2 Claude Implementation

- Uses tool-calling for structured output (never free-text JSON parsing)
- `tool_choice: { type: "tool" }` forces structured response
- Temperature: 0 for `analyzeMatch`, 0.3 for `suggestImprovements`
- Default model: `claude-opus-4-6` (overridable via `AI_MODEL` env var)

### 9.3 OpenAI Implementation

- Uses `zodResponseFormat` with `client.responses.parse()` for structured output

### 9.4 analyzeMatch Scoring Criteria

| Dimension | Weight |
|---|---|
| Keyword match (specific tech, tools, certs) | 40% |
| Role / seniority level alignment | 25% |
| Responsibility overlap | 25% |
| Resume completeness | 10% |

Calibration: 70+ = genuinely competitive; most resumes score 30–60 before optimisation. Generic soft skills excluded.

### 9.5 suggestImprovements Rules

- 8–12 suggestions maximum, ordered by impact
- `original` must be verbatim text from the resume
- `suggested` must be a direct drop-in replacement
- Must never fabricate experience or skills
- Each `reason` must name the specific JD keywords being addressed

### 9.6 Token Usage Tracking

Both providers return token counts natively. Every AI call wraps the response in `AIResult<T>`:

```typescript
interface AIResult<T> {
  data: T;
  usage: { inputTokens, outputTokens, model, provider };
}
```

---

## 10. Data Model

### 10.1 Tables

**User**
| Column | Type | Notes |
|---|---|---|
| id | String (PK) | Clerk userId |
| email | String (unique) | |
| credits | Int | Default 0 |
| createdAt | DateTime | |

**Purchase**
| Column | Type | Notes |
|---|---|---|
| id | String (PK) | cuid |
| userId | String (FK → User) | |
| stripeSessionId | String (unique) | |
| creditsAdded | Int | |
| amountPaid | Int | In cents |
| createdAt | DateTime | |

**UsageEvent**
| Column | Type | Notes |
|---|---|---|
| id | String (PK) | cuid |
| userId | String (FK → User) | |
| feature | String | `parse-resume` \| `analyze-match` \| `suggest-improvements` \| `generate-resume` |
| statusCode | Int | HTTP response code |
| durationMs | Int | Wall-clock ms |
| createdAt | DateTime | |

**LlmUsage**
| Column | Type | Notes |
|---|---|---|
| id | String (PK) | cuid |
| usageEventId | String (unique FK → UsageEvent) | One-to-one |
| provider | String | `claude` \| `openai` |
| model | String | e.g. `claude-opus-4-6`, `gpt-4o` |
| operation | String | `analyzeMatch` \| `suggestImprovements` |
| inputTokens | Int | |
| outputTokens | Int | |
| totalTokens | Int | inputTokens + outputTokens |
| costUsdMicros | Int | Cost in millionths of USD (avoids float rounding) |
| createdAt | DateTime | |

### 10.2 Cost Calculation

`costUsdMicros / 1_000_000 = USD`. Always stored as integers. Never use floats for monetary values.

| Model | Input (per 1M tokens) | Output (per 1M tokens) |
|---|---|---|
| claude-opus-4-6 | $15.00 | $75.00 |
| claude-sonnet-4-6 | $3.00 | $15.00 |
| gpt-4o | $5.00 | $15.00 |
| gpt-4o-mini | $0.15 | $0.60 |

---

## 11. Usage Tracking

Every API route handler logs a `UsageEvent` record. Routes that call an LLM also log a linked `LlmUsage` record.

| Route | UsageEvent | LlmUsage |
|---|---|---|
| `parse-resume` | ✅ | ❌ |
| `analyze-match` | ✅ | ✅ |
| `suggest-improvements` | ✅ | ✅ |
| `generate-resume` | ✅ | ❌ |

Tracking is **fire-and-forget** — calls are always `void`-ed and never `await`-ed in the request handler. A database write failure must never break the API response.

---

## 12. Admin Dashboard Requirements

### 12.1 Access Control

- Accessible at `/admin`
- Requires Clerk authentication + `publicMetadata.role === "admin"` (set in Clerk Dashboard)
- Backend routes (`GET /api/admin/usage`) enforce the same admin role check server-side
- Admins cannot access `/analyze`, `/pricing`, `/payment-success`, or `/account`

### 12.2 Overview Tab

Must display:
- Total revenue from all credit pack purchases (sum of `Purchase.amountPaid`)
- Total LLM cost (sum of `LlmUsage.costUsdMicros` converted to USD)
- Gross margin percentage (`(revenue - cost) / revenue × 100`)
- Total analyses run (count of `UsageEvent` where feature = `analyze-match`)
- Revenue breakdown by pack (Starter vs Pro: sales count + revenue)
- LLM cost breakdown by model (call count + token volumes + cost)

### 12.3 Usage & Costs Tab

Must display:
- Per-feature call count, average latency (ms), and success rate
- Per-model, per-operation: input tokens, output tokens, and cost in USD

### 12.4 User Management Tab

Must display:
- All registered users with: email, current credit balance, tier (Free/Paid), join date, last active date
- Search/filter by email
- **Edit Credits action per user:**
  - Admin enters a new credit value (integer ≥ 0)
  - On save: credit balance is updated in the `User` table
  - An `AdminAuditLog` entry is created automatically (see §12.5)
  - Confirmation feedback shown to the admin

### 12.5 Audit Log Tab

**All admin actions must be logged.** An `AdminAuditLog` table records every action:

| Column | Type | Notes |
|---|---|---|
| id | String (PK) | cuid |
| adminUserId | String | Clerk userId of the admin who performed the action |
| adminEmail | String | Denormalised for readability |
| action | String | `Credit Update` \| `Account View` |
| targetUserId | String | Affected user's Clerk userId |
| targetEmail | String | Denormalised for readability |
| detail | String | Human-readable description (e.g. "5 → 7 credits") |
| createdAt | DateTime | |

Requirements:
- Entries are immutable — no update or delete permitted
- Log is displayed newest-first
- Action types displayed as colour-coded tags (yellow = Credit Update, grey = Account View)
- Export to CSV (v1: cosmetic button; v2: functional)

---

## 13. OpenAPI / Swagger Documentation

- OpenAPI 3.0 spec auto-generated from Zod schemas via `@asteasolutions/zod-to-openapi`
- Spec served at `GET /api/docs` (public, force-static at build time)
- Swagger UI rendered at `/api-docs` (public, loaded via `next/dynamic` with `ssr: false`)

Documented endpoints (minimum):

| Tag | Method | Path |
|---|---|---|
| Resume | POST | `/api/parse-resume` |
| Resume | POST | `/api/generate-resume` |
| Analysis | POST | `/api/analyze-match` |
| Analysis | POST | `/api/suggest-improvements` |
| Stripe | POST | `/api/stripe/checkout` |
| Stripe | POST | `/api/stripe/webhook` |
| User | GET | `/api/user/credits` |
| User | GET | `/api/user/account` |
| User | GET | `/api/user/usage` |
| Admin | GET | `/api/admin/usage` |

---

## 14. Non-Functional Requirements

### 14.1 Performance

- `analyzeMatch` and `suggestImprovements` are called in `Promise.all` (parallel), not sequentially
- Usage tracking never blocks API responses (fire-and-forget)
- Navbar credit count read via direct Prisma call (no extra HTTP round-trip)

### 14.2 Security

- All API routes validate input with Zod before processing
- PDF uploads validated via magic bytes server-side (not just file extension)
- Stripe webhook signature verified with `constructEvent` before processing any event
- Admin role enforced server-side (not just client-side UI hiding)
- All protected routes checked via Clerk middleware

### 14.3 Data Integrity

- Credit deduction uses atomic Prisma update (`decrement: 1`) to prevent race conditions
- Stripe `stripeSessionId` is unique — prevents duplicate credit grants from replayed webhooks
- Cost stored as integer micros — no floating-point monetary values anywhere

### 14.4 Error Handling

- `402 Payment Required` returned when credits < 1 on analysis routes
- `401 Unauthorized` returned on all protected routes without valid Clerk session
- `403 Forbidden` returned on admin routes when caller lacks admin role
- `400 Bad Request` returned for invalid PDF uploads

### 14.5 Runtime Requirements

- All routes touching `pdf-parse` or `@react-pdf/renderer` must declare `export const runtime = "nodejs"`
- `canvas` webpack alias set to `false` in `next.config.ts` to prevent `pdf-parse` build errors
- `swagger-ui-react` loaded via `next/dynamic` with `ssr: false` to prevent SSR crashes

---

## 15. Environment Variables

| Variable | Required | Description |
|---|---|---|
| `AI_PROVIDER` | Yes | `"claude"` or `"openai"` |
| `ANTHROPIC_API_KEY` | If claude | Claude API key |
| `OPENAI_API_KEY` | If openai | OpenAI API key |
| `AI_MODEL` | No | Override default model (default: `claude-opus-4-6`) |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Yes | Clerk publishable key |
| `CLERK_SECRET_KEY` | Yes | Clerk secret key |
| `NEXT_PUBLIC_CLERK_SIGN_IN_URL` | Yes | `/sign-in` |
| `NEXT_PUBLIC_CLERK_SIGN_UP_URL` | Yes | `/sign-up` |
| `NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL` | Yes | `/analyze` |
| `NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL` | Yes | `/analyze` |
| `STRIPE_SECRET_KEY` | Yes | Stripe server-side key |
| `STRIPE_WEBHOOK_SECRET` | Yes | Stripe webhook signing secret |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Yes | Stripe client-side key |
| `STRIPE_PRICE_10_CREDITS` | Yes | Stripe Price ID for Starter pack |
| `STRIPE_PRICE_20_CREDITS` | Yes | Stripe Price ID for Pro pack |
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `NEXT_PUBLIC_APP_URL` | Yes | Base URL (e.g. `http://localhost:3000`) |
| `CREDIT_REMINDER_THRESHOLD` | No | Default: `3` |
| `CREDIT_WARNING_THRESHOLD` | No | Default: `1` |

---

## 16. Out of Scope (v1)

The following are explicitly excluded from the initial release:

- Subscription / recurring billing model
- Resume template selection
- Cover letter generation
- Email notifications (beyond Clerk's built-in confirmation email)
- Multi-language support
- Mobile native app
- Admin CSV export (button present but non-functional)
- Admin analytics charts / graphs (tables only)
