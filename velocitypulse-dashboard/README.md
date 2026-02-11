# VelocityPulse Dashboard

SaaS network monitoring dashboard. Multi-tenant, real-time device monitoring with auto-discovery, notifications, billing, and admin tools.

**Live:** [app.velocitypulse.io](https://app.velocitypulse.io)

## Tech Stack

| Technology | Version |
|-----------|---------|
| Next.js | 16.1 |
| React | 19.2 |
| Clerk (auth) | 6.37 |
| Stripe (billing) | 20.2 |
| Supabase (database) | 2.93 |
| Tailwind CSS | 4.1 |
| Recharts (charts) | 3.7 |
| Zod (validation) | 4.3 |
| Sentry (observability) | 10.38 |
| Vitest (unit tests) | 4.0 |
| Playwright (E2E) | 1.58 |

## Prerequisites

- Node.js >= 20.0.0
- Supabase project (with migrations applied)
- Clerk application
- Stripe account with products/prices configured

## Environment Variables

Create `.env.local` from `.env.example`:

### Clerk (Auth)
```
CLERK_SECRET_KEY=sk_...
CLERK_WEBHOOK_SECRET=whsec_...
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_...
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
NEXT_PUBLIC_CLERK_SIGN_IN_FALLBACK_REDIRECT_URL=/
NEXT_PUBLIC_CLERK_SIGN_UP_FALLBACK_REDIRECT_URL=/
```

### Supabase (Database)
```
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
```

### Stripe (Billing)
```
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_STARTER_PRICE_ID=price_...
STRIPE_UNLIMITED_PRICE_ID=price_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
NEXT_PUBLIC_STRIPE_STARTER_PRICE_ID=price_...
NEXT_PUBLIC_STRIPE_UNLIMITED_PRICE_ID=price_...
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### Sentry (Observability)
```
NEXT_PUBLIC_SENTRY_DSN=https://...@sentry.io/...
SENTRY_AUTH_TOKEN=sntrys_...
```

### Resend (Email)
```
RESEND_API_KEY=re_...
RESEND_FROM_EMAIL=VelocityPulse <noreply@velocitypulse.io>
```

### Cron
```
CRON_SECRET=your-secret
```

## Scripts

```bash
npm run dev          # Start Next.js dev server (port 3000)
npm run dev:socket   # Start Socket.IO server for agent connections
npm run build        # Production build
npm test             # Run Vitest unit tests (26 tests)
npm run test:e2e     # Run Playwright E2E smoke test
npm run lint         # ESLint
```

## Project Structure

```
src/
├── app/
│   ├── (auth)/                    # Auth pages (4)
│   │   ├── sign-in/
│   │   ├── sign-up/
│   │   ├── account-blocked/
│   │   └── trial-expired/
│   ├── (dashboard)/               # User-facing pages (14)
│   │   ├── monitor/
│   │   ├── agents/
│   │   ├── devices/
│   │   ├── categories/
│   │   ├── notifications/
│   │   ├── analytics/
│   │   ├── settings/
│   │   ├── billing/
│   │   ├── members/
│   │   ├── usage/
│   │   ├── reports/
│   │   ├── audit-log/
│   │   ├── onboarding/
│   │   └── page.tsx               # Dashboard home
│   ├── (internal)/                # Admin pages (7)
│   │   └── internal/
│   │       ├── dashboard/
│   │       ├── organizations/
│   │       ├── subscriptions/
│   │       ├── trials/
│   │       ├── audit/
│   │       ├── support/
│   │       └── page.tsx
│   └── api/                       # API routes (48)
│       ├── agent/                 # Agent endpoints (heartbeat, devices, commands)
│       ├── billing/               # Stripe checkout, portal, subscription
│       ├── cron/                  # Lifecycle automation
│       ├── dashboard/             # Dashboard data (agents, analytics, branding, etc.)
│       ├── health/                # Health check
│       ├── internal/              # Admin APIs
│       ├── notifications/         # Channel + rule CRUD
│       ├── onboarding/            # Org creation
│       └── webhook/               # Stripe webhooks
├── components/
│   ├── dashboard/                 # Device grid, list, sort, filter, status
│   ├── layout/                    # DashboardShell, Sidebar, Header, Footer
│   └── ui/                        # Shared UI primitives
├── lib/
│   ├── api/                       # Error helpers, Clerk SSO utils
│   ├── emails/                    # Lifecycle email templates
│   ├── hooks/                     # useBranding, useIsStaff
│   ├── notifications/             # Notification service + senders
│   ├── validations/               # Zod input schemas
│   ├── constants.ts               # Plan limits, feature gates
│   ├── env.ts                     # Zod env validation
│   ├── logger.ts                  # Structured logger (Sentry integration)
│   ├── supabase.ts                # Supabase client
│   └── stripe.ts                  # Stripe client
├── types/                         # TypeScript interfaces
└── proxy.ts                        # Security headers, rate limiting, route protection
```

## Authentication Model

| Method | Used By | Details |
|--------|---------|---------|
| Clerk JWT | Dashboard users | Session cookie, middleware-protected routes |
| API Key | Agents | `x-agent-key`, `x-api-key`, or `Authorization: Bearer` header, validated against `agents` table |
| CRON_SECRET | Vercel Cron | `Authorization: Bearer` header on `/api/cron/*` |
| Staff role | Internal admins | `users.is_staff` in Supabase, set by Clerk webhook based on `publicMetadata.role` |

**Production Clerk domain:** `clerk.velocitypulse.io` — Social login providers configured: Google, Microsoft, Apple.

## Security

- **CSP** — Content Security Policy allowing `clerk.velocitypulse.io`, `*.clerk.accounts.dev`, Supabase, Stripe, Sentry domains
- **HSTS** — Strict-Transport-Security with 1-year max-age
- **Rate Limiting** — In-memory per-IP (agent endpoints: 30-120/min, user mutations: 5-10/min) + DB-backed monthly/hourly tracking
- **Input Validation** — Zod schemas on 7 mutation routes with consistent error format
- **Audit Logging** — All CRUD operations logged to `audit_logs` table
- **Route Protection** — Suspended/cancelled orgs redirected to status pages, billing routes always accessible

## Testing

- **26 unit tests** (Vitest) — API route tests for heartbeat, device status, agents CRUD, billing, onboarding
- **Playwright E2E** — Smoke test for critical user flows
- **Test setup** mocks Clerk, Supabase, and Next.js headers

## Deployment

Deployed on Vercel with root directory set to `velocitypulse-dashboard`.

**Main branch CD:** Push to `main` triggers GitHub workflow `main-build-deploy.yml`, which rebuilds all components and deploys dashboard + marketing to Vercel.

**Manual deploy fallback:** Run `vercel --prod` from the **repo root** (`C:\Projects\velocitypulse`). Do NOT run from inside this subdirectory.

**Cron schedules:**

- `0 */6 * * *` — `/api/cron/lifecycle` (trial warnings, expiry enforcement, grace periods, data retention cleanup).
- `*/10 * * * *` — `/api/cron/notifications` (retry queue processing + dead-letter promotion for failed notifications).

## API Documentation

See [docs/API.md](docs/API.md) for primary endpoints and an additional endpoint summary.
