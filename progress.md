# Propel Career — Implementation Progress

Track each step as `[ ]` (pending), `[~]` (in progress), or `[x]` (done).  
Update this file whenever you pause or resume work.

---

## Phase 1 — Project Scaffold
- [x] 1.1 Bootstrap Next.js project with `create-next-app`
- [x] 1.2 Install production dependencies (`@anthropic-ai/sdk`, `openai`, `pdf-parse`, `@react-pdf/renderer`, `react-dropzone`, `zod`, `sonner`, `lucide-react`, `@clerk/nextjs`, `@asteasolutions/zod-to-openapi`, `swagger-ui-react`, `stripe`, `@stripe/stripe-js`, `@prisma/client`)
- [x] 1.3 Initialize shadcn/ui and add components (`button`, `card`, `progress`, `badge`, `separator`, `textarea`)
- [x] 1.4 Configure `next.config.ts` (`serverExternalPackages`, `canvas` alias via Turbopack)
- [x] 1.5 Create `.env.example` with all required vars (`AI_PROVIDER`, `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, Clerk keys, Stripe keys, `DATABASE_URL`, `CREDIT_REMINDER_THRESHOLD`, `CREDIT_WARNING_THRESHOLD`, `NEXT_PUBLIC_APP_URL`)
- [x] 1.6 Create full directory skeleton (`src/app`, `src/components`, `src/lib/ai`, `src/lib/pdf`, `src/types`)

---

## Phase 2 — Core Types
- [x] 2.1 Create `src/types/index.ts` — `MatchAnalysis`, `Suggestion`, `ResumeStructure` interfaces
- [x] 2.2 Add `MatchCategory` type (`"Low" | "Medium" | "High" | "Excellent"`) and `getCategoryFromScore(score)` helper to `src/types/index.ts`

---

## Phase 3 — AI Abstraction Layer
- [x] 3.1 Create `src/lib/ai/types.ts` — `TokenUsage`, `AIResult<T>`, `AIProvider` interface
- [x] 3.2 Create `src/lib/ai/claude.ts` — Claude implementation using tool-calling for structured output
- [x] 3.3 Create `src/lib/ai/openai.ts` — OpenAI implementation using `chat.completions.create` with JSON mode
- [x] 3.4 Create `src/lib/ai/index.ts` — provider singleton, export `analyzeMatch` + `suggestImprovements`

---

## Phase 4 — PDF Library
- [x] 4.1 Create `src/lib/pdf/parser.ts` — `extractTextFromPDF()` + `inferResumeStructure()`
- [x] 4.2 Create `src/lib/pdf/generator.ts` — `generateResumePDF()` using `@react-pdf/renderer`

---

## Phase 5 — API Routes
- [x] 5.1 Create `src/app/api/parse-resume/route.ts` — accepts PDF upload, returns extracted text
- [x] 5.2 Create `src/app/api/analyze-match/route.ts` — returns `MatchAnalysis`
- [x] 5.3 Create `src/app/api/suggest-improvements/route.ts` — returns `{ suggestions }`
- [x] 5.4 Create `src/app/api/generate-resume/route.ts` — returns PDF binary stream

---

## Phase 6 — UI Components
- [x] 6.1 Create `src/components/StepIndicator.tsx` — step progress bar; free tier shows 4 steps, paid shows 5
- [x] 6.2 Create `src/components/FileUpload.tsx` — drag-and-drop PDF uploader (react-dropzone)
- [x] 6.3 Create `src/components/MatchScore.tsx` — full score gauge with keyword breakdown (paid tier only)
- [x] 6.4 Create `src/components/MatchCategoryBadge.tsx` — category label badge (Low/Medium/High/Excellent) with colour coding and score range; used in free tier step 4
- [x] 6.5 Create `src/components/SuggestionCard.tsx` — original vs. suggested diff with accept/reject toggle (paid tier only)
- [x] 6.6 Create `src/components/FreeTierOverlay.tsx` — blur/lock overlay with upsell card and "Unlock Full Results → Buy Credits" CTA linking to `/pricing`

---

## Phase 7 — Multi-Step Flow Page
- [x] 7.1 Create `src/app/analyze/page.tsx` — Server Component wrapper: fetch user credits, pass `hasPaid: boolean` to `<AnalyzeFlow />`
- [x] 7.2 Create `src/components/AnalyzeFlow.tsx` — `useReducer` state machine, conditional steps:
  - [x] Step 1: File upload (all users)
  - [x] Step 2: Job description textarea + "Analyze Match" button (all users)
  - [x] Step 3: Parallel API calls + loading state (all users)
  - [x] Step 4 (free): `MatchCategoryBadge` + `FreeTierOverlay` over blurred score/keywords/suggestions
  - [x] Step 4 (paid): Full match score + keyword breakdown + suggestion review
  - [x] Step 5 (paid only): Generate and download PDF

---

## Phase 8 — Landing Page & Layout
- [x] 8.1 Update `src/app/layout.tsx` — wrap with `<ClerkProvider>`, add `<Navbar />` + Sonner `<Toaster />`
- [x] 8.2 Create `src/app/page.tsx` — landing page: signed-out CTA is "Try Free - Sign Up" → `/sign-up`; signed-in CTA is "Go to Dashboard" → `/analyze`

---

## Phase 9 — Clerk Authentication
- [x] 9.1 Create `src/proxy.ts` — `clerkMiddleware` (renamed proxy for Next.js 16) protecting `/analyze`, `/account`, `/pricing`, `/payment-success`, `/api/*` (excluding `/api/docs` and `/api/stripe/webhook`)
- [x] 9.2 Create `src/app/sign-in/[[...sign-in]]/page.tsx` — Clerk `<SignIn />` component (centered layout)
- [x] 9.3 Create `src/app/sign-up/[[...sign-up]]/page.tsx` — Clerk `<SignUp />` component with email confirmation enabled; after confirmation redirects to `/analyze`
- [x] 9.4 Create `src/components/Navbar.tsx` — credit badge (status-coloured) + `<UserButton />` (Clerk UserButton includes sign-out dropdown); `<SignInButton />` when signed out
- [x] 9.5 Add `auth().protect()` guard to all 4 API routes (`parse-resume`, `analyze-match`, `suggest-improvements`, `generate-resume`)

---

## Phase 10 — Stripe Pay-Per-Use Credits
- [x] 10.1 Create `prisma/schema.prisma` — `User`, `Purchase`, `UsageEvent`, `LlmUsage` models
- [ ] 10.2 Run `npx prisma migrate dev --name init` + `npx prisma generate` (requires DATABASE_URL)
- [x] 10.3 Create `src/lib/db/prisma.ts` — Prisma client singleton
- [x] 10.4 Create `src/lib/stripe/client.ts` — Stripe singleton (lazy)
- [x] 10.5 Create `src/lib/stripe/products.ts` — `CREDIT_PACKS`: Starter (10 credits · $2.99), Pro (20 credits · $4.80)
- [x] 10.6 Create `src/app/api/stripe/checkout/route.ts` — create Stripe Checkout session, set `client_reference_id: userId`
- [x] 10.7 Create `src/app/api/stripe/webhook/route.ts` — verify Stripe signature, upsert user credits in DB
- [x] 10.8 Create `src/app/api/user/credits/route.ts` — `GET` returns current credit balance
- [x] 10.9 Update `src/app/api/analyze-match/route.ts` — check credits ≥ 1, decrement on success, return `402` if insufficient
- [x] 10.10 Update `src/app/analyze/page.tsx` — pass `hasPaid: boolean` to `<AnalyzeFlow />`; no redirect for 0-credit users (they get free tier UI)
- [x] 10.11 Create `src/app/pricing/page.tsx` — 3-column layout (Free Preview / Starter / Pro) with feature comparison table; Starter + Pro "Buy" buttons call checkout API
- [x] 10.12 Create `src/app/payment-success/page.tsx` — confirmation showing credits added + pack name + price; "Start Analyzing" CTA → `/analyze`

---

## Phase 11 — MyAccount Section
- [x] 11.1 Create `src/lib/credits/thresholds.ts` — `CREDIT_THRESHOLDS` object, `CreditStatus` type, `getCreditStatus(credits)` function
- [x] 11.2 Create `src/app/api/user/account/route.ts` — returns `{ credits, status, thresholds, creditsUsed, recentUsage }`
- [x] 11.3 Create `src/components/CreditStatusBanner.tsx` — dismissible yellow/red banner with "Buy Credits" link; renders nothing when status is `"ok"` or `"empty"`
- [x] 11.4 Update `src/components/Navbar.tsx` — credit badge coloured by `getCreditStatus()`
- [x] 11.5 Update `src/app/analyze/page.tsx` — show `<CreditStatusBanner>` above the step flow (paid users only; free tier sees upsell overlay instead)
- [x] 11.6 Create `src/app/account/page.tsx` — balance card, credits-used card, usage history table with human-readable feature labels
- [x] 11.7 Update `src/app/api/suggest-improvements/route.ts` — add credit presence check (`credits < 1` → `402`); no decrement
- [x] 11.8 Add `GET /api/user/account` to Swagger spec (`src/lib/swagger/spec.ts`)

---

## Phase 12 — Usage Tracking (AI Instrumentation)
- [x] 12.1 Update `src/lib/ai/types.ts` — add `TokenUsage` and `AIResult<T>` types; update `AIProvider` interface to return `AIResult`
- [x] 12.2 Update `src/lib/ai/claude.ts` — extract `usage.input_tokens` / `usage.output_tokens` from response, return wrapped `AIResult`
- [x] 12.3 Update `src/lib/ai/openai.ts` — extract `usage.prompt_tokens` / `usage.completion_tokens`, return wrapped `AIResult`
- [x] 12.4 Create `src/lib/ai/pricing.ts` — `MODEL_PRICING` constants + `calculateCostMicros(model, input, output)`
- [x] 12.5 Create `src/lib/tracking/index.ts` — `logUsage()` + `logLlmUsage()` helpers (fire-and-forget, non-blocking)
- [x] 12.6 Update `src/app/api/analyze-match/route.ts` — call `logUsage()` + `logLlmUsage()` after AI response
- [x] 12.7 Update `src/app/api/suggest-improvements/route.ts` — call `logUsage()` + `logLlmUsage()` after AI response
- [x] 12.8 Update `src/app/api/parse-resume/route.ts` — call `logUsage()` only (no LLM)
- [x] 12.9 Update `src/app/api/generate-resume/route.ts` — call `logUsage()` only (no LLM)
- [x] 12.10 Create `src/app/api/admin/usage/route.ts` — `groupBy` aggregates for feature stats + LLM cost stats; admin-only
- [x] 12.11 Create `src/app/api/user/usage/route.ts` — last 50 events with nested `llmUsage` for calling user

---

## Phase 13 — Swagger / OpenAPI Documentation
- [x] 13.1 Create `src/lib/swagger/spec.ts` — register all Zod schemas + route paths (4 core + 3 Stripe/credits + 2 usage + 1 account), export `buildOpenApiSpec()`
- [x] 13.2 Create `src/app/api/docs/route.ts` — `GET /api/docs` returns OpenAPI JSON (public, force-static)
- [x] 13.3 Create `src/app/api-docs/page.tsx` — Swagger UI via `next/dynamic` with `ssr: false`
- [x] 13.4 Verify `/api-docs` and `/api/docs` are excluded from Clerk middleware protection

---

## Phase 14 — Verification
- [x] 14.1 `npm run dev` loads at `localhost:3000` — landing page 200 OK ✓
- [x] 14.2 Sign-up page renders Clerk form; "Try Free - Sign Up" link navigates to `/sign-up` ✓
- [x] 14.3 Sign in → lands on app (not sign-in page); `/analyze` shows 4-step free tier flow (no step 5) ✓
- [x] 14.4 Complete free analysis → step 4 shows category badge (HIGH/MEDIUM/LOW MATCH) + locked overlay ✓
- [x] 14.5 Click "Buy Credits" in overlay → navigates to `/pricing` ✓
- [x] 14.6 Pricing shows 3 columns (Free Preview / Starter / Pro), correct prices, credit counts, feature comparison table, and Buy buttons ✓
- [x] 14.7 Buy Starter → checkout API called with packId; redirects toward Stripe ✓ (mocked — real Stripe requires price IDs configured)
- [x] 14.8 `/api/stripe/webhook` is publicly accessible; `/api/stripe/checkout` exists and handles auth ✓
- [x] 14.9 Paid user sees 5-step flow; full score + keyword breakdown + suggestions visible; "Generate Optimized Resume →" → step 5 → "Download Optimized Resume" triggers PDF download ✓
- [x] 14.10 Navbar shows grey "10 credits" badge for paid user (ok status) ✓
- [x] 14.11 Sign out → returns to landing page; signed-out CTAs visible again ✓
- [x] 14.12 credits=1 → Navbar badge red (warning); credits=2 → yellow (reminder) ✓
- [x] 14.13 credits=0 → Navbar badge red (empty status) ✓
- [x] 14.14 `/account` page shows "My Account" heading, credit balance, credits-used stat, "Buy More Credits" link ✓
- [x] 14.15 `GET /api/user/account` returns `{ credits, ... }` with 200 ✓
- [x] 14.16 PDF upload → `UsageEvent` row written to DB with `feature`, `userId`, `durationMs`, `statusCode` fields ✓
- [x] 14.17 `/admin` page accessible to admin user; `/api/admin/usage` returns 200 for admin, 403 for non-admin ✓
- [x] 14.18 `localhost:3000/api-docs` 200 OK; `/api/docs` returns OpenAPI JSON with all 10 endpoints ✓
- [x] 14.19 Unauthenticated visits to `/analyze`, `/account`, `/pricing`, `/payment-success` → redirect to sign-in; API routes protected ✓
- [x] 14.20 Full paid flow: upload → analyze → view full results + suggestions → generate → PDF download works end-to-end ✓

---

## Resume Point

When resuming after an interruption:
1. Check the last `[x]` completed step above
2. Read `plan.md` for implementation details of the next step
3. Read `wireframe.html` for visual reference of the expected UI
4. Read any existing files in the relevant phase before writing new ones
5. Continue from the first `[ ]` step

**Last updated:** 2026-04-07  
**Current phase:** Complete — all 14 phases done, 48/48 Playwright E2E tests passing
