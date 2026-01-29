# VelocityPulse - Product Specification

**Website:** [velocitypulse.io](https://velocitypulse.io)

Technical requirements for transforming IT Dashboard into a commercial SaaS product.

## Overview

VelocityPulse is a multi-tenant SaaS network monitoring platform built on:
- **Frontend:** Next.js 14, TypeScript, Supabase, Tailwind CSS
- **Agent:** Node.js, TypeScript, Express, Socket.IO
- **Infrastructure:** Vercel (frontend), Supabase (database + realtime)

## Architecture Changes Required

### Current State (Single-Tenant)
- One Supabase project, one organization
- Direct agent-to-dashboard connection
- No billing or usage metering

### Target State (Multi-Tenant SaaS)
- Tenant isolation via Supabase Row Level Security (RLS)
- Organization/workspace model
- Usage-based billing via Stripe
- OAuth authentication (Microsoft, Google, Apple)

## Must-Have Features for Launch

### 1. Multi-Tenant Data Isolation

**Priority:** Critical

```
Organizations
├── Workspaces (sites/locations)
│   ├── Agents
│   │   └── Devices
│   └── Users (with roles)
└── Billing (Stripe customer)
```

**Implementation:**
- Add `organization_id` column to all tables
- Implement Supabase RLS policies
- Ensure agent data stays within organization boundary

### 2. Authentication & Authorization

**Priority:** Critical

| Provider | Justification |
|----------|---------------|
| Microsoft | Enterprise customers, schools (M365) |
| Google | SMB customers, general users |
| Apple | Premium feel, privacy-focused users |
| Email/Password | Fallback for all others |

**Roles:**
- **Owner:** Full access, billing management
- **Admin:** Manage users, agents, settings
- **Viewer:** Read-only dashboard access

### 3. Billing Integration (Stripe)

**Priority:** Critical

**Requirements:**
- Stripe Checkout for subscriptions
- Apple Pay support (via Stripe)
- Usage metering (device count, agent count)
- Webhook handling for subscription events
- Customer portal for self-service

**Billing Events to Handle:**
- `customer.subscription.created`
- `customer.subscription.updated`
- `customer.subscription.deleted`
- `invoice.payment_succeeded`
- `invoice.payment_failed`

### 4. Automated Agent Provisioning

**Priority:** High

**Current Flow:**
1. Manual agent download
2. Manual API key configuration
3. Manual .env setup

**Target Flow:**
1. User clicks "Add Agent" in dashboard
2. System generates unique agent key
3. User downloads pre-configured installer
4. Agent auto-registers on first run

**Installer Options:**
- Windows: MSI or PowerShell one-liner
- macOS: PKG or Homebrew
- Linux: DEB/RPM or curl | bash

### 5. Usage Metering

**Priority:** High

**Metrics to Track:**
- Device count per organization
- Agent count per organization
- API calls (for future rate limiting)
- Data retention period used

**Enforcement:**
- Soft limits: Warning at 80%, 90%
- Hard limits: Block new devices/agents at limit
- Grace period: 7 days over limit before enforcement

### 6. Onboarding Wizard

**Priority:** High

**Steps:**
1. Welcome + organization name
2. Choose plan (or start trial)
3. Download first agent
4. Wait for agent connection (live feedback)
5. View discovered devices
6. Invite team members (optional)
7. Done - explore dashboard

**Goal:** < 10 minutes from signup to seeing devices

## Nice-to-Have Features

### 7. White-Label for MSPs

**Priority:** Medium (post-launch)

- Custom domain support (CNAME)
- Custom logo and branding
- Hide "Powered by VelocityPulse"
- Custom email templates

### 8. API for Integrations

**Priority:** Medium (post-launch)

- RESTful API with versioning
- API key authentication
- Rate limiting per plan
- Webhooks for events (device down, alert triggered)

### 9. Mobile App

**Priority:** Low (post-launch)

- React Native (Expo)
- Push notifications for alerts
- Quick status overview
- Basic device details

### 10. Custom Alerting Rules

**Priority:** Medium (post-launch)

- Create custom conditions (CPU > 90% for 5 min)
- Multiple notification channels per rule
- Escalation paths
- Maintenance windows

### 11. Scheduled Reports

**Priority:** Low (post-launch)

- Daily/weekly/monthly summaries
- PDF export
- Email delivery
- Custom report builder

## Database Schema Changes

### New Tables

```sql
-- Organizations (tenants)
CREATE TABLE organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  stripe_customer_id TEXT,
  plan TEXT DEFAULT 'free',
  device_limit INTEGER DEFAULT 50,
  agent_limit INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Organization members
CREATE TABLE organization_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id),
  user_id UUID REFERENCES auth.users(id),
  role TEXT DEFAULT 'viewer', -- owner, admin, viewer
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(organization_id, user_id)
);

-- Invitations
CREATE TABLE invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id),
  email TEXT NOT NULL,
  role TEXT DEFAULT 'viewer',
  token TEXT UNIQUE NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Modified Tables

Add `organization_id` foreign key to:
- `agents`
- `devices`
- `alerts` (if exists)
- Any other tenant-specific data

### Row Level Security (RLS)

```sql
-- Example: Devices table RLS
ALTER TABLE devices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view devices in their organization"
  ON devices FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid()
    )
  );
```

## API Endpoints

### Agent API (Existing + Modified)

| Endpoint | Method | Change |
|----------|--------|--------|
| `/api/agent/register` | POST | New - first-time agent setup |
| `/api/agent/heartbeat` | POST | Add org validation |
| `/api/agent/devices` | POST | Add org validation |
| `/api/agent/status` | GET | Add org validation |

### Dashboard API (New)

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/organizations` | GET/POST | List/create orgs |
| `/api/organizations/:id/members` | GET/POST | Manage members |
| `/api/organizations/:id/invitations` | POST | Send invites |
| `/api/billing/checkout` | POST | Create Stripe checkout |
| `/api/billing/portal` | POST | Create customer portal |
| `/api/billing/webhook` | POST | Stripe webhook handler |

## Security Considerations

### Data Isolation
- RLS policies on all tenant data
- Agent keys scoped to organization
- API keys scoped to organization

### Authentication
- OAuth 2.0 with PKCE
- Session management via Supabase Auth
- MFA support (optional, via Supabase)

### Agent Security
- Agent key rotation capability
- IP allowlisting (optional)
- TLS for all communication

### Compliance
- GDPR-ready (data export, deletion)
- SOC 2 considerations (audit logs)
- UK data residency (Supabase region selection)

## Performance Requirements

| Metric | Target |
|--------|--------|
| Dashboard load time | < 2 seconds |
| Real-time update latency | < 1 second |
| Agent heartbeat interval | 60 seconds |
| Device status check | 30 seconds |
| API response time | < 200ms (p95) |

## Testing Requirements

### Unit Tests
- RLS policy tests
- Billing calculation tests
- Usage metering tests

### Integration Tests
- Multi-tenant isolation verification
- Stripe webhook handling
- OAuth flow end-to-end

### Load Tests
- 100 concurrent organizations
- 10,000 devices per organization
- 1,000 real-time subscriptions

## Deployment

### Environments
- **Development:** Local Supabase, test Stripe
- **Staging:** Supabase project, test Stripe
- **Production:** Supabase project, live Stripe

### Monitoring
- Vercel Analytics (frontend)
- Supabase Dashboard (database)
- Stripe Dashboard (billing)
- Custom logging (errors, events)

## Timeline Estimate

| Phase | Scope |
|-------|-------|
| Phase 1 | Multi-tenancy, Auth, Billing |
| Phase 2 | Onboarding wizard, Agent provisioning |
| Phase 3 | Beta testing, Bug fixes |
| Phase 4 | Public launch, Marketing site |

---

*Last updated: January 2026*
