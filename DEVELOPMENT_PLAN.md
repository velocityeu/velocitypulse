# VelocityPulse Development Plan

## Executive Summary

VelocityPulse is a commercial SaaS version of the open-source IT-Dashboard project. This document provides a comprehensive comparison of what has been implemented versus what remains from the original project, plus what additional SaaS features have been added.

**Current Status: ~80-85% Feature Complete for MVP**

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
| Auto-upgrade mechanism | Yes | Partial | 70% - upgrade logic exists, installer scripts need work |
| Command queue (scan/restart/upgrade) | Yes | Yes | COMPLETE |
| Agent local UI | Yes | No | NOT STARTED |
| Realtime command delivery | Yes | Partial | 50% - schema exists, not fully wired |
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
| Agent download | PARTIAL | Links exist, installer needs polish |

---

## Part 2: Detailed Gap Analysis

### Critical Gaps (MVP Blockers)

1. ~~**Agent Command Execution**~~ - COMPLETE
2. ~~**Device Discovery API**~~ - COMPLETE
3. ~~**Agent Ping/Pong**~~ - COMPLETE
4. ~~**List/Compact View Modes**~~ - COMPLETE

### Important Gaps (Post-MVP)

1. **Agent Local UI** - No web interface at localhost:3001
2. **Realtime Command Delivery** - Commands only via heartbeat polling, not instant WebSocket
3. **Device Details Modal** - Basic, missing SNMP/UPnP info display

### Nice-to-Have Gaps

1. **Notifications** - Email/Slack/Teams alerts (schema planned)
2. **Custom Webhooks** - External integrations
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

### Phase 3: Agent Improvements (Priority: MEDIUM)

#### 3.1 Agent Local UI
- [ ] Create Express + Socket.IO server
- [ ] Build web UI (connection status, segments, devices, logs)
- [ ] Add manual scan button
- [ ] Add ping dashboard button

#### 3.2 Realtime Command Delivery
- [ ] Add Supabase Realtime subscription to agent
- [ ] Subscribe to `agent_commands` table
- [ ] Execute commands immediately on receipt
- [ ] Fall back to heartbeat polling

#### 3.3 Installer Scripts
- [ ] Polish Windows installer (install.ps1)
- [ ] Polish Linux/macOS installer (install.sh)
- [ ] Create service installation (NSSM/systemd/launchd)
- [ ] Create uninstaller scripts
- [ ] Test offline installation bundle

### Phase 4: Enhanced Features (Priority: MEDIUM)

#### 4.1 Device Details Enhancement
- [ ] Show SNMP info (sysName, sysDescr, etc.)
- [ ] Show UPnP info (friendlyName, deviceType)
- [ ] Show open ports and services
- [ ] Show discovery method and timestamps

#### 4.2 Connection Status
- [ ] Show realtime connection indicator in dashboard
- [ ] Track agent online/offline transitions
- [ ] Add reconnection logic with backoff

### Phase 5: Notifications (Priority: LOW)

#### 5.1 Notification System
- [ ] Design notification preferences schema
- [ ] Implement email notifications (device offline)
- [ ] Implement Slack webhook integration
- [ ] Implement Teams webhook integration
- [ ] Add notification settings page

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
- `velocitypulse-dashboard/src/components/dashboard/SortControls.tsx` (CREATED)
- `velocitypulse-dashboard/src/components/ui/switch.tsx` (CREATED)
- `velocitypulse-dashboard/src/components/ui/label.tsx` (CREATED)
- `velocitypulse-dashboard/src/components/ui/dropdown-menu.tsx` (CREATED)
- `velocitypulse-dashboard/src/components/layout/Sidebar.tsx` (MODIFIED)

**Agent:**
- `velocitypulse-agent/src/index.ts` (MODIFIED - added command handling)
- `velocitypulse-agent/src/api/client.ts` (MODIFIED - updated acknowledgeCommand, added sendPong)

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

*Last Updated: January 2026*
