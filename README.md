# VelocityPulse

> Your network's heartbeat, at a glance

**Live:** [app.velocitypulse.io](https://app.velocitypulse.io) | **Website:** [velocitypulse.io](https://velocitypulse.io)

Professional network monitoring from $50/year. Auto-discovery, real-time dashboards, multi-tenant SaaS. All development tiers complete.

## Repository Visibility

`velocityeu/velocitypulse` is public so agent releases are downloadable without GitHub credentials.

## Project Structure

```
velocitypulse/
├── velocitypulse-dashboard/   # SaaS dashboard (Next.js 16, Clerk, Stripe, Supabase)
├── velocitypulse-agent/       # Network scanning agent (Node.js, Express, Socket.IO)
├── velocitypulse-web/         # Marketing site (Next.js, Stripe, Framer Motion)
├── supabase/migrations/       # Database migrations (001-008)
└── docs/                      # Product planning & market analysis
```

## Tech Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| Framework | Next.js | 16.1 |
| UI | React | 19.2 |
| Auth | Clerk (Google, Microsoft, Apple SSO) | 6.37 |
| Payments | Stripe | 20.2 |
| Database | Supabase | 2.93 |
| Styling | Tailwind CSS | 4.1 |
| Charts | Recharts | 3.7 |
| Validation | Zod | 4.3 |
| Observability | Sentry | 10.38 |
| Testing | Vitest + Playwright | 4.0 / 1.58 |
| Agent Runtime | Node.js + Express 5 + Socket.IO 4 | 1.1.0 |

## Quick Start

### Dashboard

```bash
cd velocitypulse-dashboard
npm install
# Copy .env.example to .env.local and fill in Clerk, Supabase, Stripe keys
npm run dev          # http://localhost:3000
npm run dev:socket   # Socket server for agent connections
npm test             # Run Vitest unit tests
```

### Agent

```bash
cd velocitypulse-agent
npm install
# Copy .env.example to .env.local and fill in API URL + agent key
npm run dev          # Starts scanning + UI on port 3001
npm test             # Run Vitest unit tests
```

### Marketing Site

```bash
cd velocitypulse-web
npm install
# Copy .env.example to .env.local
npm run dev          # http://localhost:3001
npm test             # Run Vitest unit tests
```

## Deployment

| Component | Platform | Domain |
|-----------|----------|--------|
| Dashboard | Vercel (`velocitypulse-dashboard`) | [app.velocitypulse.io](https://app.velocitypulse.io) |
| Marketing | Vercel (`velocitypulse`) | [velocitypulse.io](https://velocitypulse.io) |
| Database | Supabase | — |
| Auth | Clerk | clerk.velocitypulse.io |
| DNS | GoDaddy | A record `app` → `76.76.21.21` |

**Deploy dashboard:** Run `vercel --prod` from the repo root (Vercel project has root dir set to `velocitypulse-dashboard`). Do NOT run from inside the subdirectory.

**Cron:** Lifecycle automation runs every 6 hours (`0 */6 * * *`) via Vercel Cron at `/api/cron/lifecycle`.

**Migrations:** `npx supabase db push` (requires `SUPABASE_ACCESS_TOKEN` in `.env.local` at project root).

**Agent releases:** published at [github.com/velocityeu/velocitypulse/releases](https://github.com/velocityeu/velocitypulse/releases) (`agent-v*` tags, public download).

## Features

### Completed

- **Multi-tenant SaaS** — Organizations with RBAC (Owner/Admin/Editor/Viewer), invite flow, plan-based limits
- **Network Auto-Discovery** — ARP, ping sweep, SNMP, mDNS, SSDP/UPnP scanning with device deduplication
- **Multi-Adapter Scanning** — Detects all physical network segments across multiple NICs; CIDR-deduplicated, virtual interfaces filtered (v1.1.0)
- **Real-time Monitoring** — Live device status, response time tracking, status hysteresis, segment grouping
- **Notifications** — Email, Slack, Teams, webhooks with rules and cooldowns
- **White-label Branding** — Custom display name, logo, primary color (Unlimited tier)
- **SSO/SAML** — Clerk Enterprise Connections with per-org domain config (Unlimited tier)
- **Analytics** — Device status history, uptime charts, response time graphs (Recharts)
- **Admin Backend** — Organization management, subscription admin, trial tracking, audit logs, support search
- **Billing** — Stripe checkout, customer portal, lifecycle automation (trial expiry, grace periods, data retention)
- **Security** — CSP, HSTS, rate limiting (in-memory + DB-backed), Zod validation, audit logging
- **Observability** — Structured logger with Sentry, health checks, complete audit trail
- **Testing** — 75 unit tests (Vitest) across 3 projects + Playwright E2E smoke test
- **48 API endpoints** documented in [API.md](velocitypulse-dashboard/docs/API.md)

## Pricing

### 30-Day Trial — Free
Full access, no credit card required. Up to 100 devices, 10 agents, 5 users.

### Starter Tier — $50/year

| Currency | Annual Price |
|----------|--------------|
| USD | $50/year |
| GBP | £50/year |
| EUR | €50/year |

**Includes:** Up to 100 devices, 10 agents, 10 users, 50K API calls/mo, 1-year data retention, all core features, email/Slack/Teams alerts, API access, email support (48h response).

**Target:** Small businesses, single-site schools, home labs, getting started.

### Unlimited Tier — $950/year

| Currency | Annual Price |
|----------|--------------|
| USD | $950/year |
| GBP | £750/year |
| EUR | €850/year |

**Includes:** Up to 5,000 devices (unlockable on request), 100 agents, 50 users, unlimited API calls, 1-year data retention, SSO (SAML), white-label option, priority support (24h email, phone available), dedicated onboarding.

**Target:** Growing SMBs, MATs, multi-site organizations.

### Partner Program — 50% Off Retail

| Tier | Retail | Partner Price |
|------|--------|---------------|
| Starter | $50/year | $25/year per customer |
| Unlimited | $950/year | $475/year per customer |

**Rules:** 50% off retail, per-customer licensing, must declare each customer, no pooling.

## Product Vision

**VelocityPulse** is professional network monitoring that doesn't break the bank. Start at $50/year for up to 100 devices. Scale to unlimited for $950/year. No per-device pricing, no surprises. The anti-Nagios.

## Target Markets

- Home labs and hobbyists
- Small businesses (any size)
- UK Schools & Multi-Academy Trusts
- Growing SMBs (100-500+ devices)
- Managed Service Providers (MSPs)

## Positioning

**"Professional network monitoring from $50/year"**

- Start at $50/year for up to 100 devices
- Scale to unlimited for $950/year
- 10-minute onboarding (vs days for Nagios/Zabbix)
- Auto-discovery (no manual configuration)
- Real-time by default (not polling)
- Cheaper than Datadog at just 5 devices

## Documentation

| Document | Description |
|----------|-------------|
| [Dashboard README](velocitypulse-dashboard/README.md) | Dashboard setup, architecture, env vars |
| [Agent README](velocitypulse-agent/README.md) | Agent installation, scanning, commands |
| [Web README](velocitypulse-web/README.md) | Marketing site setup |
| [API Reference](velocitypulse-dashboard/docs/API.md) | All 48 API endpoints |
| [Development Plan](DEVELOPMENT_PLAN.md) | Feature comparison, implementation history |
| [docs/product-spec.md](docs/product-spec.md) | Technical requirements |
| [docs/pricing.md](docs/pricing.md) | Pricing strategy and rationale |
| [docs/competitors.md](docs/competitors.md) | Competitive analysis |
| [docs/messaging.md](docs/messaging.md) | Brand voice and copy guidelines |
| [docs/market-analysis.md](docs/market-analysis.md) | TAM/SAM/SOM and revenue projections |

---

*Part of the [Velocity EU](https://github.com/velocityeu) project family.*
