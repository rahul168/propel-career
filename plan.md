# Propel Career — Web App Implementation Plan

## Context
Build a resume optimization web app from scratch. Users upload a PDF resume, paste a job description, receive an ATS match confidence score, get specific wording suggestions to improve the score, then download a polished PDF with accepted changes applied.

**Tech stack:** Next.js 15 (App Router) · TypeScript · Tailwind CSS · shadcn/ui · Claude API (OpenAI swappable via `AI_PROVIDER` env var) · Clerk authentication · Stripe pay-per-use credits · Prisma + PostgreSQL

**Auth:** All routes (including `/analyze`) require sign-in. Public routes: `/`, `/sign-in`, `/sign-up`, `/api-docs`, `/api/docs`. Email confirmation is enforced by Clerk before users can access protected routes.

**Tier model:**
- **Free tier** — sign-up + email confirmation required. No credits needed. Users can complete the full upload and analysis flow (steps 1–4) but step 4 shows only the match category label (Low / Medium / High / Excellent) with score, keywords, and suggestions blurred/locked behind an upsell overlay. Step 5 (PDF download) is not available.
- **Paid tier** — requires purchasing credits. Each `POST /api/analyze-match` call deducts 1 credit. Full results (exact score, keywords, suggestions) shown in step 4 plus PDF download in step 5.

**Payment gate:** Signed-in users with 0 credits see the free tier UI in `/analyze`. They are only redirected to `/pricing` if they explicitly click "Unlock Full Results" or "Buy Credits". Credits are stored in PostgreSQL via Prisma and topped up via Stripe Checkout webhooks.

**Usage tracking:** Every API call is recorded in `UsageEvent`. Every LLM call records tokens consumed, model, provider, and cost (USD micros) in `LlmUsage`. Aggregated stats are available at `GET /api/admin/usage`; per-user history at `GET /api/user/usage`.

**MyAccount:** Users can view their credit balance, credit usage history (feature + date), and receive in-app alerts based on two global thresholds configured via env vars. Users are hard-blocked from AI services when credits reach 0.

---

## Phase 1 — Project Scaffold

```bash
npx create-next-app@latest . --typescript --tailwind --eslint --app --src-dir --import-alias "@/*"
npx shadcn@latest init
npx shadcn@latest add button card progress badge separator textarea
```

**Key dependencies:**
| Package | Purpose |
|---|---|
| `@anthropic-ai/sdk@0.82` | Claude API |
| `openai@6.33` | OpenAI API (swappable) |
| `pdf-parse@1.1.1` | PDF text extraction |
| `@react-pdf/renderer@4.3.3` | PDF generation |
| `react-dropzone@15` | File drag-and-drop |
| `zod@4.3.6` | Runtime validation |
| `sonner@2.0.7` | Toast notifications |
| `lucide-react` | Icons |
| `@clerk/nextjs` | Authentication |
| `@asteasolutions/zod-to-openapi` | Generate OpenAPI spec from Zod schemas |
| `swagger-ui-react` | Render Swagger UI |
| `@types/swagger-ui-react` | TypeScript types for swagger-ui-react (dev) |
| `stripe` | Stripe server-side SDK |
| `@stripe/stripe-js` | Stripe client-side SDK |
| `@prisma/client` | Prisma ORM client |
| `prisma` (dev) | Prisma CLI |

`.env.local` / `.env.example`:
```
AI_PROVIDER=claude        # "claude" | "openai"
ANTHROPIC_API_KEY=sk-ant-...
OPENAI_API_KEY=sk-...

# Clerk — get from https://dashboard.clerk.com
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL=/analyze
NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL=/analyze

# Stripe — get from https://dashboard.stripe.com
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
# Stripe Price IDs for credit packs (create in Stripe dashboard)
STRIPE_PRICE_10_CREDITS=price_...
STRIPE_PRICE_20_CREDITS=price_...

# PostgreSQL
DATABASE_URL=postgresql://user:password@localhost:5432/propel_career

# Credit balance alert thresholds (integers)
CREDIT_REMINDER_THRESHOLD=3   # show friendly reminder when credits ≤ this
CREDIT_WARNING_THRESHOLD=1    # show red warning when credits ≤ this
```

`next.config.ts` — critical settings:
```typescript
const nextConfig = {
  serverExternalPackages: ["@react-pdf/renderer", "pdf-parse"],
  webpack: (config) => {
    config.resolve.alias["canvas"] = false;
    return config;
  },
};
```

---

## Phase 2 — Directory Structure

```
src/
  middleware.ts                      # Clerk route protection
  app/
    layout.tsx                       # Root layout + ClerkProvider + Sonner toaster
    page.tsx                         # Landing page (Server Component, public)
    sign-in/[[...sign-in]]/page.tsx  # Clerk sign-in
    sign-up/[[...sign-up]]/page.tsx  # Clerk sign-up
    analyze/page.tsx                 # 5-step flow (Client Component, protected)
    api/
      parse-resume/route.ts          # Protected
      analyze-match/route.ts         # Protected
      suggest-improvements/route.ts  # Protected
      generate-resume/route.ts       # Protected
  components/
    FileUpload.tsx
    MatchScore.tsx
    SuggestionCard.tsx
    StepIndicator.tsx
    Navbar.tsx                       # UserButton + SignInButton + credit badge with status colour
    CreditStatusBanner.tsx           # Reminder/warning banner shown in /analyze and /account
  app/
    account/page.tsx                 # MyAccount — balance, usage history, alerts (protected)
    pricing/page.tsx                 # Credit packs + buy buttons (auth required)
    payment-success/page.tsx         # Post-payment confirmation (auth required)
    api-docs/page.tsx                # Swagger UI (Client Component, public)
    api/
      docs/route.ts                  # GET /api/docs → OpenAPI JSON spec (public)
      stripe/
        checkout/route.ts            # POST — create Stripe Checkout session (protected)
        webhook/route.ts             # POST — Stripe webhook (public, raw body)
      user/
        credits/route.ts             # GET — return current credit balance (protected)
        account/route.ts             # GET — balance + usage history + thresholds (protected)
  lib/
    stripe/
      client.ts                      # Stripe singleton (server-side)
      products.ts                    # Credit pack definitions (priceId, credits, amount)
    db/
      prisma.ts                      # Prisma client singleton
  prisma/
    schema.prisma                    # User, Purchase, UsageEvent, LlmUsage models
  lib/
    ai/
      pricing.ts                     # Model pricing constants + calculateCostMicros()
    tracking/
      index.ts                       # logUsage() + logLlmUsage() helpers
  app/
    api/
      admin/
        usage/route.ts               # GET — aggregated usage stats (protected)
      user/
        usage/route.ts               # GET — per-user usage history (protected)
  lib/
    ai/
      index.ts              # Provider singleton + exports
      types.ts              # AIProvider interface
      claude.ts             # Claude tool-use implementation
      openai.ts             # OpenAI structured output implementation
    pdf/
      parser.ts             # PDF extraction + structure inference
      generator.ts          # @react-pdf/renderer PDF generation
    swagger/
      spec.ts               # OpenAPI spec builder (zod-to-openapi)
  types/index.ts            # App-wide shared types
```

---

## Phase 3 — Core Types (`src/types/index.ts`)

```typescript
export interface MatchAnalysis {
  score: number;              // 0-100
  matchedKeywords: string[];
  missingKeywords: string[];
}

export interface Suggestion {
  id: string;
  section: string;
  original: string;           // verbatim text from resume
  suggested: string;          // drop-in replacement
  reason: string;
  accepted: boolean;          // default true
}

export interface ResumeStructure {
  name: string;
  contact: string;
  sections: { title: string; content: string }[];
}

export type MatchCategory = "Low" | "Medium" | "High" | "Excellent";

export function getCategoryFromScore(score: number): MatchCategory {
  if (score >= 80) return "Excellent";
  if (score >= 70) return "High";
  if (score >= 50) return "Medium";
  return "Low";
}
```

Score-to-category mapping (matches wireframe):
| Category | Range | Badge colour |
|---|---|---|
| Low | 0–49 | Red |
| Medium | 50–69 | Orange |
| High | 70–79 | Yellow |
| Excellent | 80–100 | Green |

---

## Phase 4 — AI Abstraction Layer

**`src/lib/ai/types.ts`** — interface:
```typescript
export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  model: string;
  provider: string;   // "claude" | "openai"
}

export interface AIResult<T> {
  data: T;
  usage: TokenUsage;
}

export interface AIProvider {
  analyzeMatch(resumeText: string, jobDescription: string): Promise<AIResult<MatchAnalysis>>;
  suggestImprovements(resumeText: string, jobDescription: string): Promise<AIResult<{ suggestions: Suggestion[] }>>;
}
```

Both Claude and OpenAI return token counts in their responses natively:
- Claude: `response.usage.input_tokens` / `response.usage.output_tokens`
- OpenAI: `response.usage.prompt_tokens` / `response.usage.completion_tokens`

Wrap each response to include these alongside the parsed result.

**`src/lib/ai/claude.ts`** — use tool-calling for structured output (never free-text JSON):
```typescript
// Force tool use:
tool_choice: { type: "tool", name: "report_match_analysis" }
// Temperature: 0 for analyzeMatch, 0.3 for suggestImprovements
// Model: claude-opus-4-6 (override via AI_MODEL env var)
```

**`src/lib/ai/openai.ts`** — use `zodResponseFormat` with `client.responses.parse()`.

**`src/lib/ai/index.ts`** — singleton provider resolved at module load:
```typescript
const provider = process.env.AI_PROVIDER === "openai" ? new OpenAIProvider() : new ClaudeProvider();
export const analyzeMatch = provider.analyzeMatch.bind(provider);
export const suggestImprovements = provider.suggestImprovements.bind(provider);
```

### AI Prompts

**analyzeMatch system prompt highlights:**
- Score 0-100: 40% keyword match, 25% role/level alignment, 25% responsibility overlap, 10% completeness
- Extract specific terms only (tech, tools, certs) — no generic soft skills
- Be calibrated: 70+ = genuinely competitive; most resumes score 30-60 before optimization

**suggestImprovements system prompt highlights:**
- 8-12 suggestions max, ordered by impact
- `original` must be verbatim resume text; `suggested` must be drop-in replacement
- NEVER fabricate experience or skills
- Each `reason` must explain which JD terms are being addressed

---

## Phase 5 — PDF Library (`src/lib/pdf/`)

**`parser.ts`:**
```typescript
export async function extractTextFromPDF(buffer: Buffer): Promise<string>
export function inferResumeStructure(rawText: string): ResumeStructure
// Detects section headers via regex: SUMMARY, EXPERIENCE, EDUCATION, SKILLS, PROJECTS, etc.
```

**`generator.ts`:**
1. Apply accepted suggestions to `ResumeStructure` (not raw string)
2. Build `<Document>` with `@react-pdf/renderer`, styled with Helvetica
3. Return `Buffer` from `pdf(element).toBuffer()`

---

## Phase 6 — API Routes

All routes must declare `export const runtime = "nodejs"` (pdf-parse + @react-pdf require Node.js).

| Route | Input | Output |
|---|---|---|
| `POST /api/parse-resume` | `FormData` with `resume` PDF | `{ text, fileName }` |
| `POST /api/analyze-match` | `{ resumeText, jobDescription }` | `MatchAnalysis` |
| `POST /api/suggest-improvements` | `{ resumeText, jobDescription }` | `{ suggestions }` |
| `POST /api/generate-resume` | `{ resumeText, acceptedSuggestions }` | PDF binary stream |

- Use `Request.formData()` for multipart (no `formidable` needed)
- Validate all inputs with Zod
- Verify PDF magic bytes server-side: `buffer[0] === 0x25 && buffer[1] === 0x50`
- `generate-resume` returns `Content-Type: application/pdf` with `Content-Disposition: attachment`

---

## Phase 7 — Multi-Step UI (`src/app/analyze/page.tsx`)

Server Component wrapper checks credits and passes `hasPaid: boolean` prop to the Client Component:

```typescript
// src/app/analyze/page.tsx (Server Component)
export default async function AnalyzePage() {
  const { userId } = await auth();
  const user = await prisma.user.findUnique({ where: { id: userId! } });
  const hasPaid = (user?.credits ?? 0) > 0;
  return <AnalyzeFlow hasPaid={hasPaid} />;
}
```

Client Component `AnalyzeFlow` with `useReducer` state machine:

```typescript
type Step = 1 | 2 | 3 | 4 | 5;
interface AnalysisState {
  currentStep: Step;
  resumeText: string;
  fileName: string;
  jobDescription: string;
  matchAnalysis: MatchAnalysis | null;
  suggestions: Suggestion[];
  isLoading: boolean;
  error: string | null;
}
```

**Step 1** — FileUpload (react-dropzone, PDF only)  
**Step 2** — Job description textarea + "Analyze Match" button  
**Step 3** — Loading: fire `analyzeMatch` + `suggestImprovements` in `Promise.all` (parallel)  
**Step 4** — Conditional on `hasPaid`:
  - **Free tier** (`hasPaid === false`): show `MatchCategoryBadge` (Low/Medium/High/Excellent), blur/lock score + keyword + suggestion sections with upsell overlay. Overlay has "Unlock Full Results → Buy Credits" CTA → `/pricing`. Step 5 hidden.
  - **Paid tier** (`hasPaid === true`): show full MatchScore gauge (red <50, orange 50–69, yellow 70–79, green 80+) + SuggestionCards (accept/reject toggle). Show step 5 button.

**Step 5** (paid only) — "Generate Resume" → fetch `/api/generate-resume` → trigger download via `URL.createObjectURL(blob)`

**StepIndicator.tsx** shows progress: free tier shows 4 steps (1–4), paid tier shows 5 steps (1–5).

### `MatchCategoryBadge` component

Rendered in step 4 for free-tier users. Uses `getCategoryFromScore()` to derive the label.

```typescript
// category-specific Tailwind classes:
const styles = {
  Low:       "bg-red-50 border-red-300 text-red-800",
  Medium:    "bg-orange-50 border-orange-300 text-orange-800",
  High:      "bg-yellow-50 border-yellow-300 text-yellow-800",
  Excellent: "bg-green-50 border-green-300 text-green-800",
};
```

Display: large category label + score range (e.g. "Score range: 70%–80%") + category icon.

---

## Phase 8 — Landing Page

`src/app/page.tsx` — Server Component. Brief value prop. Conditional CTAs using Clerk components:
- Signed out → primary CTA: **"Try Free - Sign Up"** → `/sign-up`; secondary: "Sign In" → `/sign-in`
- Signed in → **"Go to Dashboard"** → `/analyze`

Hero subtitle (signed out): *"Upload your resume, paste a job description, and get an instant ATS match result — free with a quick sign-up."*

---

## Phase 9 — Clerk Authentication

### Middleware (`src/middleware.ts`)
```typescript
import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

const isProtected = createRouteMatcher(["/analyze(.*)", "/api/(.*)"]);

export default clerkMiddleware((auth, req) => {
  if (isProtected(req)) auth().protect();
});

export const config = {
  matcher: ["/((?!_next|.*\\..*).*)"],
};
```

### Root layout — wrap with `<ClerkProvider>`
```typescript
import { ClerkProvider } from "@clerk/nextjs";
// Wrap <html> with <ClerkProvider>, add <Navbar /> inside <body>
```

### Sign-in / Sign-up pages
```typescript
// src/app/sign-in/[[...sign-in]]/page.tsx
import { SignIn } from "@clerk/nextjs";
export default function Page() {
  return <div className="flex min-h-screen items-center justify-center"><SignIn /></div>;
}
// Same pattern for sign-up
```

### Navbar (`src/components/Navbar.tsx`) — Server Component
```typescript
import { SignInButton, SignedIn, SignedOut, UserButton } from "@clerk/nextjs";
// Show <UserButton afterSignOutUrl="/" /> when signed in — Clerk's UserButton includes sign-out
// Show <SignInButton /> when signed out
```

Clerk's `<UserButton />` renders an avatar that opens a dropdown with account management and a **Sign Out** option built in (`afterSignOutUrl="/"` redirects to landing after logout). No custom dropdown needed — Clerk handles this natively.

Additionally render the credit badge (status-coloured pill) alongside `<UserButton />`:
```typescript
<SignedIn>
  <span className={badgeColour}>{credits} credits</span>
  <UserButton afterSignOutUrl="/" />
</SignedIn>
```

### API route protection — apply to all 4 routes
```typescript
import { auth } from "@clerk/nextjs/server";

export async function POST(request: Request) {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });
  // ...
}
```

---

## Phase 10 — Stripe Pay-Per-Use Credits

### Database schema (`prisma/schema.prisma`)

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model User {
  id        String     @id              // Clerk userId (e.g. "user_2abc...")
  email     String     @unique
  credits   Int        @default(0)
  createdAt DateTime   @default(now())
  purchases Purchase[]
}

model Purchase {
  id              String   @id @default(cuid())
  userId          String
  stripeSessionId String   @unique
  creditsAdded    Int
  amountPaid      Int      // in cents
  createdAt       DateTime @default(now())
  user            User     @relation(fields: [userId], references: [id])
}

model UsageEvent {
  id          String    @id @default(cuid())
  userId      String
  feature     String    // "parse-resume" | "analyze-match" | "suggest-improvements" | "generate-resume"
  statusCode  Int       // HTTP response status
  durationMs  Int       // wall-clock ms from request start to response
  createdAt   DateTime  @default(now())
  user        User      @relation(fields: [userId], references: [id])
  llmUsage    LlmUsage?
}

model LlmUsage {
  id             String     @id @default(cuid())
  usageEventId   String     @unique
  provider       String     // "claude" | "openai"
  model          String     // "claude-opus-4-6" | "gpt-4o" etc.
  operation      String     // "analyzeMatch" | "suggestImprovements"
  inputTokens    Int
  outputTokens   Int
  totalTokens    Int        // inputTokens + outputTokens
  costUsdMicros  Int        // cost in millionths of a USD (avoids float rounding)
  createdAt      DateTime   @default(now())
  usageEvent     UsageEvent @relation(fields: [usageEventId], references: [id])
}
```

Also add relations to the `User` model:
```prisma
model User {
  // ... existing fields ...
  purchases   Purchase[]
  usageEvents UsageEvent[]
}
```

Run migrations:
```bash
npx prisma migrate dev --name init
npx prisma generate
```

### Credit pack definitions (`src/lib/stripe/products.ts`)

```typescript
export const CREDIT_PACKS = [
  { id: "starter",  credits: 10, price: 299,  label: "Starter",  priceId: process.env.STRIPE_PRICE_10_CREDITS! },
  { id: "pro",      credits: 20, price: 480,  label: "Pro",       priceId: process.env.STRIPE_PRICE_20_CREDITS! },
] as const;
```

Create matching products in the Stripe dashboard. Each product is a one-time payment (not recurring).

### Stripe singleton (`src/lib/stripe/client.ts`)

```typescript
import Stripe from "stripe";
export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2025-03-31.basil",
});
```

### Prisma singleton (`src/lib/db/prisma.ts`)

```typescript
import { PrismaClient } from "@prisma/client";
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };
export const prisma = globalForPrisma.prisma ?? new PrismaClient();
if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
```

### Create Checkout session (`src/app/api/stripe/checkout/route.ts`)

Protected. Sets `client_reference_id` to Clerk `userId` so the webhook can find the user.

```typescript
import { auth } from "@clerk/nextjs/server";
import { stripe } from "@/lib/stripe/client";
import { CREDIT_PACKS } from "@/lib/stripe/products";
import { z } from "zod";

const schema = z.object({ packId: z.enum(["starter", "pro"]) });

export async function POST(request: Request) {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { packId } = schema.parse(await request.json());
  const pack = CREDIT_PACKS.find(p => p.id === packId)!;

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    payment_method_types: ["card"],
    line_items: [{ price: pack.priceId, quantity: 1 }],
    client_reference_id: userId,
    metadata: { credits: String(pack.credits) },
    success_url: `${process.env.NEXT_PUBLIC_APP_URL}/payment-success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/pricing`,
  });

  return Response.json({ url: session.url });
}
```

### Stripe webhook (`src/app/api/stripe/webhook/route.ts`)

**Public route** — excluded from Clerk middleware. Must read the **raw request body** (not parsed JSON) for signature verification.

```typescript
import { stripe } from "@/lib/stripe/client";
import { prisma } from "@/lib/db/prisma";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const body = await request.text();
  const sig = request.headers.get("stripe-signature")!;

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET!);
  } catch {
    return Response.json({ error: "Invalid signature" }, { status: 400 });
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    const userId = session.client_reference_id!;
    const credits = Number(session.metadata?.credits ?? 0);

    await prisma.user.upsert({
      where: { id: userId },
      update: { credits: { increment: credits } },
      create: { id: userId, email: session.customer_details?.email ?? "", credits },
    });

    await prisma.purchase.create({
      data: {
        userId,
        stripeSessionId: session.id,
        creditsAdded: credits,
        amountPaid: session.amount_total ?? 0,
      },
    });
  }

  return Response.json({ received: true });
}
```

### Credit balance route (`src/app/api/user/credits/route.ts`)

Protected. Used by the Navbar and analyze page to display/check remaining credits.

```typescript
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/db/prisma";

export async function GET() {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const user = await prisma.user.findUnique({ where: { id: userId } });
  return Response.json({ credits: user?.credits ?? 0 });
}
```

### Credit deduction in analyze-match route

Deduct 1 credit atomically before calling the AI. Return `402 Payment Required` if credits are 0.

```typescript
const user = await prisma.user.findUnique({ where: { id: userId } });
if (!user || user.credits < 1) {
  return Response.json({ error: "Insufficient credits" }, { status: 402 });
}
await prisma.user.update({
  where: { id: userId },
  data: { credits: { decrement: 1 } },
});
// ... then call analyzeMatch()
```

### Credit gate in `/analyze/page.tsx`

Server Component wrapper passes `hasPaid` to the Client Component — **no redirect** for 0-credit users. They get the free-tier 4-step flow instead:

```typescript
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/db/prisma";

export default async function AnalyzePage() {
  const { userId } = await auth();
  const user = await prisma.user.findUnique({ where: { id: userId! } });
  const hasPaid = (user?.credits ?? 0) > 0;
  return <AnalyzeFlow hasPaid={hasPaid} />;
}
```

Free-tier users complete all 4 steps and see the `MatchCategoryBadge`. The upsell overlay in step 4 links to `/pricing` when they want to unlock full results.

### Pricing page (`src/app/pricing/page.tsx`)

Server Component. Three-column layout:

| Column | Plan | Price | Credits | Per-analysis |
|---|---|---|---|---|
| 1 | Free Preview | $0 | — | Match category only |
| 2 | Starter | $2.99 | 10 | $0.30 |
| 3 (featured) | Pro | $4.80 | 20 | $0.24 — save 20% |

Free column CTA: "Try Free Now →" → `/analyze` (no payment). Starter/Pro CTAs call `POST /api/stripe/checkout` then redirect to Stripe Checkout.

Feature comparison table below the cards:
| Feature | Free | Starter | Pro |
|---|---|---|---|
| Match category (Low/Med/High/Excellent) | ✅ | ✅ | ✅ |
| Exact ATS score | 🔒 | ✅ | ✅ |
| Keyword breakdown | 🔒 | ✅ | ✅ |
| AI wording suggestions | 🔒 | ✅ | ✅ |
| PDF download | 🔒 | ✅ | ✅ |

### Payment success page (`src/app/payment-success/page.tsx`)

Server Component. Reads `?session_id` from the URL, shows a success message and a "Start Analyzing" button → `/analyze`.

### Middleware update — exclude Stripe webhook and new pages

```typescript
const isProtected = createRouteMatcher([
  "/analyze(.*)",
  "/pricing",
  "/payment-success",
  "/api/((?!docs|stripe/webhook).*)",  // protect all /api/* EXCEPT /api/docs and /api/stripe/webhook
]);
```

### Swagger docs additions

Add 3 new route registrations to `src/lib/swagger/spec.ts`:

- `POST /api/stripe/checkout` — request: `{ packId: "starter" | "pro" }`, response: `{ url: string }`
- `POST /api/stripe/webhook` — request: raw Stripe event (note: Stripe-signed, not for direct use), response: `{ received: true }`
- `GET /api/user/credits` — response: `{ credits: number }`

Also add `402` response to `POST /api/analyze-match` spec (insufficient credits).

---

## Phase 11 — MyAccount Section

### Threshold configuration (`src/lib/credits/thresholds.ts`)

Read once at module load from env vars. Exported as a plain object so both server components and API routes can import it without re-parsing.

```typescript
export const CREDIT_THRESHOLDS = {
  reminder: parseInt(process.env.CREDIT_REMINDER_THRESHOLD ?? "3", 10),
  warning:  parseInt(process.env.CREDIT_WARNING_THRESHOLD  ?? "1", 10),
} as const;

export type CreditStatus = "ok" | "reminder" | "warning" | "empty";

export function getCreditStatus(credits: number): CreditStatus {
  if (credits <= 0)                              return "empty";
  if (credits <= CREDIT_THRESHOLDS.warning)      return "warning";
  if (credits <= CREDIT_THRESHOLDS.reminder)     return "reminder";
  return "ok";
}
```

### Account API route (`src/app/api/user/account/route.ts`)

Protected. Returns everything the MyAccount page needs in one call: balance, status, thresholds, and recent usage history (feature name, timestamp, credits consumed).

```typescript
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/db/prisma";
import { CREDIT_THRESHOLDS, getCreditStatus } from "@/lib/credits/thresholds";

export async function GET() {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const [user, recentEvents] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId } }),
    prisma.usageEvent.findMany({
      where: { userId, statusCode: 200 },
      orderBy: { createdAt: "desc" },
      take: 50,
      select: { id: true, feature: true, createdAt: true, durationMs: true },
    }),
  ]);

  const credits = user?.credits ?? 0;

  // Each successful analyze-match call consumed 1 credit — derive credits used from event count
  const creditsUsed = recentEvents.filter(e => e.feature === "analyze-match").length;

  return Response.json({
    credits,
    status: getCreditStatus(credits),
    thresholds: CREDIT_THRESHOLDS,
    creditsUsed,           // total historical credits spent (from event count)
    recentUsage: recentEvents.map(e => ({
      id: e.id,
      feature: e.feature,
      createdAt: e.createdAt,
    })),
  });
}
```

### `CreditStatusBanner` component (`src/components/CreditStatusBanner.tsx`)

Client Component. Renders nothing when status is `"ok"`. Renders a dismissible banner for `"reminder"` (yellow) and `"warning"` (red). Takes `status` and `credits` as props — populated server-side before render.

```typescript
"use client";
import type { CreditStatus } from "@/lib/credits/thresholds";

interface Props { status: CreditStatus; credits: number; }

export function CreditStatusBanner({ status, credits }: Props) {
  if (status === "ok" || status === "empty") return null;

  const isWarning = status === "warning";
  return (
    <div className={`rounded-md px-4 py-3 flex items-center justify-between
      ${isWarning ? "bg-red-50 border border-red-300 text-red-800"
                  : "bg-yellow-50 border border-yellow-300 text-yellow-800"}`}>
      <span>
        {isWarning
          ? `⚠️ Only ${credits} credit${credits === 1 ? "" : "s"} remaining — top up to keep analyzing.`
          : `💡 You have ${credits} credits left. Consider buying more soon.`}
      </span>
      <a href="/pricing" className="ml-4 font-semibold underline text-sm">Buy Credits</a>
    </div>
  );
}
```

Place `<CreditStatusBanner>` at the top of:
- `src/app/analyze/page.tsx` — shown before the file upload step
- `src/app/account/page.tsx` — shown at the top of the account page

### Navbar credit badge update (`src/components/Navbar.tsx`)

Show a coloured pill next to the user button — colour driven by `getCreditStatus()`:
- `ok` → neutral/grey
- `reminder` → yellow
- `warning` → red
- `empty` → red with "0" and lock icon

Read credits in the Server Component via `prisma.user.findUnique` so no extra client fetch is needed.

```typescript
import { getCreditStatus } from "@/lib/credits/thresholds";

// Inside Navbar (Server Component):
const user = await prisma.user.findUnique({ where: { id: userId } });
const credits = user?.credits ?? 0;
const status = getCreditStatus(credits);

const badgeColour = {
  ok: "bg-gray-100 text-gray-700",
  reminder: "bg-yellow-100 text-yellow-800",
  warning: "bg-red-100 text-red-700",
  empty: "bg-red-200 text-red-900",
}[status];
```

Render: `<span className={badgeColour}>{credits} credits</span>` next to `<UserButton />`.

### MyAccount page (`src/app/account/page.tsx`)

Server Component. Fetches from `GET /api/user/account` (or calls Prisma directly — prefer direct Prisma call to avoid a self-fetch roundtrip).

**Layout:**
```
┌─────────────────────────────────────────────────────┐
│  My Account                                          │
│                                                      │
│  [CreditStatusBanner — if reminder or warning]       │
│                                                      │
│  ┌──────────────────┐  ┌───────────────────────────┐│
│  │ Credit Balance   │  │ Credits Used (all time)   ││
│  │      [N]         │  │         [N]               ││
│  │  [Buy More]      │  │                           ││
│  └──────────────────┘  └───────────────────────────┘│
│                                                      │
│  Usage History                                       │
│  ┌──────────┬──────────────────────┬───────────────┐│
│  │ Feature  │ Date                 │ Credits Used  ││
│  ├──────────┼──────────────────────┼───────────────┤│
│  │ Analysis │ Apr 6 2026, 10:32 AM │      1        ││
│  │ Analysis │ Apr 5 2026, 3:14 PM  │      1        ││
│  └──────────┴──────────────────────┴───────────────┘│
└─────────────────────────────────────────────────────┘
```

Feature label mapping (human-readable):
```typescript
const FEATURE_LABELS: Record<string, string> = {
  "analyze-match":       "Resume Analysis",
  "suggest-improvements":"Suggestions",
  "parse-resume":        "Resume Upload",
  "generate-resume":     "PDF Generation",
};
```

### Hard service block — extend to `suggest-improvements`

`suggest-improvements` is called in parallel with `analyze-match` in the same 1-credit session. Add a credit presence check (not a decrement) so the route returns `402` independently if credits are already 0:

```typescript
// src/app/api/suggest-improvements/route.ts
const user = await prisma.user.findUnique({ where: { id: userId } });
if (!user || user.credits < 1) {
  return Response.json({ error: "Insufficient credits" }, { status: 402 });
}
// ... proceed (no decrement — analyze-match owns the decrement)
```

The page-level gate in `/analyze/page.tsx` already redirects users with 0 credits before they reach the API, so this is defence-in-depth for direct API calls.

### Middleware — add `/account` to protected routes

```typescript
const isProtected = createRouteMatcher([
  "/analyze(.*)",
  "/account(.*)",           // ← add
  "/pricing",
  "/payment-success",
  "/api/((?!docs|stripe/webhook).*)",
]);
```

### Swagger additions

Add to `src/lib/swagger/spec.ts`:
- `GET /api/user/account` — response: `{ credits, status, thresholds, creditsUsed, recentUsage }`; tag: `User`

---

## Phase 12 — Usage Tracking (AI Instrumentation)

### Pricing constants (`src/lib/ai/pricing.ts`)

Stores cost per 1M tokens in **USD micros** (integer arithmetic, no float rounding errors). Update whenever provider pricing changes.

```typescript
// Cost in USD micros (1 USD = 1,000,000 micros) per 1M tokens
export const MODEL_PRICING: Record<string, { input: number; output: number }> = {
  "claude-opus-4-6":   { input: 15_000_000, output: 75_000_000 },  // $15 / $75 per 1M
  "claude-sonnet-4-6": { input:  3_000_000, output: 15_000_000 },  // $3  / $15 per 1M
  "gpt-4o":            { input:  5_000_000, output: 15_000_000 },  // $5  / $15 per 1M
  "gpt-4o-mini":       { input:    150_000, output:    600_000 },  // $0.15 / $0.60 per 1M
};

export function calculateCostMicros(
  model: string,
  inputTokens: number,
  outputTokens: number
): number {
  const p = MODEL_PRICING[model] ?? MODEL_PRICING["claude-opus-4-6"];
  return Math.round((inputTokens * p.input + outputTokens * p.output) / 1_000_000);
}
```

### Tracking helpers (`src/lib/tracking/index.ts`)

Two fire-and-forget helpers called from API route handlers. Both are non-blocking — wrap in `void` so a DB write failure never breaks the API response.

```typescript
import { prisma } from "@/lib/db/prisma";
import { calculateCostMicros } from "@/lib/ai/pricing";
import type { TokenUsage } from "@/lib/ai/types";

export async function logUsage(
  userId: string,
  feature: string,
  statusCode: number,
  durationMs: number
): Promise<string> {
  const event = await prisma.usageEvent.create({
    data: { userId, feature, statusCode, durationMs },
  });
  return event.id;
}

export async function logLlmUsage(
  usageEventId: string,
  operation: string,
  usage: TokenUsage
): Promise<void> {
  const totalTokens = usage.inputTokens + usage.outputTokens;
  const costUsdMicros = calculateCostMicros(usage.model, usage.inputTokens, usage.outputTokens);
  await prisma.llmUsage.create({
    data: {
      usageEventId,
      provider: usage.provider,
      model: usage.model,
      operation,
      inputTokens: usage.inputTokens,
      outputTokens: usage.outputTokens,
      totalTokens,
      costUsdMicros,
    },
  });
}
```

### Instrument API routes

**`POST /api/analyze-match`** — tracks feature usage + LLM usage + cost:

```typescript
const start = Date.now();
const { data: matchResult, usage } = await analyzeMatch(resumeText, jobDescription);
const durationMs = Date.now() - start;

// Fire-and-forget — don't await, don't block response
void logUsage(userId, "analyze-match", 200, durationMs).then(eventId =>
  logLlmUsage(eventId, "analyzeMatch", usage)
);

return Response.json(matchResult);
```

**`POST /api/suggest-improvements`** — same pattern with `"suggestImprovements"` operation.

**`POST /api/parse-resume`** and **`POST /api/generate-resume`** — log `UsageEvent` only (no LLM call):

```typescript
const start = Date.now();
// ... process ...
void logUsage(userId, "parse-resume", 200, Date.now() - start);
```

### Aggregated usage stats (`src/app/api/admin/usage/route.ts`)

Protected. Returns total calls, tokens, and cost per feature and per model. Restrict to admin by checking Clerk `publicMetadata.role === "admin"` (set manually in Clerk dashboard).

```typescript
export async function GET() {
  const { userId, sessionClaims } = await auth();
  if (!userId || sessionClaims?.publicMetadata?.role !== "admin") {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const [featureStats, llmStats] = await Promise.all([
    // Calls and avg latency per feature
    prisma.usageEvent.groupBy({
      by: ["feature"],
      _count: { id: true },
      _avg: { durationMs: true },
    }),
    // Tokens and cost per model/operation
    prisma.llmUsage.groupBy({
      by: ["provider", "model", "operation"],
      _sum: { inputTokens: true, outputTokens: true, totalTokens: true, costUsdMicros: true },
      _count: { id: true },
    }),
  ]);

  return Response.json({ featureStats, llmStats });
}
```

### Per-user usage history (`src/app/api/user/usage/route.ts`)

Protected. Returns the calling user's last 50 events with associated LLM cost.

```typescript
export async function GET() {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const events = await prisma.usageEvent.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: 50,
    include: { llmUsage: true },
  });

  return Response.json({ events });
}
```

### Swagger additions

Add to `src/lib/swagger/spec.ts`:
- `GET /api/admin/usage` — response: `{ featureStats, llmStats }`; security: BearerAuth; tag: `Admin`
- `GET /api/user/usage` — response: `{ events: UsageEvent[] }`; security: BearerAuth; tag: `User`

---

## Phase 14 — Swagger / OpenAPI Documentation

### Strategy
Use `@asteasolutions/zod-to-openapi` to derive the OpenAPI 3.0 spec directly from the Zod schemas already used for request validation. This keeps schemas as the single source of truth — no duplicate type definitions.

Serve the spec as JSON at `GET /api/docs` (public). Render Swagger UI at `/api-docs` (public page, excluded from Clerk middleware).

### Install
```bash
npm install @asteasolutions/zod-to-openapi swagger-ui-react
npm install -D @types/swagger-ui-react
```

### OpenAPI spec builder (`src/lib/swagger/spec.ts`)

Register all Zod schemas with `extendZodWithOpenApi`, then define each route's operation:

```typescript
import { OpenAPIRegistry, OpenApiGeneratorV3 } from "@asteasolutions/zod-to-openapi";
import { z } from "zod";

export const registry = new OpenAPIRegistry();

// Register reusable schemas
const MatchAnalysisSchema = registry.register(
  "MatchAnalysis",
  z.object({
    score: z.number().min(0).max(100).openapi({ description: "ATS match score 0-100" }),
    matchedKeywords: z.array(z.string()),
    missingKeywords: z.array(z.string()),
  })
);

const SuggestionSchema = registry.register(
  "Suggestion",
  z.object({
    id: z.string(),
    section: z.string(),
    original: z.string().openapi({ description: "Verbatim text from resume" }),
    suggested: z.string().openapi({ description: "Drop-in replacement" }),
    reason: z.string(),
    accepted: z.boolean(),
  })
);

// Register all 4 API paths
registry.registerPath({
  method: "post", path: "/api/parse-resume",
  tags: ["Resume"],
  summary: "Upload and parse a PDF resume",
  security: [{ BearerAuth: [] }],
  request: {
    body: { content: { "multipart/form-data": {
      schema: z.object({ resume: z.instanceof(File).openapi({ type: "string", format: "binary" }) })
    }}}
  },
  responses: {
    200: { description: "Extracted text", content: { "application/json": {
      schema: z.object({ text: z.string(), fileName: z.string() })
    }}},
    400: { description: "Invalid file (not a PDF)" },
    401: { description: "Unauthorized" },
  },
});

registry.registerPath({
  method: "post", path: "/api/analyze-match",
  tags: ["Analysis"],
  summary: "Analyze match between resume and job description",
  security: [{ BearerAuth: [] }],
  request: {
    body: { content: { "application/json": {
      schema: z.object({ resumeText: z.string().min(50), jobDescription: z.string().min(50) })
    }}}
  },
  responses: {
    200: { description: "Match analysis result", content: { "application/json": { schema: MatchAnalysisSchema }}},
    401: { description: "Unauthorized" },
  },
});

registry.registerPath({
  method: "post", path: "/api/suggest-improvements",
  tags: ["Analysis"],
  summary: "Get AI-generated wording suggestions to improve match score",
  security: [{ BearerAuth: [] }],
  request: {
    body: { content: { "application/json": {
      schema: z.object({ resumeText: z.string().min(50), jobDescription: z.string().min(50) })
    }}}
  },
  responses: {
    200: { description: "List of suggestions", content: { "application/json": {
      schema: z.object({ suggestions: z.array(SuggestionSchema) })
    }}},
    401: { description: "Unauthorized" },
  },
});

registry.registerPath({
  method: "post", path: "/api/generate-resume",
  tags: ["Resume"],
  summary: "Generate updated resume PDF with accepted suggestions applied",
  security: [{ BearerAuth: [] }],
  request: {
    body: { content: { "application/json": {
      schema: z.object({ resumeText: z.string(), acceptedSuggestions: z.array(SuggestionSchema) })
    }}}
  },
  responses: {
    200: { description: "PDF file download", content: { "application/pdf": { schema: z.string().openapi({ type: "string", format: "binary" }) }}},
    401: { description: "Unauthorized" },
  },
});

export function buildOpenApiSpec() {
  const generator = new OpenApiGeneratorV3(registry.definitions);
  return generator.generateDocument({
    openapi: "3.0.0",
    info: { title: "Propel Career API", version: "1.0.0", description: "Resume optimization API" },
    servers: [{ url: process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000" }],
    components: {
      securitySchemes: {
        BearerAuth: { type: "http", scheme: "bearer", description: "Clerk session token" },
      },
    },
  });
}
```

### OpenAPI JSON route (`src/app/api/docs/route.ts`)

Public — **not** in the protected route matcher.

```typescript
import { buildOpenApiSpec } from "@/lib/swagger/spec";

export const dynamic = "force-static"; // cache the spec at build time

export function GET() {
  const spec = buildOpenApiSpec();
  return Response.json(spec);
}
```

### Swagger UI page (`src/app/api-docs/page.tsx`)

Client Component. Load `swagger-ui-react` dynamically with `ssr: false` — it uses browser globals and will crash during SSR.

```typescript
"use client";
import dynamic from "next/dynamic";
import "swagger-ui-react/swagger-ui.css";

const SwaggerUI = dynamic(() => import("swagger-ui-react"), { ssr: false });

export default function ApiDocsPage() {
  return (
    <div className="min-h-screen">
      <SwaggerUI url="/api/docs" />
    </div>
  );
}
```

### Exclude docs routes from Clerk protection

Update `src/middleware.ts` — `/api-docs` and `/api/docs` must remain public:

```typescript
const isProtected = createRouteMatcher([
  "/analyze(.*)",
  "/api/((?!docs).*)",   // protect /api/* EXCEPT /api/docs
]);
```

### Add `NEXT_PUBLIC_APP_URL` to `.env.example`
```
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

---

## Critical Gotchas

1. **Stripe webhook must read raw body** — use `request.text()` not `request.json()` before `constructEvent()`; parsed JSON breaks signature verification
2. **Prisma in Next.js dev mode** — always use the global singleton pattern in `src/lib/db/prisma.ts` to prevent "too many connections" from hot-reload creating new `PrismaClient` instances
3. **Test webhooks locally** — use `stripe listen --forward-to localhost:3000/api/stripe/webhook` (Stripe CLI) to receive webhook events during development
4. **Usage tracking is fire-and-forget** — always `void logUsage(...)` without `await` in hot paths; a DB write failure must never break the API response
5. **Cost stored as integer micros** — `costUsdMicros / 1_000_000` = USD. Never store floats for money
6. **Swagger UI SSR crash** — always load `swagger-ui-react` via `next/dynamic` with `ssr: false`; it imports `window` at module level
7. **`pdf-parse` webpack issue** — add `config.resolve.alias["canvas"] = false` in `next.config.ts`
8. **Edge runtime** — all routes touching pdf/AI must have `export const runtime = "nodejs"`
9. **`@react-pdf/renderer` + React 19** — may need `react@18` pin if peer dep conflicts cause runtime crashes; test early
10. **Suggestion patching** — normalize whitespace before substring replacement; fuzzy match as fallback
11. **API latency** — run `analyzeMatch` + `suggestImprovements` in `Promise.all`, not sequentially

---

## Verification

**Stripe payment flow:**
1. Sign in with 0 credits → visiting `/analyze` redirects to `/pricing`
2. `/pricing` shows two credit packs (Starter 10 credits · $2.99, Pro 20 credits · $4.80)
3. Click "Buy Starter" → Stripe Checkout opens
4. Complete payment with test card `4242 4242 4242 4242` → redirects to `/payment-success`
5. Stripe CLI webhook fires → DB updated with credits
6. Navigate to `/analyze` — now accessible (credits > 0)
7. Complete one analysis → credit count decrements by 1 (visible in Navbar)
8. Deplete all credits → `/analyze` redirects back to `/pricing`
9. `GET /api/user/credits` with no auth → `401`; with auth → `{ credits: N }`
10. `POST /api/analyze-match` with 0 credits → `402 Payment Required`

**MyAccount & credit alerts:**
1. Sign in with 5 credits (above both thresholds) → Navbar shows grey "5 credits" badge, no banner on `/analyze`
2. Set credits to 3 in DB → Navbar badge turns yellow, `/analyze` shows yellow reminder banner
3. Set credits to 1 → Navbar badge turns red, `/analyze` shows red warning banner
4. Set credits to 0 → visiting `/analyze` redirects to `/pricing`; direct `POST /api/suggest-improvements` returns `402`
5. Navigate to `/account` while signed out → redirects to `/sign-in`
6. Navigate to `/account` with credits > 0 → page shows balance card, credits-used count, and usage history table
7. Usage history table shows human-readable feature labels ("Resume Analysis" not "analyze-match")
8. "Buy Credits" link in reminder/warning banner navigates to `/pricing`
9. Set `CREDIT_REMINDER_THRESHOLD=5` in `.env.local` → reminder banner now appears at 5 credits
10. `GET /api/user/account` returns `{ credits, status, thresholds: { reminder, warning }, creditsUsed, recentUsage }`

**Usage tracking (DB):**
1. Run one full analysis → query DB: `SELECT * FROM "UsageEvent"` — row exists with `feature="analyze-match"`, correct `durationMs` and `statusCode=200`
2. `SELECT * FROM "LlmUsage"` — row linked to above event with `inputTokens`, `outputTokens`, `totalTokens`, `costUsdMicros` all populated
3. `SELECT * FROM "LlmUsage"` for suggest-improvements call — separate row with `operation="suggestImprovements"`
4. `GET /api/user/usage` — returns both events with nested `llmUsage`
5. `GET /api/admin/usage` as non-admin → `403`; as admin (set `role:"admin"` in Clerk dashboard) → returns aggregated stats
6. Verify `featureStats` shows call counts for `parse-resume`, `analyze-match`, `suggest-improvements`, `generate-resume`
7. Verify `llmStats` shows total tokens and `costUsdMicros` per model — divide by 1,000,000 to get USD

**Swagger docs:**
1. Visit `localhost:3000/api-docs` — Swagger UI loads (no login required)
2. Visit `localhost:3000/api/docs` — raw OpenAPI JSON spec is returned
3. All 4 endpoints visible: `POST /api/parse-resume`, `/api/analyze-match`, `/api/suggest-improvements`, `/api/generate-resume`
4. Each endpoint shows correct request body schema, response schema, and `BearerAuth` security requirement
5. Visiting `/api-docs` while signed out still works (route is public)

**Auth flow:**
1. Visit `localhost:3000` — landing page shows "Try Free - Sign Up" primary CTA (unauthenticated)
2. Navigate directly to `/analyze` — middleware redirects to `/sign-in`
3. Call `POST /api/analyze-match` without auth — returns `401 Unauthorized`
4. Sign up via `/sign-up` → Clerk sends confirmation email → after confirmation, redirects to `/analyze`
5. Navbar shows `<UserButton>` avatar with credit badge when signed in
6. Click avatar → Clerk dropdown shows Sign Out option → sign out → landing page CTA reverts to "Try Free - Sign Up"

**Free tier flow (0 credits after sign-up):**
7. After sign-up + email confirmation → `/analyze` renders 4-step flow (no step 5)
8. Upload resume (step 1) → paste job description (step 2) → analyze (step 3)
9. Step 4 shows `MatchCategoryBadge` (e.g. "HIGH MATCH — Score range: 70%–80%")
10. Score, keywords, and suggestions are blurred with upsell overlay
11. "Unlock Full Results → Buy Credits" CTA in overlay navigates to `/pricing`
12. Pricing page shows 3 columns: Free Preview / Starter ($2.99 · 10cr) / Pro ($4.80 · 20cr)

**Paid tier flow (after purchasing credits):**
13. Navigate to `/analyze` — 5-step flow renders (step 5 visible)
14. Upload resume → paste job description → click "Analyze Match" → step 3 loads
15. Step 4 shows full score gauge + keyword breakdown + suggestion cards (accept/reject)
16. Toggle suggestions → click "Generate Resume" (step 5) → PDF downloads
17. Open downloaded PDF — verify name, sections, and accepted suggestions applied
18. Swap `AI_PROVIDER=openai` in `.env.local` → repeat steps 14–17 to verify abstraction works
