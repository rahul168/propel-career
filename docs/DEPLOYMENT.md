# Production Deployment Guide — Propel Career

> **Stack**: Next.js 16 · Prisma + PostgreSQL · Clerk (auth) · Stripe (payments) · Vercel (hosting) · Supabase (managed PostgreSQL)

---

## CRITICAL: Security Warning

**Your `.env.example` contains real API keys and secrets.** If this file is committed to a public (or shared) repo, those credentials are compromised and must be rotated immediately:

- Rotate your Anthropic API key at console.anthropic.com
- Rotate your OpenAI API key at platform.openai.com
- Rotate Clerk keys in the Clerk dashboard
- Rotate Stripe keys in the Stripe dashboard
- Regenerate the Stripe webhook secret

After rotating, overwrite `.env.example` with placeholder values only (e.g. `sk-ant-REPLACE_ME`).

---

## Prerequisites

- Node.js 20+ and npm installed locally
- A [Vercel](https://vercel.com) account (free tier works)
- A [Supabase](https://supabase.com) account (free tier works)
- A [Clerk](https://clerk.com) account
- A [Stripe](https://stripe.com) account
- An [Anthropic](https://console.anthropic.com) and/or [OpenAI](https://platform.openai.com) account
- (Optional) An [Adobe PDF Services](https://acrobat.adobe.com/us/en/document-services/pdf-services-api.html) account

---

## Step 1: Prepare the Codebase

### 1.1 Update Prisma Schema for Supabase Connection Pooling

Supabase provides two connection URLs: a **pooler URL** (for the app at runtime) and a **direct URL** (for migrations). Update `prisma/schema.prisma` to use both:

```diff
 datasource db {
   provider = "postgresql"
+  url      = env("DATABASE_URL")
+  directUrl = env("DIRECT_URL")
 }
```

### 1.2 Create `vercel.json` for Extended Function Timeouts

AI inference and PDF generation can exceed Vercel's default 10-second function timeout. A `vercel.json` already exists at the repo root. Confirm it contains:

```json
{
  "functions": {
    "src/app/api/analyze-match/route.ts": { "maxDuration": 60 },
    "src/app/api/suggest-improvements/route.ts": { "maxDuration": 60 },
    "src/app/api/generate-resume/[format]/route.ts": { "maxDuration": 60 },
    "src/app/api/parse-resume/[format]/route.ts": { "maxDuration": 30 },
    "src/app/api/resume-versions/[versionId]/pdf/route.ts": { "maxDuration": 30 }
  }
}
```

> Note: Vercel Hobby plan caps functions at 60s. Pro plan allows up to 300s.

### 1.3 Verify Build Passes Locally

```bash
npm run build
```

Fix any TypeScript or lint errors before deploying.

---

## Step 2: Set Up Supabase (Database)

### 2.1 Create a New Project

1. Go to [supabase.com/dashboard](https://supabase.com/dashboard) → **New project**
2. Choose a name (e.g. `propel-career-prod`), a strong database password, and a region close to your users
3. Wait for the project to initialize (~2 minutes)

### 2.2 Get Your Connection Strings

1. In the Supabase dashboard go to **Settings → Database → Connection string**
2. You need **two** URLs:

   **`DATABASE_URL`** — Transaction pooler (used by the app at runtime)
   - Select the **Transaction** pooler tab
   - Copy the URI (uses port `6543`)
   - Replace `[YOUR-PASSWORD]` with your actual DB password
   - Append `?pgbouncer=true` if not already present

   ```
   postgresql://postgres.xxxx:[PASSWORD]@aws-0-us-east-1.pooler.supabase.com:6543/postgres?pgbouncer=true
   ```

   **`DIRECT_URL`** — Direct connection (used by `prisma migrate`)
   - Select the **Direct connection** tab
   - Copy the URI (uses port `5432`)

   ```
   postgresql://postgres.xxxx:[PASSWORD]@aws-0-us-east-1.pooler.supabase.com:5432/postgres
   ```

### 2.3 Run Database Migrations

Set up a local `.env.production.local` (never commit this) with both URLs, then run:

```bash
# Install dependencies if needed
npm install

# Run all Prisma migrations against the production database
DATABASE_URL="<DIRECT_URL>" npx prisma migrate deploy
```

> Use the **Direct URL** (port 5432) for `prisma migrate deploy` — the pooler does not support the multi-statement transactions that migrations require.

### 2.4 Verify Tables Were Created

In Supabase dashboard → **Table Editor**, confirm these tables exist:
- `User`, `Purchase`, `UsageEvent`, `LlmUsage`, `AdminAuditLog`, `ResumeProject`, `ResumeVersion`

---

## Step 3: Set Up Clerk (Authentication)

### 3.1 Create a Production Instance

1. Go to [clerk.com/dashboard](https://dashboard.clerk.com)
2. If you only have a development instance, create a new **Production** application
3. Configure sign-in methods (Email + any OAuth providers you want)

### 3.2 Get Production Keys

In the Clerk dashboard → **API Keys**:
```
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_live_...
CLERK_SECRET_KEY=sk_live_...
```

### 3.3 Add Your Production Domain

In Clerk → **Domains**, add your Vercel deployment URL (e.g. `propel-career.vercel.app` or your custom domain). Clerk uses this to validate redirect URLs.

### 3.4 Set Redirect URLs

In Clerk → **Paths**, configure:
- Sign-in URL: `/sign-in`
- Sign-up URL: `/sign-up`
- After sign-in: `/analyze`
- After sign-up: `/analyze`

---

## Step 4: Set Up Stripe (Payments)

### 4.1 Switch to Live Mode

In the Stripe dashboard, toggle from **Test** to **Live** mode.

### 4.2 Create Products & Prices

Create two products with one-time prices:

| Product | Price | Credits | Env var |
|---------|-------|---------|---------|
| Starter Pack | $2.99 | 10 credits | `STRIPE_PRICE_10_CREDITS` |
| Pro Pack | $4.80 | 20 credits | `STRIPE_PRICE_20_CREDITS` |

For each price, copy the Price ID (format: `price_xxxxx`) — you'll need these for the environment variables.

### 4.3 Get Live API Keys

In Stripe → **Developers → API keys**:
```
STRIPE_SECRET_KEY=sk_live_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_...
```

### 4.4 Configure the Webhook

1. In Stripe → **Developers → Webhooks** → **Add endpoint**
2. Endpoint URL: `https://YOUR_VERCEL_DOMAIN/api/stripe/webhook`
3. Select events to listen to:
   - `checkout.session.completed`
4. After saving, reveal the **Signing secret**:
   ```
   STRIPE_WEBHOOK_SECRET=whsec_...
   ```

> You must deploy to Vercel first (Step 6) to get the URL, then come back and configure the webhook.

---

## Step 5: Set Up AI Provider

### Option A: Anthropic (Claude) — Recommended

1. Go to [console.anthropic.com](https://console.anthropic.com) → **API Keys** → create a production key
2. Set:
   ```
   AI_PROVIDER=claude
   AI_MODEL=claude-opus-4-6
   ANTHROPIC_API_KEY=sk-ant-...
   ```

### Option B: OpenAI

1. Go to [platform.openai.com](https://platform.openai.com) → **API Keys** → create a production key
2. Set:
   ```
   AI_PROVIDER=openai
   AI_MODEL=gpt-4.1-mini
   OPENAI_API_KEY=sk-proj-...
   ```

---

## Step 6: Deploy to Vercel

### 6.1 Push Your Code

Ensure all changes (Prisma schema update, `vercel.json`) are committed and pushed to GitHub/GitLab/Bitbucket.

### 6.2 Import the Project

1. Go to [vercel.com/new](https://vercel.com/new)
2. Import your git repository
3. Framework preset should auto-detect **Next.js**
4. Leave **Root Directory** as `.` (the repo root)
5. Do **not** deploy yet — configure environment variables first

### 6.3 Add All Environment Variables

In the **Environment Variables** section, add every variable below. Set the environment scope to **Production** (and optionally Preview).

```bash
# AI
AI_PROVIDER=claude
AI_MOCK_MODE=false
AI_MODEL=claude-opus-4-6
ANTHROPIC_API_KEY=sk-ant-...
# OPENAI_API_KEY=sk-proj-...   # Only needed if AI_PROVIDER=openai

# Clerk (Auth)
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_live_...
CLERK_SECRET_KEY=sk_live_...
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL=/analyze
NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL=/analyze

# Stripe
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_...
STRIPE_PRICE_10_CREDITS=price_...
STRIPE_PRICE_20_CREDITS=price_...

# Database (Supabase)
DATABASE_URL=postgresql://postgres.xxxx:[PASSWORD]@...pooler...:6543/postgres?pgbouncer=true
DIRECT_URL=postgresql://postgres.xxxx:[PASSWORD]@...:5432/postgres

# Application
NEXT_PUBLIC_APP_URL=https://YOUR_VERCEL_DOMAIN.vercel.app
CREDIT_REMINDER_THRESHOLD=3
CREDIT_WARNING_THRESHOLD=1

# Adobe PDF Services (optional — skip if not using high-quality PDF conversion)
# ADBE_CLIENT_ID=...
# ADBE_CLIENT_SECRET=...
```

> **`NEXT_PUBLIC_APP_URL`**: Use your actual Vercel deployment URL or custom domain. This is used for internal redirects and links.

### 6.4 Deploy

Click **Deploy**. Vercel will:
1. Install dependencies (`npm install`)
2. Generate Prisma client (`prisma generate` — triggered automatically)
3. Build the Next.js app (`next build`)
4. Deploy to the edge

Watch the build logs. Common failures and fixes:

| Error | Fix |
|-------|-----|
| `Cannot find module '@prisma/client'` | Ensure `prisma generate` runs during build — add it to the `build` script in `package.json`: `"build": "prisma generate && next build"` |
| `Environment variable not found: DATABASE_URL` | Double-check the variable is set in Vercel for the **Production** environment |
| Type errors during build | Run `npm run build` locally first and fix all errors |

---

## Step 7: Post-Deployment Steps

### 7.1 Configure Stripe Webhook (if not done in Step 4.4)

Now that you have the production URL, go to Stripe → **Developers → Webhooks** and add:
```
https://YOUR_VERCEL_DOMAIN.vercel.app/api/stripe/webhook
```

Test the webhook by purchasing credits in production with a real card.

### 7.2 Set Up Your Admin Account

After signing up for an account in production:

1. In the Clerk dashboard → **Users**, find your user
2. Click on your user → **Public metadata**
3. Add:
   ```json
   { "role": "admin" }
   ```

You can now access the admin dashboard at `/admin`.

### 7.3 Smoke Test Checklist

- [ ] Landing page loads at your domain
- [ ] Sign up / sign in with Clerk works
- [ ] `/analyze` page loads for authenticated users
- [ ] Resume upload and job description paste works
- [ ] ATS match analysis runs (check AI keys are valid)
- [ ] Pricing page shows credit packs
- [ ] Stripe Checkout opens (click "Buy Credits")
- [ ] Complete a test purchase using Stripe test card `4242 4242 4242 4242`
- [ ] Credits appear in `/account` after purchase
- [ ] Download DOCX / PDF works
- [ ] `/admin` dashboard is accessible with your admin account

### 7.4 Add Custom Domain (Optional)

In Vercel → **Settings → Domains**, add your custom domain and follow the DNS configuration steps. Update:
- `NEXT_PUBLIC_APP_URL` in Vercel environment variables to your custom domain
- Stripe webhook URL to your custom domain
- Clerk allowed domains to include your custom domain

---

## Step 8: Ongoing Operations

### Monitoring

- **Vercel**: Check **Functions** tab for serverless function errors and latency
- **Supabase**: Check **Database → Logs** for slow queries; monitor storage usage (DOCX bytes are stored in DB)
- **Stripe**: Check **Developers → Events** for failed webhook deliveries
- **Clerk**: Check **Logs** for authentication errors

### Database Maintenance

For future schema changes:
```bash
# Create a new migration (run locally against dev DB)
npx prisma migrate dev --name describe_your_change

# Deploy the migration to production
DATABASE_URL="<DIRECT_URL>" npx prisma migrate deploy
```

### Scaling Considerations

- **DOCX storage**: Resume DOCX files are stored as `BYTEA` in PostgreSQL. Monitor the `ResumeVersion` table size and consider archiving old versions.
- **Supabase free tier**: 500 MB database, 50,000 monthly active users — upgrade to Pro ($25/mo) when you approach limits.
- **Vercel free tier**: 100 GB bandwidth, 100 serverless function invocations per day — upgrade to Pro ($20/mo) for production traffic.
- **Connection pooling**: The `pg.Pool` in `prisma.ts` creates a connection pool per serverless function instance. Supabase's Transaction pooler (PgBouncer) handles this correctly with `?pgbouncer=true`.

---

## Environment Variables Reference

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | Supabase Transaction pooler URL (port 6543) |
| `DIRECT_URL` | Yes | Supabase direct connection URL (port 5432, for migrations) |
| `AI_PROVIDER` | Yes | `claude` or `openai` |
| `AI_MODEL` | Yes | e.g. `claude-opus-4-6` or `gpt-4.1-mini` |
| `AI_MOCK_MODE` | No | Set to `true` only for testing — disables all AI calls |
| `ANTHROPIC_API_KEY` | If claude | Anthropic API key |
| `OPENAI_API_KEY` | If openai | OpenAI API key |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Yes | Clerk public key |
| `CLERK_SECRET_KEY` | Yes | Clerk secret key |
| `NEXT_PUBLIC_CLERK_SIGN_IN_URL` | Yes | `/sign-in` |
| `NEXT_PUBLIC_CLERK_SIGN_UP_URL` | Yes | `/sign-up` |
| `NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL` | Yes | `/analyze` |
| `NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL` | Yes | `/analyze` |
| `STRIPE_SECRET_KEY` | Yes | Stripe live secret key |
| `STRIPE_WEBHOOK_SECRET` | Yes | Stripe webhook signing secret |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Yes | Stripe live publishable key |
| `STRIPE_PRICE_10_CREDITS` | Yes | Stripe Price ID for 10-credit pack |
| `STRIPE_PRICE_20_CREDITS` | Yes | Stripe Price ID for 20-credit pack |
| `NEXT_PUBLIC_APP_URL` | Yes | Full URL of your deployment (no trailing slash) |
| `CREDIT_REMINDER_THRESHOLD` | No | Default: `3` — show reminder at this many credits |
| `CREDIT_WARNING_THRESHOLD` | No | Default: `1` — show warning at this many credits |
| `ADBE_CLIENT_ID` | No | Adobe PDF Services client ID |
| `ADBE_CLIENT_SECRET` | No | Adobe PDF Services client secret |
