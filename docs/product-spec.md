# VelocityPulse - Product Specification

**Website:** [velocitypulse.io](https://velocitypulse.io)
**Dashboard:** [app.velocitypulse.io](https://app.velocitypulse.io)

Multi-tenant SaaS network monitoring platform.

## Overview

VelocityPulse is a multi-tenant SaaS network monitoring platform built on:
- **Dashboard:** Next.js 16, React 19, TypeScript, Tailwind CSS
- **Auth:** Clerk (identity-only — sessions, social login, sign-in)
- **Database:** Supabase (PostgreSQL + RLS for multi-tenancy)
- **Billing:** Stripe (subscriptions, Checkout, Apple Pay, Google Pay)
- **Agent:** Node.js, TypeScript, Express, Socket.IO
- **Infrastructure:** Vercel (dashboard), Supabase (database + realtime)
- **Observability:** Sentry, structured logger

## Architecture

### Auth & Identity
- **Clerk** handles authentication, sessions, and social login (Google, Microsoft, Apple)
- **Supabase `users` table** (migration 009) caches Clerk profile data (email, name, avatar, is_staff)
- Clerk webhook (`/api/webhook/clerk`) syncs `user.created`, `user.updated`, `user.deleted` events via svix
- Staff/admin role stored in `users.is_staff` column (synced from Clerk `publicMetadata.role`)
- Clerk is treated as an identity provider only — all app data lives in Supabase

### Multi-Tenancy
- Tenant isolation via Supabase Row Level Security (RLS)
- Organization/workspace model with role-based permissions (owner/admin/editor/viewer)
- Agent auth independent of Clerk (API key-based)
- Billing tied to Supabase orgs (not Clerk orgs)

## Implemented Features

### Core (Tier 1-2)
- Multi-tenant data isolation (RLS on all tables)
- Organization/workspace model with 4 roles (owner/admin/editor/viewer)
- Clerk auth with social login (Google, Microsoft, Apple)
- Stripe billing (subscriptions, Checkout, Apple Pay, Google Pay)
- Agent provisioning with API key auth
- Network discovery (ARP, mDNS, SSDP)
- Notification channels (email, Slack, Teams, webhook)
- Form delivery (Resend + Supabase + Zoho)

### Advanced (Tier 3-4)
- White-label branding (custom name, logo, color — unlimited tier)
- SSO/SAML support (unlimited tier)
- Analytics & uptime reporting
- Admin backend (`/internal/*` routes)
- Billing self-service (change plan, cancel, reactivate, update payment)
- Lifecycle automation (trial warnings, expiry, suspension, data purge)

### Operational (Tier 5+)
- 26 Vitest tests
- Sentry + structured logger
- Security middleware (CSP, rate limiting, security headers)
- Zod input validation
- DB-backed rate limiting & API usage tracking
- Device export/import
- User-facing audit log
- API key rotation with usage quota warnings
- Cron pruning (audit logs 365d, API usage 7d)
- Referral tracking
- Users table in Supabase with Clerk webhook sync (migration 009)

## Database Schema

### Supabase Migrations (001-009)

| Migration | Description |
|-----------|-------------|
| 001 | Multi-tenant schema (organizations, members, agents, segments, devices, categories, subscriptions, audit_logs) |
| 002 | RLS policies for all tables |
| 003 | Agent cascade delete |
| 004 | Notification channels, rules, history |
| 005 | Form submissions |
| 006 | Org branding, SSO fields, analytics (device_status_history) |
| 007 | Usage tracking, referrals, API usage |
| 008 | Operational hardening (rate limits, export/import, cron pruning functions) |
| 009 | Users table (Clerk profile cache: email, name, avatar, is_staff) |

### Key Tables

- `organizations` — tenants with plan, limits, branding, SSO config
- `organization_members` — user-org mapping with role + granular permissions
- `users` — Clerk profile cache (synced via webhook), staff flag
- `agents` — network scanning agents with API key auth
- `devices` — monitored devices with status, discovery metadata
- `categories` — device groupings per org
- `network_segments` — CIDR ranges assigned to agents
- `subscriptions` — Stripe subscription records
- `audit_logs` — all user/system/webhook actions
- `notification_channels` + `notification_rules` — alerting config

### Row Level Security

All tables have RLS enabled. Service role key bypasses RLS for API routes. Organization-scoped queries use `organization_id` filtering.

## API Endpoints

### Agent API (API key auth)

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/agent/heartbeat` | POST | Agent check-in, returns config + pending commands |
| `/api/agent/devices/discovered` | POST | Submit discovered devices from scans |
| `/api/agent/devices/status` | POST | Submit device status reports |
| `/api/agent/segments/register` | POST | Auto-register network segments |
| `/api/agent/ping` | GET | Agent connectivity check |

### Dashboard API (Clerk session auth)

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/onboarding` | GET/POST | Check/create organization |
| `/api/dashboard/members` | GET/POST | List/invite members |
| `/api/dashboard/agents` | GET/POST | Manage agents |
| `/api/checkout/embedded` | POST | Create Stripe Checkout session |
| `/api/billing/*` | Various | Plan changes, cancel, reactivate, payment update |

### Webhook Endpoints (public, signature-verified)

| Endpoint | Provider | Events |
|----------|----------|--------|
| `/api/webhook/stripe` | Stripe | checkout.session.completed, subscription.*, invoice.* |
| `/api/webhook/clerk` | Clerk/Svix | user.created, user.updated, user.deleted |

### Internal API (staff auth via `users.is_staff`)

| Endpoint | Description |
|----------|-------------|
| `/api/internal/organizations` | Admin org management |
| `/api/internal/stats` | Platform statistics |

### Cron Jobs (Vercel Cron)

| Endpoint | Schedule | Description |
|----------|----------|-------------|
| `/api/cron/lifecycle` | Every 6h | Trial warnings/expiry, grace period enforcement, data purge, log pruning |

## Security

- **Middleware**: CSP headers, rate limiting, security headers on all routes
- **Auth**: Clerk sessions for dashboard, API keys for agents, svix signatures for webhooks
- **Data**: RLS on all tables, service role for server-side, org-scoped queries
- **Staff**: `users.is_staff` in Supabase (not Clerk metadata) — checked in middleware + internal-auth
- **Validation**: Zod schemas on all user input via `validateRequest()`

## Deployment

- **Dashboard**: Vercel project `velocitypulse-dashboard`, production at `app.velocitypulse.io`
- **Auth**: Clerk production instance at `clerk.velocitypulse.io`
- **Database**: Supabase project `velocitypulse-dashboard` (London region)
- **DNS**: `velocitypulse.io` on GoDaddy, A record `app` -> `76.76.21.21`

### Environment Variables (Vercel — dashboard project)

| Variable | Purpose |
|----------|---------|
| `CLERK_SECRET_KEY` | Clerk Backend API |
| `CLERK_WEBHOOK_SECRET` | Svix signature verification for Clerk webhooks |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Clerk frontend |
| `STRIPE_SECRET_KEY` | Stripe Backend API |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook signature verification |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase admin access (bypasses RLS) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase client access (RLS enforced) |

### Plans

| Plan | Devices | Agents | Users |
|------|---------|--------|-------|
| Trial (14 days) | 25 | 1 | 3 |
| Starter | 100 | 3 | 10 |
| Unlimited | Unlimited | Unlimited | Unlimited |

---

*Last updated: February 2026*
