# VelocityPulse Development Plan

## Executive Summary

VelocityPulse is a commercial SaaS version of the open-source IT-Dashboard project. This document provides a comprehensive comparison of what has been implemented versus what remains from the original project, plus what additional SaaS features have been added.

**Current Status: All Tiers Complete (1-5 + Operational Hardening + Production Cleanup + Production Launch)**

---

## Part 1: Feature Comparison

### Original IT-Dashboard Features vs VelocityPulse Implementation

| Feature | IT-Dashboard | VelocityPulse | Status |
|---------|--------------|---------------|--------|
| **Core Monitoring** |
| Device status monitoring | Yes | Yes | COMPLETE |
| Real-time updates (Supabase) | Yes | Yes | COMPLETE |
| Multiple check types (ping/tcp/http) | Yes | Yes | COMPLETE |
| Response time tracking | Yes | Yes | COMPLETE |
| Status hysteresis | Yes | Yes | COMPLETE |
| **Device Discovery** |
| ARP scanning | Yes | Yes | COMPLETE |
| Ping sweep | Yes | Yes | COMPLETE |
| SNMP discovery | Yes | Yes | COMPLETE |
| SSDP/UPnP discovery | Yes | Yes | COMPLETE |
| mDNS discovery | Yes | Yes | COMPLETE - needs edge case testing |
| Hostname resolution (DNS + NetBIOS) | Yes | Yes | COMPLETE |
| MAC/manufacturer lookup | Yes | Yes | COMPLETE |
| **Network Segments** |
| Segment management | Yes | Yes | COMPLETE |
| Auto-segment registration | Yes | Yes | COMPLETE |
| Per-segment scan intervals | Yes | Yes | COMPLETE |
| **Agent Features** |
| Agent heartbeat | Yes | Yes | COMPLETE |
| Agent version tracking | Yes | Yes | COMPLETE |
| Auto-upgrade mechanism | Yes | Yes | COMPLETE - upgrade logic + installer scripts |
| Command queue (scan/restart/upgrade) | Yes | Yes | COMPLETE |
| Agent local UI | Yes | Yes | COMPLETE - Express + Socket.IO on port 3001 |
| Realtime command delivery | Yes | Yes | COMPLETE - Supabase Realtime subscription |
| **Dashboard UI** |
| Device grid view | Yes | Yes | COMPLETE |
| Device list view | Yes | Yes | COMPLETE |
| Device compact view | Yes | Yes | COMPLETE |
| Category filtering | Yes | Yes | COMPLETE |
| Search/filter | Yes | Yes | COMPLETE |
| Sorting controls | Yes | Yes | COMPLETE |
| Device details modal | Yes | Yes | COMPLETE |
| Status summary cards | Yes | Yes | COMPLETE |
| View mode toggle | Yes | Yes | COMPLETE |
| Segment grouping (collapsible) | Yes | Yes | COMPLETE |
| **Admin Features** |
| Agent management | Yes | Yes | COMPLETE |
| Device CRUD | Yes | Yes | COMPLETE |
| Category management | Yes | Yes | COMPLETE |
| User management | Yes | Yes | COMPLETE (enhanced with RBAC) |
| Ping/pong connectivity test | Yes | Yes | COMPLETE |
| **Theme** |
| Dark/light mode | Yes | Yes | COMPLETE |
| System preference detection | Yes | Yes | COMPLETE |

### New SaaS Features (Not in Original)

| Feature | Status | Notes |
|---------|--------|-------|
| **Multi-Tenancy** |
| Organizations | COMPLETE | Full org isolation |
| Organization members | COMPLETE | With invite flow |
| Role-based access control | COMPLETE | Owner/Admin/Editor/Viewer |
| Per-role permissions | COMPLETE | Granular permission system |
| **Authentication** |
| Clerk integration | COMPLETE | Sign-up/sign-in/SSO-ready |
| Session management | COMPLETE | Middleware protected routes |
| **Billing** |
| Stripe integration | COMPLETE | Checkout + webhooks |
| Subscription management | COMPLETE | Trial/Starter/Unlimited |
| Plan-based limits | COMPLETE | Device/agent/user limits |
| Billing portal | COMPLETE | Stripe customer portal |
| Subscription self-service | COMPLETE | View plan, manage via Stripe Portal |
| **Lifecycle Automation** |
| Route protection | COMPLETE | Middleware blocks suspended/cancelled/expired orgs |
| Trial expiry automation | COMPLETE | Cron-based trial warning + expiry enforcement |
| Grace period enforcement | COMPLETE | 7-day grace after payment failure |
| Data retention cleanup | COMPLETE | 30-day purge after cancellation |
| Lifecycle emails | COMPLETE | Welcome, trial warning, expired, activated, cancelled, suspended |
| **Admin (Internal)** |
| Organization admin | COMPLETE | View all customers |
| Subscription admin | COMPLETE | Manage plans |
| Trial tracking | COMPLETE | Trial analytics |
| Audit logs | COMPLETE | Activity tracking |
| Support search | COMPLETE | Customer lookup |
| Admin link in dashboard | COMPLETE | Staff-only sidebar/header link to /internal |
| **Marketing Site** |
| Landing page | COMPLETE | velocitypulse.io |
| Pricing page | COMPLETE | Plan comparison |
| Features page | COMPLETE | Feature showcase |
| Contact/demo forms | COMPLETE | Lead capture (email + Supabase delivery) |
| Legal pages | COMPLETE | Privacy/Terms/GDPR |
| **Onboarding** |
| First-time setup | COMPLETE | Org creation flow |
| Agent download | COMPLETE | Polished installers with uninstall/upgrade |

---

## Part 2: Detailed Gap Analysis

### Critical Gaps (MVP Blockers)

1. ~~**Agent Command Execution**~~ - COMPLETE
2. ~~**Device Discovery API**~~ - COMPLETE
3. ~~**Agent Ping/Pong**~~ - COMPLETE
4. ~~**List/Compact View Modes**~~ - COMPLETE

### Important Gaps (Post-MVP)

1. ~~**Agent Local UI**~~ - COMPLETE (Express + Socket.IO on port 3001)
2. ~~**Realtime Command Delivery**~~ - COMPLETE (Supabase Realtime subscription)
3. ~~**Device Details Modal**~~ - COMPLETE (SNMP/UPnP info, discovery method, OS hints)
4. ~~**Dashboard Connection Status**~~ - COMPLETE (Real-time agent status indicator with tooltip)

### Nice-to-Have Gaps

1. ~~**Notifications**~~ - COMPLETE (Email/Slack/Teams/Webhooks with rules and cooldowns)
2. ~~**Custom Webhooks**~~ - COMPLETE (generic webhook sender)
3. ~~**Error Tracking**~~ - COMPLETE (Sentry integration on web + dashboard)
4. ~~**Form Delivery**~~ - COMPLETE (Resend email + Supabase storage for contact/partner forms)
5. ~~**Stripe Cancellation**~~ - COMPLETE (admin cancel cancels Stripe subscription)
6. ~~**Payment Failure Email**~~ - COMPLETE (Resend email on invoice.payment_failed)
7. ~~**White-label**~~ - COMPLETE (custom branding for unlimited tier: display name, logo, primary color)
8. ~~**Advanced Analytics**~~ - COMPLETE (device status history, uptime charts, response time graphs via Recharts)
9. ~~**SSO (SAML)**~~ - COMPLETE (Clerk Enterprise Connections, per-org domain + IdP config)
10. ~~**mDNS + SSDP Discovery**~~ - COMPLETE (parallel multicast scanning with device deduplication)
11. ~~**Zoho Help Desk**~~ - COMPLETE (third form delivery channel alongside Resend + Supabase)

---

## Part 3: Implementation Progress

### Completed (Sprint 1 & 2)

#### Agent API Endpoints

| Endpoint | File | Status |
|----------|------|--------|
| `POST /api/agent/devices/discovered` | `src/app/api/agent/devices/discovered/route.ts` | COMPLETE |
| `GET /api/agent/devices` | `src/app/api/agent/devices/route.ts` | COMPLETE |
| `POST /api/agent/ping` | `src/app/api/agent/ping/route.ts` | COMPLETE |
| `POST /api/agent/commands/[id]/ack` | `src/app/api/agent/commands/[commandId]/ack/route.ts` | COMPLETE |

#### Agent Command Handling

| Command | Status |
|---------|--------|
| `ping` | COMPLETE |
| `scan_now` | COMPLETE |
| `scan_segment` | COMPLETE |
| `restart` | COMPLETE |
| `upgrade` | COMPLETE (acknowledgment only) |
| `update_config` | COMPLETE |

#### Dashboard UI Components

| Component | File | Status |
|-----------|------|--------|
| DeviceGrid | `src/components/dashboard/DeviceGrid.tsx` | COMPLETE |
| DeviceListRow | `src/components/dashboard/DeviceListRow.tsx` | COMPLETE |
| DeviceCardCompact | `src/components/dashboard/DeviceCardCompact.tsx` | COMPLETE |
| ViewToggle | `src/components/dashboard/ViewToggle.tsx` | COMPLETE |
| SortControls | `src/components/dashboard/SortControls.tsx` | COMPLETE |
| CategoryChips | `src/components/dashboard/CategoryChips.tsx` | COMPLETE |
| StatusSummary | `src/components/dashboard/StatusSummary.tsx` | COMPLETE |

#### New Pages

| Page | File | Status |
|------|------|--------|
| Monitor | `src/app/(dashboard)/monitor/page.tsx` | COMPLETE |

---

## Part 4: Remaining Development Roadmap

### Phase 3: Agent Improvements (Priority: MEDIUM) - COMPLETE

#### 3.1 Agent Local UI - COMPLETE
- [x] Create Express + Socket.IO server (`src/ui/server.ts`)
- [x] Build web UI (connection status, segments, devices, logs) (`src/ui/public/index.html`)
- [x] Add manual scan button
- [x] Add ping dashboard button
- [x] Real-time state updates via WebSocket

#### 3.2 Realtime Command Delivery - COMPLETE
- [x] Add Supabase Realtime subscription to agent (`src/api/realtime.ts`)
- [x] Subscribe to `agent_commands` table (INSERT/UPDATE events)
- [x] Execute commands immediately on receipt
- [x] Fall back to heartbeat polling
- [x] Auto-reconnect on connection loss

#### 3.3 Installer Scripts - COMPLETE
- [x] Polish Windows installer (install.ps1) - added -Uninstall, -Upgrade, -UIPort
- [x] Polish Linux/macOS installer (install.sh) - added --uninstall, --upgrade, --unattended
- [x] Create service installation (NSSM/systemd/launchd)
- [x] Create uninstaller scripts (integrated into main installers)
- [x] Added ENABLE_REALTIME and AGENT_UI_PORT to default config

### Phase 4: Enhanced Features (Priority: MEDIUM) - COMPLETE

#### 4.1 Device Details Enhancement - COMPLETE
- [x] Show SNMP info (sysName, sysDescr, sysContact, sysLocation)
- [x] Show UPnP info (friendlyName, deviceType, manufacturer)
- [x] Show open ports and services (already existed)
- [x] Show discovery method and timestamps
- [x] Show OS hints as badges

#### 4.2 Connection Status - COMPLETE
- [x] Show realtime agent status indicator in dashboard header
- [x] Track agent online/offline via Supabase Realtime
- [x] Color-coded indicator (green/amber/red) with tooltip
- [x] Per-agent status in tooltip with last seen time

### Phase 5: Notifications (Priority: LOW) - COMPLETE

#### 5.1 Notification System - COMPLETE
- [x] Design notification preferences schema (channels, rules, history, cooldowns)
- [x] Implement email notifications (Resend API)
- [x] Implement Slack webhook integration (rich blocks format)
- [x] Implement Teams webhook integration (Adaptive Cards)
- [x] Implement generic webhook sender
- [x] Create notification service with cooldown/rate-limiting
- [x] Add notification settings page (channels + rules management)
- [x] Add notification trigger on device status change
- [x] Add Notifications link to sidebar

### Phase 6: Soft Launch Readiness (Priority: HIGH) - COMPLETE

#### 6.1 Billing Hardening - COMPLETE
- [x] Cancel Stripe subscription when admin cancels org
- [x] Send payment failure email via Resend on invoice.payment_failed
- [x] Marketing site Stripe webhook stubs cleaned up (dashboard handles all billing)

#### 6.2 Form Delivery - COMPLETE
- [x] Contact form: email via Resend + store in Supabase `form_submissions` table
- [x] Partner form: email via Resend + store in Supabase `form_submissions` table
- [x] Graceful degradation when Resend/Supabase not configured

#### 6.3 Agent update_config Command - COMPLETE
- [x] Runtime config updates (heartbeatInterval, statusCheckInterval, logLevel, etc.)
- [x] Validated inputs with minimum value enforcement
- [x] Returns applied changes in command acknowledgment

#### 6.4 Error Tracking (Sentry) - COMPLETE
- [x] @sentry/nextjs integrated in velocitypulse-web
- [x] @sentry/nextjs integrated in velocitypulse-dashboard
- [x] ErrorBoundary reports to Sentry in production
- [x] Gated on NEXT_PUBLIC_SENTRY_DSN (disabled until DSN configured)

### Phase 7: Enterprise Features (Priority: LOW) - COMPLETE

#### 7.1 White-Label Branding - COMPLETE
- [x] Custom branding support (display name, logo URL, primary color)
- [x] `useBranding()` hook with `resolveBranding()` for non-hook use
- [x] Branding API route (`PUT /api/dashboard/branding`) with validation + audit logging
- [x] Layout components (DashboardShell, Sidebar, Header, Footer) use resolved branding
- [x] Settings page Branding tab (conditional on unlimited plan) with preview + reset
- [x] Gated to unlimited tier via `PLAN_LIMITS.whiteLabel`

#### 7.2 SSO/SAML - COMPLETE
- [x] SAML integration via Clerk Enterprise Connections API
- [x] SSO API routes (`GET/PUT/DELETE /api/dashboard/sso`)
- [x] Settings page SSO tab with domain input, metadata URL, IdP config details (ACS URL, Entity ID)
- [x] Enable/disable toggle with graceful Clerk plan detection
- [x] Gated to unlimited tier via `PLAN_LIMITS.sso`

#### 7.3 Advanced Analytics - COMPLETE
- [x] `device_status_history` table with RLS + pruning function (migration 006)
- [x] Fire-and-forget history INSERT in device status update route
- [x] Analytics API (`GET /api/dashboard/analytics?range=24h|7d|30d&deviceId=`)
- [x] Analytics page with Recharts: response time LineChart, uptime cards, status timeline
- [x] Device selector dropdown and time range toggle
- [x] Sidebar Analytics nav item with BarChart3 icon

#### 7.4 mDNS + SSDP Discovery - COMPLETE
- [x] mDNS scanner querying 10+ service types (`_http._tcp`, `_printer._tcp`, `_googlecast._tcp`, etc.)
- [x] SSDP scanner with UPnP description XML fetching (friendlyName, manufacturer)
- [x] Discovery orchestrator runs ARP + mDNS + SSDP in parallel for local networks
- [x] `mergeDiscoveredDevices()` deduplicates by IP, merges fields from all sources
- [x] CIDR filtering for mDNS/SSDP results before merge
- [x] `multicast-dns` npm package installed; `node-ssdp` already present

#### 7.5 Zoho Help Desk Integration - COMPLETE
- [x] Fixed optional `phone`/`website` params in `createPartnerApplicationTicket`
- [x] Added `ZOHO_DEPARTMENT_ID` to env schema
- [x] Wired Zoho as third delivery channel in `form-delivery.ts` via `Promise.allSettled`
- [x] Skips silently if Zoho not configured; failures don't affect other channels

### Phase 8: Production SaaS Infrastructure (Priority: HIGH) - COMPLETE

#### 8.1 Route Protection & Access Control - COMPLETE
- [x] Enhanced `proxy.ts` with org status enforcement (suspended/cancelled → `/account-blocked`, expired trial → `/trial-expired`)
- [x] Billing routes bypass org status checks (must remain accessible when blocked)
- [x] Account blocked page with suspended/cancelled states, payment update button, contact support
- [x] Trial expired page with pricing cards and subscribe CTAs
- [x] Internal routes require staff role via Clerk publicMetadata

#### 8.2 Customer Billing Self-Service - COMPLETE
- [x] Stripe Customer Portal API (`POST /api/billing/portal`) with `can_manage_billing` permission check
- [x] Subscription status API (`GET /api/billing/subscription`) returns plan, status, renewal date, amount
- [x] Enhanced billing page with current subscription card, Stripe Portal button, past-due warning banner
- [x] "Change Plan" anchor link to pricing cards section

#### 8.3 Lifecycle Automation - COMPLETE
- [x] Shared lifecycle email utility (`src/lib/emails/lifecycle.ts`) with HTML templates
- [x] Email functions: welcome, trial warning (3 days), trial expired, subscription activated, subscription cancelled, account suspended, payment failed
- [x] Lifecycle cron endpoint (`GET /api/cron/lifecycle`) protected by `CRON_SECRET`
- [x] Job 1: Trial warning emails (3 days before expiry, deduped via audit logs)
- [x] Job 2: Trial expiry enforcement (status → suspended, sends email, audit log)
- [x] Job 3: Grace period enforcement (7 days after payment failure → suspended)
- [x] Job 4: Data retention cleanup (30 days after cancellation → cascade delete + audit log)
- [x] Vercel cron configured for 6-hourly execution
- [x] Wired lifecycle emails into Stripe webhook handlers (activated, cancelled)
- [x] Wired welcome email into onboarding POST flow
- [x] Refactored inline payment-failed email to shared utility

#### 8.4 Admin Panel Data Wiring - COMPLETE
- [x] Subscriptions page uses real API data instead of hardcoded demo data
- [x] Dashboard metrics page properly maps nested API response to flat interface
- [x] Staff-only admin link in dashboard sidebar (Shield icon, divider separated)
- [x] Staff-only admin badge in dashboard header
- [x] `useIsStaff()` hook using dynamic Clerk detection (avoids SSR issues)

#### 8.5 Cross-Site Linking - COMPLETE
- [x] Dashboard link added to marketing site footer (Product section)
- [x] Uses `NEXT_PUBLIC_DASHBOARD_URL` env var with fallback to `https://app.velocitypulse.io`

### Phase 9: Testing, Observability, Security, Performance, DX & Growth (Priority: HIGH) - COMPLETE

#### 9.1 Testing & QA - COMPLETE
- [x] Vitest setup for velocitypulse-dashboard (vitest.config.ts, test/setup.ts, test scripts)
- [x] 5 critical API route unit tests (heartbeat, device status, agents CRUD, billing subscription, onboarding) — 26 tests
- [x] 4 agent unit test suites (ip-utils, arp, config, discover) — 38 tests
- [x] Vitest setup for velocitypulse-web + env.test.ts — 11 tests
- [x] Playwright E2E smoke test (playwright.config.ts + e2e/smoke.spec.ts)

#### 9.2 Observability - COMPLETE
- [x] Structured logger (`src/lib/logger.ts`) with Sentry captureException on errors
- [x] Sentry wired into 10 priority API routes (replaced console.error with logger.error)
- [x] Health check endpoints (`/api/health` in dashboard + web, no auth required)
- [x] Complete audit logging for categories, notifications, and devices (~11 routes)
- [x] New AuditAction types: category.created/updated/deleted/reordered, device.updated, notification_channel.created/updated/deleted, notification_rule.created/updated/deleted

#### 9.3 Performance - COMPLETE
- [x] Cache-Control headers on GET routes (categories 60s, segments 30s, subscription 300s)
- [x] Zod env validation for dashboard (`src/lib/env.ts` — getServerEnv/getClientEnv with caching)

#### 9.4 Security Hardening - COMPLETE
- [x] New `src/middleware.ts` merging proxy.ts + security headers + rate limiting
- [x] Security headers: CSP (Clerk, Supabase, Stripe, Sentry domains), HSTS, X-Frame-Options DENY, X-Content-Type-Options, X-XSS-Protection, Referrer-Policy, X-API-Version
- [x] In-memory per-IP rate limiting on agent POST endpoints (heartbeat 120/min, status 60/min, discovered 30/min) and user mutations (onboarding 5/min, checkout 10/min, agents 10/min)
- [x] Zod input validation schemas (`src/lib/validations/index.ts`) for 7 routes
- [x] Consistent validation error format: `{ error, code: 'VALIDATION_ERROR', details }`

#### 9.5 Developer Experience - COMPLETE
- [x] Error response helpers (`src/lib/api/errors.ts`) — unauthorized, forbidden, notFound, validationError, serverError, rateLimited
- [x] API documentation (`docs/API.md`) covering all 45+ routes

#### 9.6 Growth Features - COMPLETE
- [x] Usage dashboard (`/usage` page + `/api/dashboard/usage`) — device/agent/member counts vs limits, activity stats
- [x] Device reports (`/reports` page + `/api/dashboard/reports/devices?format=csv|json&status=all|online|offline`)
- [x] Usage + Reports added to sidebar navigation (Gauge + FileText icons)
- [x] Referral tracking (migration 007: referral_code + referred_by columns on organizations)
- [x] Onboarding POST accepts optional referralCode parameter

### Phase 10: Operational Hardening (Priority: HIGH) - COMPLETE

#### 10.1 DB-Backed Rate Limiting - COMPLETE
- [x] `api_usage_monthly` and `api_usage_hourly` tables (migration 008)
- [x] Atomic upsert functions: `increment_monthly_usage()`, `increment_hourly_usage()`
- [x] Composite database indexes for efficient lookups

#### 10.2 User-Facing Audit Log - COMPLETE
- [x] `/audit-log` page with filterable, paginated audit log viewer
- [x] Sidebar navigation link

#### 10.3 Device Import/Export - COMPLETE
- [x] CSV export via `/api/dashboard/reports/devices?format=csv`
- [x] Device import endpoint with validation

#### 10.4 API Key Rotation - COMPLETE
- [x] Agent API key regeneration endpoint
- [x] Seamless rotation without downtime

#### 10.5 Usage Quota Warnings - COMPLETE
- [x] Warning banners when approaching plan limits (devices, agents, API calls)
- [x] Quota enforcement at plan boundaries

#### 10.6 Data Retention & Pruning - COMPLETE
- [x] Retention pruning functions for old audit logs, status history, and usage data
- [x] Migration 008: rate limiting tables, indexes, pruning functions

### Phase 11: Production Cleanup (Priority: HIGH) - COMPLETE

#### 11.1 Remove Demo Data - COMPLETE
- [x] Removed all hardcoded/demo data from 6 admin pages (`/internal/*`)
- [x] All internal pages now use real Supabase data with proper empty and error states

#### 11.2 Build & Middleware Fixes - COMPLETE
- [x] Fixed admin pages not accessible due to middleware redirect
- [x] Fixed `useIsStaff` build failure: guard `useUser` against missing ClerkProvider
- [x] Added `.env*.local` to subproject `.gitignore` files

### Phase 12: Production Launch (Priority: HIGH) - COMPLETE

#### 12.1 Clerk Production Migration - COMPLETE
- [x] Switched Clerk from development to production instance (`clerk.velocitypulse.io`)
- [x] Configured custom OAuth credentials for Google (Google Cloud Console, consent screen in production)
- [x] Configured custom OAuth credentials for Microsoft (Azure AD, multitenant, custom app registration)
- [x] Configured custom OAuth credentials for Apple (Apple Developer portal, Services ID + .p8 key)
- [x] Updated CSP headers to allow `clerk.velocitypulse.io` (script-src, connect-src, frame-src)
- [x] Updated redirect URIs from dev (`singular-seahorse-24.clerk.accounts.dev`) to production (`clerk.velocitypulse.io`)

#### 12.2 Stripe Checkout Enhancements - COMPLETE
- [x] Enabled Apple Pay in Stripe Checkout
- [x] Enabled Google Pay in Stripe Checkout

#### 12.3 Marketing Site Polish - COMPLETE
- [x] Show Sign In link on mobile navbar
- [x] Hide Start Free Trial button on mobile navbar
- [x] Aligned pricing card buttons to consistent bottom position

---

## Part 5: File Reference

### Key Files Modified/Created

**Dashboard API:**
- `velocitypulse-dashboard/src/app/api/agent/devices/discovered/route.ts` (CREATED)
- `velocitypulse-dashboard/src/app/api/agent/devices/route.ts` (CREATED)
- `velocitypulse-dashboard/src/app/api/agent/ping/route.ts` (CREATED)
- `velocitypulse-dashboard/src/app/api/agent/commands/[commandId]/ack/route.ts` (CREATED)

**Dashboard UI:**
- `velocitypulse-dashboard/src/app/(dashboard)/monitor/page.tsx` (CREATED)
- `velocitypulse-dashboard/src/app/(dashboard)/notifications/page.tsx` (CREATED - notification settings)
- `velocitypulse-dashboard/src/components/dashboard/SortControls.tsx` (CREATED)
- `velocitypulse-dashboard/src/components/ui/switch.tsx` (CREATED)
- `velocitypulse-dashboard/src/components/ui/label.tsx` (CREATED)
- `velocitypulse-dashboard/src/components/ui/dropdown-menu.tsx` (CREATED)
- `velocitypulse-dashboard/src/components/layout/Sidebar.tsx` (MODIFIED - added Notifications link)
- `velocitypulse-dashboard/src/components/layout/DashboardShell.tsx` (MODIFIED - added AgentStatusIndicator)
- `velocitypulse-dashboard/src/components/dashboard/DeviceDetailModal.tsx` (MODIFIED - SNMP/UPnP info)
- `velocitypulse-dashboard/src/components/dashboard/AgentStatusIndicator.tsx` (CREATED)
- `velocitypulse-dashboard/src/components/ui/tooltip.tsx` (CREATED)

**Notifications:**
- `velocitypulse-dashboard/src/types/index.ts` (MODIFIED - notification types)
- `velocitypulse-dashboard/supabase/migrations/004_notifications.sql` (CREATED)
- `velocitypulse-dashboard/src/lib/notifications/service.ts` (CREATED)
- `velocitypulse-dashboard/src/lib/notifications/senders/email.ts` (CREATED)
- `velocitypulse-dashboard/src/lib/notifications/senders/slack.ts` (CREATED)
- `velocitypulse-dashboard/src/lib/notifications/senders/teams.ts` (CREATED)
- `velocitypulse-dashboard/src/lib/notifications/senders/webhook.ts` (CREATED)
- `velocitypulse-dashboard/src/app/api/notifications/channels/route.ts` (CREATED)
- `velocitypulse-dashboard/src/app/api/notifications/channels/[channelId]/route.ts` (CREATED)
- `velocitypulse-dashboard/src/app/api/notifications/rules/route.ts` (CREATED)
- `velocitypulse-dashboard/src/app/api/notifications/rules/[ruleId]/route.ts` (CREATED)
- `velocitypulse-dashboard/src/app/api/agent/devices/status/route.ts` (MODIFIED - trigger notifications)

**Agent:**
- `velocitypulse-agent/src/index.ts` (MODIFIED - command handling, UI integration, realtime setup, update_config)
- `velocitypulse-agent/src/api/client.ts` (MODIFIED - updated acknowledgeCommand, added sendPong)
- `velocitypulse-agent/src/api/realtime.ts` (CREATED - Supabase Realtime client)
- `velocitypulse-agent/src/ui/server.ts` (CREATED - Express + Socket.IO UI server)
- `velocitypulse-agent/src/ui/public/index.html` (MODIFIED - full dashboard UI)
- `velocitypulse-agent/scripts/install.ps1` (MODIFIED - uninstall, upgrade, UI port)
- `velocitypulse-agent/scripts/install.sh` (MODIFIED - uninstall, upgrade, unattended mode)

**Billing & Webhooks:**
- `velocitypulse-dashboard/src/app/api/internal/organizations/[id]/actions/route.ts` (MODIFIED - Stripe cancellation)
- `velocitypulse-dashboard/src/app/api/webhook/stripe/route.ts` (MODIFIED - payment failure email)
- `velocitypulse-web/app/api/stripe/webhook/route.ts` (SIMPLIFIED - stubs removed, redirects to dashboard)

**Form Delivery:**
- `velocitypulse-web/lib/form-delivery.ts` (CREATED - Resend email + Supabase storage)
- `velocitypulse-web/app/api/contact/route.ts` (MODIFIED - uses form delivery)
- `velocitypulse-web/app/api/partners/route.ts` (MODIFIED - uses form delivery)
- `velocitypulse-web/lib/env.ts` (MODIFIED - added Resend/Supabase env vars)

**Error Tracking (Sentry):**
- `velocitypulse-web/sentry.client.config.ts` (CREATED)
- `velocitypulse-web/sentry.server.config.ts` (CREATED)
- `velocitypulse-web/sentry.edge.config.ts` (CREATED)
- `velocitypulse-web/instrumentation.ts` (CREATED)
- `velocitypulse-dashboard/sentry.client.config.ts` (CREATED)
- `velocitypulse-dashboard/sentry.server.config.ts` (CREATED)
- `velocitypulse-dashboard/sentry.edge.config.ts` (CREATED)
- `velocitypulse-dashboard/instrumentation.ts` (CREATED)
- `velocitypulse-web/components/ErrorBoundary.tsx` (MODIFIED - reports to Sentry)

**Tier 3 - Enterprise:**
- `supabase/migrations/006_org_branding_and_analytics.sql` (CREATED - branding columns, SSO columns, device_status_history table)
- `velocitypulse-dashboard/src/lib/hooks/useBranding.ts` (CREATED - branding resolution hook)
- `velocitypulse-dashboard/src/lib/api/clerk-sso.ts` (CREATED - Clerk SAML utilities)
- `velocitypulse-dashboard/src/app/api/dashboard/branding/route.ts` (CREATED - branding CRUD API)
- `velocitypulse-dashboard/src/app/api/dashboard/sso/route.ts` (CREATED - SSO config API)
- `velocitypulse-dashboard/src/app/api/dashboard/analytics/route.ts` (CREATED - analytics data API)
- `velocitypulse-dashboard/src/app/(dashboard)/analytics/page.tsx` (CREATED - analytics page with Recharts)
- `velocitypulse-dashboard/src/app/(dashboard)/settings/page.tsx` (MODIFIED - added Branding + SSO tabs)
- `velocitypulse-dashboard/src/app/(dashboard)/billing/page.tsx` (MODIFIED - added enterprise features to Unlimited)
- `velocitypulse-dashboard/src/components/layout/DashboardShell.tsx` (MODIFIED - useBranding)
- `velocitypulse-dashboard/src/components/layout/Sidebar.tsx` (MODIFIED - useBranding + Analytics nav)
- `velocitypulse-dashboard/src/components/layout/Header.tsx` (MODIFIED - optional branding props)
- `velocitypulse-dashboard/src/components/layout/Footer.tsx` (MODIFIED - optional displayName prop)
- `velocitypulse-dashboard/src/app/api/agent/devices/status/route.ts` (MODIFIED - history INSERT)
- `velocitypulse-agent/src/scanner/mdns.ts` (CREATED - mDNS discovery)
- `velocitypulse-agent/src/scanner/ssdp.ts` (CREATED - SSDP/UPnP discovery)
- `velocitypulse-agent/src/scanner/discover.ts` (MODIFIED - mDNS/SSDP integration + merge)
- `velocitypulse-agent/src/scanner/arp.ts` (MODIFIED - optional mac_address, added upnp_info/snmp_info)
- `velocitypulse-web/lib/form-delivery.ts` (MODIFIED - Zoho as third channel)
- `velocitypulse-web/lib/zoho.ts` (MODIFIED - optional phone/website params)
- `velocitypulse-web/lib/env.ts` (MODIFIED - ZOHO_DEPARTMENT_ID)

**Tier 4 - Production SaaS Infrastructure:**
- `velocitypulse-dashboard/src/lib/emails/lifecycle.ts` (CREATED - shared lifecycle email utility)
- `velocitypulse-dashboard/src/app/(auth)/account-blocked/page.tsx` (CREATED - suspended/cancelled state page)
- `velocitypulse-dashboard/src/app/(auth)/trial-expired/page.tsx` (CREATED - trial expired with subscribe CTA)
- `velocitypulse-dashboard/src/app/api/billing/portal/route.ts` (CREATED - Stripe Customer Portal session)
- `velocitypulse-dashboard/src/app/api/billing/subscription/route.ts` (CREATED - subscription status API)
- `velocitypulse-dashboard/src/app/api/cron/lifecycle/route.ts` (CREATED - lifecycle automation cron)
- `velocitypulse-dashboard/src/proxy.ts` (MODIFIED - org status enforcement, billing route bypass)
- `velocitypulse-dashboard/src/app/(dashboard)/billing/page.tsx` (MODIFIED - subscription card, Stripe Portal, past-due warning)
- `velocitypulse-dashboard/src/app/api/onboarding/route.ts` (MODIFIED - welcome email, suspended_at/cancelled_at fields)
- `velocitypulse-dashboard/src/app/api/webhook/stripe/route.ts` (MODIFIED - lifecycle emails for activation/cancellation)
- `velocitypulse-dashboard/src/app/(internal)/internal/subscriptions/page.tsx` (MODIFIED - real API data)
- `velocitypulse-dashboard/src/app/(internal)/internal/dashboard/page.tsx` (MODIFIED - API response mapping)
- `velocitypulse-dashboard/src/components/layout/Sidebar.tsx` (MODIFIED - staff admin link)
- `velocitypulse-dashboard/src/components/layout/DashboardShell.tsx` (MODIFIED - useIsStaff hook)
- `velocitypulse-dashboard/src/components/layout/Header.tsx` (MODIFIED - staff admin badge)
- `velocitypulse-dashboard/src/types/index.ts` (MODIFIED - new audit action types)
- `velocitypulse-dashboard/vercel.json` (MODIFIED - lifecycle cron config)
- `velocitypulse-web/components/layout/Footer.tsx` (MODIFIED - dashboard link)

**Tier 5 - Testing, Observability, Security, Performance, DX & Growth:**
- `velocitypulse-dashboard/vitest.config.ts` (CREATED - Vitest config with React plugin)
- `velocitypulse-dashboard/src/test/setup.ts` (CREATED - test mocks for Clerk, Supabase, next/headers)
- `velocitypulse-dashboard/src/app/api/agent/heartbeat/route.test.ts` (CREATED - 4 tests)
- `velocitypulse-dashboard/src/app/api/agent/devices/status/route.test.ts` (CREATED - 5 tests)
- `velocitypulse-dashboard/src/app/api/dashboard/agents/route.test.ts` (CREATED - 6 tests)
- `velocitypulse-dashboard/src/app/api/billing/subscription/route.test.ts` (CREATED - 4 tests)
- `velocitypulse-dashboard/src/app/api/onboarding/route.test.ts` (CREATED - 7 tests)
- `velocitypulse-agent/src/utils/ip-utils.test.ts` (CREATED - 16 tests)
- `velocitypulse-agent/src/scanner/arp.test.ts` (CREATED - 8 tests)
- `velocitypulse-agent/src/config.test.ts` (CREATED - 10 tests)
- `velocitypulse-agent/src/scanner/discover.test.ts` (CREATED - 4 tests)
- `velocitypulse-web/vitest.config.ts` (CREATED - Vitest config)
- `velocitypulse-web/lib/env.test.ts` (CREATED - 11 tests)
- `velocitypulse-dashboard/playwright.config.ts` (CREATED - E2E config)
- `velocitypulse-dashboard/e2e/smoke.spec.ts` (CREATED - smoke test)
- `velocitypulse-dashboard/src/lib/logger.ts` (CREATED - structured logger with Sentry)
- `velocitypulse-dashboard/src/app/api/health/route.ts` (CREATED - health check endpoint)
- `velocitypulse-web/app/api/health/route.ts` (CREATED - health check endpoint)
- `velocitypulse-dashboard/src/lib/env.ts` (CREATED - Zod env validation)
- `velocitypulse-dashboard/src/middleware.ts` (CREATED - replaces proxy.ts with security headers + rate limiting)
- `velocitypulse-dashboard/src/lib/validations/index.ts` (CREATED - Zod schemas for 7 routes)
- `velocitypulse-dashboard/src/lib/api/errors.ts` (CREATED - error response helpers)
- `velocitypulse-dashboard/docs/API.md` (CREATED - API documentation)
- `velocitypulse-dashboard/src/app/api/dashboard/usage/route.ts` (CREATED - usage stats API)
- `velocitypulse-dashboard/src/app/(dashboard)/usage/page.tsx` (CREATED - usage dashboard)
- `velocitypulse-dashboard/src/app/api/dashboard/reports/devices/route.ts` (CREATED - CSV/JSON export)
- `velocitypulse-dashboard/src/app/(dashboard)/reports/page.tsx` (CREATED - reports page)
- `velocitypulse-dashboard/src/types/index.ts` (MODIFIED - new AuditAction types, Organization referral fields)
- `velocitypulse-dashboard/src/components/layout/Sidebar.tsx` (MODIFIED - Usage + Reports nav)
- `velocitypulse-dashboard/src/app/api/onboarding/route.ts` (MODIFIED - logger, Zod validation, referralCode)
- `velocitypulse-dashboard/src/proxy.ts` (REMOVED - replaced by middleware.ts)
- 10 API routes (MODIFIED - console.error → logger.error)
- 7 API routes (MODIFIED - Zod input validation)
- 11 API routes (MODIFIED - audit log inserts)
- 3 GET routes (MODIFIED - Cache-Control headers)

**Migrations:**
- `supabase/migrations/004_notifications.sql` (CREATED - notification system tables)
- `supabase/migrations/005_form_submissions.sql` (CREATED - form submissions table)
- `supabase/migrations/006_org_branding_and_analytics.sql` (CREATED - branding, SSO, analytics)
- `supabase/migrations/007_usage_and_referrals.sql` (CREATED - referral tracking columns + indexes)

---

## Part 6: Success Criteria

### MVP Launch Checklist

- [x] Agent can discover devices and upload to dashboard
- [x] Agent can report device status
- [x] Dashboard shows real-time device status
- [x] Agent responds to scan commands
- [x] Dashboard has working list/grid views
- [x] Search and filter work correctly
- [ ] New customer can sign up, install agent, see devices (needs E2E test)
- [x] Billing works (Stripe checkout + webhooks)
- [x] Trial expires correctly after 14 days
- [x] Suspended/cancelled orgs are blocked from dashboard access
- [x] Customer can manage subscription via Stripe Portal
- [x] Lifecycle cron automates trial expiry and data cleanup

### Quality Gates

- [x] All API endpoints return proper error codes
- [x] Agent handles network failures gracefully
- [x] Dashboard works on mobile (responsive)
- [ ] No console errors in production
- [ ] Lighthouse score > 80 for performance

---

## Verification Plan

1. **End-to-End Test:** Create new org, install agent, verify devices appear
2. **API Testing:** Use Postman/curl to test all agent endpoints
3. **UI Testing:** Verify all view modes work, filters work, sorting works
4. **Billing Test:** Complete checkout flow, verify subscription created
5. **Command Test:** Send scan command, verify agent executes

---

*Last Updated: February 7, 2026 - All Phases Complete (Tiers 1-5 + Operational Hardening + Production Cleanup + Production Launch).*
