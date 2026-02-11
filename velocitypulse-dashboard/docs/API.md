# VelocityPulse Dashboard API Documentation

This document covers the primary dashboard, agent, billing, and admin endpoints. Additional implemented endpoints are listed near the end for completeness.

## Authentication

### Clerk JWT (Dashboard Routes)
All `/api/dashboard/*`, `/api/billing/*`, `/api/checkout`, and `/api/onboarding` routes require a valid Clerk JWT session. The session is validated via `auth()` from `@clerk/nextjs/server`.

### API Key (Agent Routes)
All `/api/agent/*` routes require an API key via `X-Agent-Key`, `X-API-Key`, or `Authorization: Bearer <key>`. Keys are hashed (SHA-256) and stored in the `agents` table. The key format is `vp_{org_prefix}_{random}`.

**Rotation:** When an API key is rotated, the previous key remains valid for 24 hours (grace period).

### Internal Auth (Admin Routes)
All `/api/internal/*` routes require Clerk JWT with staff/admin role, verified by `verifyInternalAccess()`.

### CRON Secret
`/api/cron/*` routes require `Authorization: Bearer <CRON_SECRET>`. In production, `CRON_SECRET` must be configured.

---

## Agent Endpoints

### POST /api/agent/heartbeat
Agent health check and configuration sync.

- **Auth**: API Key
- **Request body**:
  ```json
  {
    "version": "string",
    "hostname": "string",
    "uptime_seconds": "number (optional)"
  }
  ```
- **Response** (`200`):
  ```json
  {
    "success": true,
    "agent_id": "uuid",
    "agent_name": "string",
    "organization_id": "uuid",
    "server_time": "ISO 8601",
    "segments": [{ "id": "uuid", "cidr": "string", "scan_interval_seconds": "number", ... }],
    "supabase_url": "string",
    "supabase_anon_key": "string",
    "latest_agent_version": "string",
    "agent_download_url": "string",
    "upgrade_available": "boolean",
    "pending_commands": [{ "id": "uuid", "command_type": "string", "payload": "object", ... }]
  }
  ```
- **Status codes**: `200` OK, `400` Invalid JSON, `401` Invalid API key, `500` Server error
- **Notes**: Updates agent `last_seen_at`. Auto-queues upgrade command when `ENFORCE_AGENT_UPDATES` is enabled and agent version is outdated.

---

### GET /api/agent/devices
Returns devices the agent should monitor, filtered by assigned segments.

- **Auth**: API Key
- **Query params**:
  - `segment_id` (optional) - Filter to a specific segment
- **Response** (`200`):
  ```json
  {
    "success": true,
    "devices": [{
      "id": "uuid",
      "name": "string",
      "ip_address": "string",
      "url": "string|null",
      "port": "number|null",
      "check_type": "ping|http|tcp",
      "status": "online|offline|degraded|unknown",
      "network_segment_id": "uuid",
      "mac_address": "string|null",
      "hostname": "string|null",
      "is_monitored": true
    }]
  }
  ```
- **Status codes**: `200` OK, `401` Invalid API key, `500` Server error

---

### POST /api/agent/devices/discovered
Upload discovered devices from network scans.

- **Auth**: API Key
- **Request body**:
  ```json
  {
    "segment_id": "uuid (required)",
    "scan_timestamp": "ISO 8601",
    "devices": [{
      "ip_address": "string (required)",
      "mac_address": "string (optional)",
      "hostname": "string (optional)",
      "manufacturer": "string (optional)",
      "os_hints": ["string"],
      "device_type": "server|workstation|network|printer|iot|unknown",
      "open_ports": [80, 443],
      "services": ["http", "ssh"],
      "netbios_name": "string (optional)",
      "snmp_info": { "sysName": "string", "sysDescr": "string", ... },
      "upnp_info": { "friendlyName": "string", "deviceType": "string", ... },
      "discovery_method": "arp|mdns|ssdp|snmp"
    }]
  }
  ```
- **Response** (`200`):
  ```json
  {
    "success": true,
    "created": 5,
    "updated": 2,
    "unchanged": 10
  }
  ```
- **Status codes**: `200` OK, `400` Invalid body / missing fields, `401` Invalid API key, `404` Segment not found, `500` Server error
- **Notes**: Upserts devices by MAC address first, then IP address. Updates segment scan stats.

---

### POST /api/agent/devices/status
Submit device status reports.

- **Auth**: API Key
- **Request body**:
  ```json
  {
    "reports": [{
      "device_id": "uuid (optional, uses ip_address if absent)",
      "ip_address": "string",
      "status": "online|offline|degraded|unknown",
      "response_time_ms": "number|null",
      "check_type": "ping|http|tcp",
      "checked_at": "ISO 8601",
      "error": "string (optional)"
    }]
  }
  ```
- **Response** (`200`):
  ```json
  {
    "success": true,
    "processed": 10,
    "errors": []
  }
  ```
- **Status codes**: `200` OK, `400` Invalid body, `401` Invalid API key, `500` Server error
- **Notes**: Records status history for analytics. Triggers notification rules on status changes (fire-and-forget).

---

### POST /api/agent/ping
Ping/pong connectivity test.

- **Auth**: API Key
- **Request body** (optional):
  ```json
  {
    "command_id": "uuid (optional, for responding to ping commands)",
    "command_received_at": "ISO 8601 (optional)",
    "agent_timestamp": "ISO 8601"
  }
  ```
- **Response** (`200`):
  ```json
  {
    "success": true,
    "pong": true,
    "agent_id": "uuid",
    "agent_name": "string",
    "server_timestamp": "ISO 8601",
    "latency_ms": "number (if command_id provided)"
  }
  ```
- **Status codes**: `200` OK, `401` Invalid API key, `500` Server error

---

### POST /api/agent/segments/register
Auto-register a network segment detected by the agent.

- **Auth**: API Key
- **Request body**:
  ```json
  {
    "cidr": "192.168.1.0/24 (required)",
    "name": "string (required)",
    "interface_name": "string (required)"
  }
  ```
- **Response** (`200`):
  ```json
  {
    "success": true,
    "segment": { "id": "uuid", "cidr": "string", "name": "string", ... }
  }
  ```
- **Status codes**: `200` OK, `400` Invalid body / invalid CIDR, `401` Invalid API key, `409` Overlapping segment, `500` Server error
- **Notes**: Validates CIDR format and checks for overlap with existing segments. Returns existing segment if CIDR matches an existing segment (matched on CIDR alone, regardless of segment name). This enables idempotent multi-adapter registration — agents with multiple NICs register each detected CIDR, and re-registrations are safely deduplicated.

---

### POST /api/agent/commands/[commandId]/ack
Agent acknowledges command execution.

- **Auth**: API Key
- **URL params**: `commandId` - UUID of the command
- **Request body**:
  ```json
  {
    "success": "boolean (required)",
    "result": "object (optional)",
    "error": "string (optional, if success=false)"
  }
  ```
- **Response** (`200`):
  ```json
  {
    "success": true,
    "command_id": "uuid",
    "status": "completed|failed"
  }
  ```
- **Status codes**: `200` OK, `400` Invalid body, `401` Invalid API key, `404` Command not found, `409` Already acknowledged, `500` Server error

---

## Dashboard Endpoints

### GET /api/dashboard/agents
List all agents for the organization.

- **Auth**: Clerk JWT
- **Response** (`200`):
  ```json
  {
    "agents": [{
      "id": "uuid",
      "name": "string",
      "description": "string|null",
      "api_key_prefix": "string",
      "is_enabled": true,
      "last_seen_at": "ISO 8601|null",
      "version": "string|null",
      "is_online": true,
      "network_segments": [...]
    }]
  }
  ```
- **Notes**: Computes `is_online` based on `AGENT_ONLINE_THRESHOLD_MS` (5 minutes).

### POST /api/dashboard/agents
Create a new agent.

- **Auth**: Clerk JWT (owner/admin or `can_manage_agents`)
- **Request body**:
  ```json
  {
    "name": "string (required)",
    "description": "string (optional)"
  }
  ```
- **Response** (`201`):
  ```json
  {
    "agent": { "id": "uuid", "name": "string", "api_key": "vp_xxx_yyy (only shown once)", ... }
  }
  ```
- **Status codes**: `201` Created, `400` Invalid body, `401` Unauthorized, `403` Permission denied / limit reached, `404` Org not found, `500` Server error

### DELETE /api/dashboard/agents/[id]
Delete an agent and its related data.

- **Auth**: Clerk JWT (owner/admin or `can_manage_agents`)
- **Status codes**: `200` OK, `401` Unauthorized, `403` Permission denied, `404` Not found, `500` Server error

---

### GET /api/dashboard/devices
List all devices for the organization (with category, segment, agent joins).

- **Auth**: Clerk JWT
- **Response** (`200`):
  ```json
  {
    "devices": [{ "id": "uuid", "name": "string", "status": "string", "category": {...}, "agent": {...}, ... }]
  }
  ```

### POST /api/dashboard/devices
Create a new device.

- **Auth**: Clerk JWT (owner/admin/editor or `can_manage_devices`)
- **Request body**:
  ```json
  {
    "name": "string (required)",
    "ip_address": "string (optional)",
    "mac_address": "string (optional)",
    "hostname": "string (optional)",
    "category_id": "uuid (optional)",
    "network_segment_id": "uuid (optional)",
    "description": "string (optional)",
    "check_type": "ping|http|tcp (default: ping)",
    "url": "string (optional)",
    "port": "number (optional)"
  }
  ```
- **Response** (`201`): `{ "device": {...} }`
- **Status codes**: `201` Created, `400` Invalid body, `401` Unauthorized, `403` Permission denied / limit reached, `500` Server error

### PATCH /api/dashboard/devices/[id]
Update a device.

- **Auth**: Clerk JWT (owner/admin/editor or `can_manage_devices`)
- **Status codes**: `200` OK, `401` Unauthorized, `403` Permission denied, `404` Not found, `500` Server error

### DELETE /api/dashboard/devices/[id]
Delete a device.

- **Auth**: Clerk JWT (owner/admin/editor or `can_manage_devices`)
- **Status codes**: `200` OK, `401` Unauthorized, `403` Permission denied, `404` Not found, `500` Server error

---

### GET /api/dashboard/categories
List categories for the organization.

- **Auth**: Clerk JWT
- **Response** (`200`): `{ "categories": [...] }`

### POST /api/dashboard/categories
Create a new category.

- **Auth**: Clerk JWT (owner/admin)
- **Request body**: `{ "name": "string", "icon": "string", "color": "string" }`
- **Response** (`201`): `{ "category": {...} }`

### PATCH /api/dashboard/categories/[id]
Update a category.

### DELETE /api/dashboard/categories/[id]
Delete a category.

### POST /api/dashboard/categories/reorder
Reorder categories.

- **Request body**: `{ "categoryIds": ["uuid", "uuid", ...] }`

---

### GET /api/dashboard/members
List all members of the organization (with Clerk user data).

- **Auth**: Clerk JWT
- **Response** (`200`):
  ```json
  {
    "members": [{
      "id": "uuid",
      "user_id": "string",
      "role": "owner|admin|editor|viewer",
      "permissions": {...},
      "user": { "id": "string", "email": "string", "fullName": "string", "imageUrl": "string" }
    }]
  }
  ```

### POST /api/dashboard/members
Invite a new member.

- **Auth**: Clerk JWT (owner/admin or `can_manage_members`)
- **Request body**: `{ "email": "string (required)", "role": "admin|editor|viewer (default: viewer)" }`
- **Response** (`201`): `{ "member": {...} }`
- **Status codes**: `201` Created, `400` Invalid body, `403` Permission denied / limit reached, `404` User not found (must sign up first), `409` Already a member, `500` Server error

### PATCH /api/dashboard/members/[id]
Update a member's role.

### DELETE /api/dashboard/members/[id]
Remove a member.

---

### GET /api/dashboard/segments
List network segments for the organization.

- **Auth**: Clerk JWT
- **Response** (`200`): `{ "segments": [...] }`

---

### GET /api/dashboard/analytics
Get device uptime analytics.

- **Auth**: Clerk JWT
- **Query params**: `range` - `24h|7d|30d` (default: `24h`)
- **Response** (`200`):
  ```json
  {
    "history": [{ "device_id": "uuid", "status": "string", "response_time_ms": "number", "checked_at": "ISO 8601" }],
    "uptime": [{ "device_id": "uuid", "device_name": "string", "uptime_percentage": 99.5, "avg_response_time_ms": 12.3, "total_checks": 288 }],
    "range": "24h"
  }
  ```

---

### GET /api/dashboard/branding
Get custom branding for the organization.

- **Auth**: Clerk JWT

### PATCH /api/dashboard/branding
Update custom branding (unlimited plan only).

- **Auth**: Clerk JWT (owner/admin)

---

### GET /api/dashboard/sso
Get SSO configuration.

- **Auth**: Clerk JWT

### POST /api/dashboard/sso
Configure SSO/SAML (unlimited plan only).

- **Auth**: Clerk JWT (owner/admin)

---

### GET /api/dashboard/usage
Get resource usage and limits for the organization.

- **Auth**: Clerk JWT
- **Response** (`200`):
  ```json
  {
    "usage": {
      "devices": { "current": 45, "limit": 100 },
      "agents": { "current": 3, "limit": 10 },
      "members": { "current": 2, "limit": 5 }
    },
    "plan": "trial|starter|unlimited",
    "recentActivity": [{ "action": "device.created", "created_at": "ISO 8601" }]
  }
  ```

---

### GET /api/dashboard/reports/devices
Export device inventory.

- **Auth**: Clerk JWT
- **Query params**:
  - `format` - `json|csv` (default: `json`)
  - `status` - `all|online|offline|degraded|unknown` (default: `all`)
- **Response** (`200`): JSON array of devices or CSV file download

---

## Billing Endpoints

### POST /api/checkout
Create a Stripe Checkout session.

- **Auth**: Clerk JWT (owner/admin or `can_manage_billing`)
- **Request body**:
  ```json
  {
    "priceId": "string (Stripe price ID, required)",
    "organizationId": "uuid (required)"
  }
  ```
- **Response** (`200`): `{ "url": "https://checkout.stripe.com/..." }`
- **Status codes**: `200` OK, `400` Missing fields, `401` Unauthorized, `403` No billing permission, `404` Org not found, `500` Server error

### GET /api/billing/subscription
Get active subscription details.

- **Auth**: Clerk JWT
- **Response** (`200`):
  ```json
  {
    "subscription": {
      "plan": "starter|unlimited",
      "status": "active|past_due",
      "current_period_end": "ISO 8601",
      "amount_cents": 5000
    }
  }
  ```
- **Notes**: Returns `{ "subscription": null }` if no active subscription. Response is cacheable for 5 minutes.

### POST /api/billing/portal
Create a Stripe Billing Portal session.

- **Auth**: Clerk JWT (owner/admin or `can_manage_billing`)
- **Response** (`200`): `{ "url": "https://billing.stripe.com/..." }`
- **Status codes**: `200` OK, `401` Unauthorized, `403` No billing permission, `404` No billing account, `500` Server error

---

## Notification Endpoints

### GET /api/notifications/channels
List notification channels for the organization.

- **Auth**: Clerk JWT

### POST /api/notifications/channels
Create a notification channel.

- **Auth**: Clerk JWT (owner/admin)
- **Request body**:
  ```json
  {
    "name": "string",
    "channel_type": "email|slack|teams|webhook",
    "config": { "type": "email", "recipients": ["user@example.com"] }
  }
  ```

### PATCH /api/notifications/channels/[channelId]
Update a notification channel.

### DELETE /api/notifications/channels/[channelId]
Delete a notification channel.

### GET /api/notifications/rules
List notification rules.

### POST /api/notifications/rules
Create a notification rule.

- **Request body**:
  ```json
  {
    "name": "string",
    "event_type": "device.offline|device.online|device.degraded|agent.offline|agent.online|scan.complete",
    "channel_ids": ["uuid"],
    "filters": { "category_ids": ["uuid"], "device_ids": ["uuid"] },
    "cooldown_minutes": 5
  }
  ```

### PATCH /api/notifications/rules/[ruleId]
Update a notification rule.

### DELETE /api/notifications/rules/[ruleId]
Delete a notification rule.

---

## Onboarding Endpoints

### GET /api/onboarding
Check if user has an organization.

- **Auth**: Clerk JWT
- **Response** (`200`):
  ```json
  {
    "hasOrganization": true,
    "organization": { "id": "uuid", "name": "string", "plan": "trial", ... },
    "role": "owner",
    "permissions": { "can_manage_billing": true, ... }
  }
  ```

### POST /api/onboarding
Create a new organization (onboarding).

- **Auth**: Clerk JWT
- **Request body**:
  ```json
  {
    "organizationName": "string (min 2 chars, required)",
    "referralCode": "string (optional)"
  }
  ```
- **Response** (`200`):
  ```json
  {
    "organization": { "id": "uuid", "name": "string", "plan": "trial", "referral_code": "string", ... },
    "isNew": true
  }
  ```
- **Notes**: Creates default categories (Servers, Network, Workstations, Printers, Other). Sends welcome email. Generates a unique referral code.

---

## Webhook Endpoints

### POST /api/webhook/stripe
Stripe webhook handler.

- **Auth**: Stripe webhook signature (`STRIPE_WEBHOOK_SECRET`)
- **Events handled**:
  - `checkout.session.completed` - Activates subscription
  - `invoice.payment_succeeded` - Updates subscription period
  - `invoice.payment_failed` - Marks org as `past_due`
  - `customer.subscription.deleted` - Cancels subscription
- **Notes**: Idempotent. Updates organization plan, status, and limits based on subscription events.

---

## Internal Admin Endpoints

### GET /api/internal/organizations
List all organizations (paginated, filterable).

- **Auth**: Internal (staff/admin)
- **Query params**: `status`, `plan`, `search`, `page`, `limit`
- **Response** (`200`): `{ "organizations": [...], "total": 100, "page": 1, "limit": 50 }`

### GET /api/internal/organizations/[id]
Get organization details.

### PATCH /api/internal/organizations/[id]
Update organization settings.

### POST /api/internal/organizations/[id]/actions
Execute admin actions (suspend, reactivate, change plan, etc.).

- **Request body**: `{ "action": "suspend|reactivate|change_plan|extend_trial", ... }`

---

### GET /api/internal/audit-logs
List audit logs (paginated, filterable).

- **Auth**: Internal (staff/admin)
- **Query params**: `organization_id`, `action`, `page`, `limit`

### GET /api/internal/metrics
Platform-wide metrics (total orgs, agents, devices, revenue).

- **Auth**: Internal (staff/admin)

### GET /api/internal/subscriptions
List all subscriptions.

- **Auth**: Internal (staff/admin)

### GET /api/internal/trials
List organizations with expiring trials.

- **Auth**: Internal (staff/admin)

### GET /api/internal/support/search
Search organizations and users for support.

- **Auth**: Internal (staff/admin)
- **Query params**: `q` - search query

---

## CRON Endpoints

### GET /api/cron/lifecycle (also accepts POST)
SaaS lifecycle automation (trial warnings, expirations, suspensions, data purges).

- **Auth**: CRON Secret (`Authorization: Bearer <CRON_SECRET>`)
- **Notes**: Scheduled every 6 hours. Sends trial warning emails at 3 days remaining, expires trials, suspends past-due accounts after grace period, purges cancelled org data after retention period.

---

## Segment Endpoints

### GET /api/segments
List segments for the organization.

- **Auth**: Clerk JWT

### POST /api/segments
Create a network segment.

- **Auth**: Clerk JWT (owner/admin or `can_manage_agents`)

### PATCH /api/segments/[id]
Update a segment.

### DELETE /api/segments/[id]
Delete a segment.

---

## Additional Implemented Endpoints (Summary)

These endpoints are used by the UI and internal tooling but are not fully expanded in this document:

- `POST /api/webhook/clerk` â€” Clerk user sync webhook (Svix signed).
- `GET /api/health` â€” Health check.
- `GET /api/client-info` â€” Returns client environment/config info for the UI.
- `GET /api/dashboard/segments` â€” Dashboard segments list.
- `POST /api/dashboard/agents/[id]/segments` â€” Create segment for an agent (CIDR validation + overlap checks).
- `POST /api/dashboard/agents/[id]/rotate-key` â€” Rotate agent API key (24h grace on previous key).
- `POST /api/dashboard/agents/[id]/commands` â€” Queue agent commands.
- `GET|PATCH|DELETE /api/agents/[id]` â€” Agent detail operations (non-dashboard route).
- `GET|PATCH|DELETE /api/dashboard/agents/[id]` â€” Agent detail operations (dashboard route).
- `GET /api/dashboard/devices/export` â€” Export devices (CSV/JSON).
- `POST /api/dashboard/devices/import` â€” Import devices (CSV).
- `GET /api/billing/details` â€” Billing overview (subscription, payment method, invoices).
- `POST /api/billing/change-plan` â€” Change subscription plan.
- `POST /api/billing/update-payment` â€” Update payment method.
- `POST /api/billing/cancel` â€” Cancel subscription.
- `POST /api/billing/reactivate` â€” Reactivate subscription.
- `GET /api/invitations/verify` â€” Verify invitation token.
- `POST /api/invitations/accept` â€” Accept invitation.
- `DELETE /api/dashboard/invitations/[id]` â€” Revoke invitation.
- `POST /api/dashboard/invitations/[id]/resend` â€” Resend invitation email.
- `DELETE /api/internal/invitations/[id]` â€” Revoke admin invitation.
- `GET /api/internal/admins` â€” List staff/admin users.
- `POST /api/internal/admins` â€” Invite or create staff/admin user.
- `PATCH /api/internal/admins/[id]` â€” Update admin role or status.
- `DELETE /api/internal/admins/[id]` â€” Remove admin role.
- `GET /api/dashboard/support` â€” Support tickets for org.
- `GET /api/internal/support` â€” Support tickets across orgs.

---

## Common Error Response Format

All error responses follow this format:

```json
{
  "error": "Human-readable error message",
  "code": "ERROR_CODE (optional)",
  "details": "Additional details (optional)"
}
```

Standard error codes: `UNAUTHORIZED` (401), `FORBIDDEN` (403), `NOT_FOUND` (404), `BAD_REQUEST` (400), `VALIDATION_ERROR` (400), `RATE_LIMITED` (429), `INTERNAL_ERROR` (500).
