# VelocityPulse Development Plan

## Executive Summary

VelocityPulse is a commercial SaaS version of the open-source IT-Dashboard project. This document provides a comprehensive comparison of what has been implemented versus what remains from the original project, plus what additional SaaS features have been added.

**Current Status: Tier 3 Complete - Enterprise Features Shipped**

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
| **Admin (Internal)** |
| Organization admin | COMPLETE | View all customers |
| Subscription admin | COMPLETE | Manage plans |
| Trial tracking | COMPLETE | Trial analytics |
| Audit logs | COMPLETE | Activity tracking |
| Support search | COMPLETE | Customer lookup |
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

**Migrations:**
- `supabase/migrations/004_notifications.sql` (CREATED - notification system tables)
- `supabase/migrations/005_form_submissions.sql` (CREATED - form submissions table)
- `supabase/migrations/006_org_branding_and_analytics.sql` (CREATED - branding, SSO, analytics)

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

*Last Updated: February 7, 2026 - All Phases Complete (Tiers 1-3). Enterprise features shipped: white-label branding, SSO/SAML, advanced analytics, mDNS/SSDP discovery, Zoho integration. Remaining: E2E smoke test, Lighthouse check.*
