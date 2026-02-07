# Changelog

All notable changes to VelocityPulse Dashboard will be documented in this file.

## [Unreleased]

### Production Cleanup (2026-02-07)

- Removed all demo/hardcoded data from 6 admin pages (`/internal/*`)
- All internal pages now use real Supabase data with proper empty and error states
- Fixed admin pages not accessible due to middleware redirect
- Fixed `useIsStaff` build failure: guard `useUser` against missing ClerkProvider
- Added `.env*.local` to subproject `.gitignore` files

### Operational Hardening (2026-02-07)

- DB-backed rate limiting with `api_usage_monthly` and `api_usage_hourly` tables
- Atomic upsert functions: `increment_monthly_usage()`, `increment_hourly_usage()`
- User-facing audit log page (`/audit-log`) with filtering and pagination
- Device import/export (CSV)
- API key rotation for agents
- Usage quota warnings when approaching plan limits
- Composite database indexes for performance
- Retention pruning functions for old data
- Migration 008: rate limiting, indexes, pruning

### Tier 5 — Testing, Observability, Security, Performance, DX & Growth (2026-02-07)

- 75 unit tests across 3 projects (Vitest): 26 dashboard + 38 agent + 11 web
- Playwright E2E smoke test (`e2e/smoke.spec.ts`)
- Structured logger (`src/lib/logger.ts`) with Sentry `captureException` on errors
- Sentry wired into 10 priority API routes (replaced `console.error` with `logger.error`)
- Health check endpoints (`/api/health` in dashboard + web)
- Complete audit logging for categories, notifications, devices (~11 routes)
- Security middleware (`src/middleware.ts`): CSP, HSTS, X-Frame-Options, rate limiting
- Zod input validation schemas on 7 mutation routes with consistent error format
- Zod env validation (`src/lib/env.ts`) with `getServerEnv`/`getClientEnv`
- Error response helpers (`src/lib/api/errors.ts`): unauthorized, forbidden, notFound, etc.
- Cache-Control headers on GET routes (categories 60s, segments 30s, subscription 300s)
- Usage dashboard (`/usage` page + `/api/dashboard/usage`)
- Device reports with CSV/JSON export (`/reports` page + `/api/dashboard/reports/devices`)
- Referral tracking (migration 007: `referral_code` + `referred_by` columns)
- API documentation (`docs/API.md`) covering all 48 routes

### Tier 4 — Production SaaS Infrastructure (2026-02-07)

- Lifecycle cron (`/api/cron/lifecycle`): trial warning, expiry, grace period, data retention
- Lifecycle emails: welcome, trial warning, expired, activated, cancelled, suspended, payment failed
- Stripe Customer Portal (`/api/billing/portal`)
- Subscription status API (`/api/billing/subscription`)
- Enhanced billing page with subscription card, Stripe Portal button, past-due warning
- Route protection: suspended/cancelled orgs → `/account-blocked`, expired trial → `/trial-expired`
- Admin panel with real data: organizations, subscriptions, trials, audit, support search
- Staff-only admin link in sidebar + header badge via `useIsStaff()` hook
- Vercel cron configured for 6-hourly lifecycle execution

### Tier 3 — Enterprise Features (2026-02-07)

- White-label branding: custom display name, logo, primary color (Unlimited tier)
- SSO/SAML via Clerk Enterprise Connections with per-org domain config (Unlimited tier)
- Analytics page with Recharts: response time LineChart, uptime cards, status timeline
- `device_status_history` table with RLS + pruning (migration 006)
- mDNS scanner (10+ service types) + SSDP scanner with UPnP description XML
- Discovery orchestrator: ARP + mDNS + SSDP in parallel with `mergeDiscoveredDevices()` deduplication
- Zoho Help Desk as third form delivery channel alongside Resend + Supabase

### Tier 2 — Soft Launch Readiness (2026-02-07)

- Form delivery: Resend email + Supabase storage for contact/partner forms
- Stripe cancellation when admin cancels org
- Payment failure email via Resend on `invoice.payment_failed`
- Agent `update_config` command with validated inputs
- Sentry integration for dashboard + web (gated on `NEXT_PUBLIC_SENTRY_DSN`)
- Migrations 004 (notifications) + 005 (form submissions)

### Tier 1 Additions (2026-01-30)

- Agent local UI (Express + Socket.IO on port 3001)
- Realtime command delivery via Supabase Realtime subscription
- Polished installer scripts with uninstall/upgrade support
- Device details modal with SNMP/UPnP info, discovery method, OS hints
- Dashboard connection status indicator (green/amber/red with tooltip)
- Notification system: email, Slack, Teams, webhooks with rules and cooldowns

### Fixed

#### Stripe Integration Fixes (2026-01-30)

**Root Cause:** Vercel environment variables were corrupted with trailing `\n` characters, causing:
1. Stripe API key to be invalid → "Connection to Stripe failed after 3 retries"
2. App URL to be invalid → "Not a valid URL" when creating checkout sessions

**Environment Variables Fixed (17 total):**
- `STRIPE_SECRET_KEY` - Stripe API secret key
- `STRIPE_WEBHOOK_SECRET` - Webhook signature verification
- `STRIPE_STARTER_PRICE_ID` - Starter plan price ID
- `STRIPE_UNLIMITED_PRICE_ID` - Unlimited plan price ID
- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` - Client-side Stripe key
- `NEXT_PUBLIC_STRIPE_STARTER_PRICE_ID` - Client-side starter price
- `NEXT_PUBLIC_STRIPE_UNLIMITED_PRICE_ID` - Client-side unlimited price
- `NEXT_PUBLIC_APP_URL` - Application URL for redirects
- `CLERK_SECRET_KEY` - Clerk authentication
- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` - Client-side Clerk key
- `NEXT_PUBLIC_CLERK_SIGN_IN_URL` - Sign-in route
- `NEXT_PUBLIC_CLERK_SIGN_UP_URL` - Sign-up route
- `NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL` - Post sign-in redirect
- `NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL` - Post sign-up redirect
- `NEXT_PUBLIC_SUPABASE_URL` - Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Supabase anonymous key
- `SUPABASE_SERVICE_ROLE_KEY` - Supabase service role key

**How to Fix Corrupted Vercel Env Vars:**
```javascript
// fix-env.js - Run with: node fix-env.js
const { spawn } = require('child_process');

const envVars = {
  'VAR_NAME': 'value_without_newline',
};

async function setEnvVar(name, value) {
  return new Promise((resolve) => {
    const proc = spawn('npx', ['vercel', 'env', 'add', name, 'production', '--force'], {
      stdio: ['pipe', 'inherit', 'inherit'],
      shell: true
    });
    proc.stdin.write(value); // Write without newline
    proc.stdin.end();
    proc.on('close', resolve);
  });
}

(async () => {
  for (const [name, value] of Object.entries(envVars)) {
    await setEnvVar(name, value);
  }
})();
```

**Key Lesson:** When setting Vercel env vars via CLI, piping values adds newlines. Use stdin.write() without newline to set clean values.

---

#### Next.js 16 Proxy Migration (2026-01-30)

**Change:** Renamed `src/middleware.ts` → `src/proxy.ts`

**Reason:** Next.js 16 deprecated the "middleware" file convention in favor of "proxy" to:
- Clarify its role as a network boundary/routing layer
- Address confusion with Express.js middleware
- Respond to CVE-2025-29927 (middleware auth bypass vulnerability)

**Impact:** None - Clerk's `clerkMiddleware()` function works unchanged, only the filename changed.

---

#### Stripe SDK Downgrade (2026-01-30)

**Change:** Downgraded Stripe packages to match working velocitypulse-web:
- `stripe`: `20.3.0` → `16.12.0`
- `@stripe/stripe-js`: `8.7.0` → `4.10.0`

**Reason:** SDK v20.3.0 had TypeScript incompatibilities with `apiVersion: '2024-06-20'` requiring `@ts-expect-error` comments.

**Note:** This fix was applied but wasn't the root cause. The actual issue was corrupted environment variables (see above).

---

## Stripe Integration Reference

### Environment Variables Required

```bash
# Server-side (secret - never expose to client)
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_STARTER_PRICE_ID=price_...
STRIPE_UNLIMITED_PRICE_ID=price_...

# Client-side (safe to expose)
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
NEXT_PUBLIC_STRIPE_STARTER_PRICE_ID=price_...
NEXT_PUBLIC_STRIPE_UNLIMITED_PRICE_ID=price_...
NEXT_PUBLIC_APP_URL=https://your-app.vercel.app
```

### Stripe SDK Configuration

```typescript
import Stripe from 'stripe'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2024-06-20',
  maxNetworkRetries: 3,
  timeout: 30000,
})
```

### Checkout Session Creation

```typescript
const session = await stripe.checkout.sessions.create({
  customer: customerId,
  payment_method_types: ['card'],
  line_items: [{ price: priceId, quantity: 1 }],
  mode: 'subscription',
  success_url: `${appUrl}/dashboard?checkout=success`,
  cancel_url: `${appUrl}/billing?checkout=cancelled`,
  metadata: { organization_id: orgId },
})
```

### Test Cards

| Card Number | Scenario |
|-------------|----------|
| 4242 4242 4242 4242 | Successful payment |
| 4000 0000 0000 3220 | 3D Secure authentication |
| 4000 0000 0000 9995 | Declined (insufficient funds) |
| 4000 0000 0000 0002 | Declined (generic) |

Use any future expiry date and any 3-digit CVC.
