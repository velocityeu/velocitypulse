# VelocityPulse Development Plan

## Executive Summary

VelocityPulse is a commercial SaaS version of the open-source IT-Dashboard project. This document provides a comprehensive comparison of what has been implemented versus what remains from the original project, plus what additional SaaS features have been added.

**Current Status: ~98% Feature Complete for MVP**

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
| mDNS discovery | Yes | Partial | 90% - needs testing |
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
| Device details modal | Yes | Partial | 70% - basic info shown |
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
| Contact/demo forms | COMPLETE | Lead capture |
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
3. **White-label** - Unlimited tier feature
4. **Advanced Analytics** - Charts/reports
5. **SSO (SAML)** - Enterprise feature

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
| `update_config` | NOT IMPLEMENTED |

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

### Phase 6: Enterprise Features (Priority: LOW)

#### 6.1 White-Label
- [ ] Custom branding support (logo, colors)
- [ ] Custom domain support
- [ ] Remove VelocityPulse branding for Unlimited tier

#### 6.2 SSO
- [ ] SAML integration via Clerk
- [ ] Custom identity provider support

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
- `velocitypulse-agent/src/index.ts` (MODIFIED - command handling, UI integration, realtime setup)
- `velocitypulse-agent/src/api/client.ts` (MODIFIED - updated acknowledgeCommand, added sendPong)
- `velocitypulse-agent/src/api/realtime.ts` (CREATED - Supabase Realtime client)
- `velocitypulse-agent/src/ui/server.ts` (CREATED - Express + Socket.IO UI server)
- `velocitypulse-agent/src/ui/public/index.html` (MODIFIED - full dashboard UI)
- `velocitypulse-agent/scripts/install.ps1` (MODIFIED - uninstall, upgrade, UI port)
- `velocitypulse-agent/scripts/install.sh` (MODIFIED - uninstall, upgrade, unattended mode)

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

*Last Updated: January 30, 2026 - Phase 3, 4, & 5 Complete*
