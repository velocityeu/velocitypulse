# Dashboard Review (Phase 1A)

Date: 2026-02-11  
Component: `velocitypulse-dashboard`  
Method: static code review + targeted test execution (`npm test`).

## Findings (Ordered by Severity)

## P1

### 1. Unvalidated Stripe `priceId` allows unintended billing plans/prices

Evidence:

- `velocitypulse-dashboard/src/app/api/checkout/route.ts:38` accepts client `priceId` directly.
- `velocitypulse-dashboard/src/app/api/checkout/route.ts:114` sends it directly to Stripe checkout.
- `velocitypulse-dashboard/src/app/api/checkout/embedded/route.ts:35` accepts client `priceId` directly.
- `velocitypulse-dashboard/src/app/api/checkout/embedded/route.ts:106` sends it directly to Stripe checkout.
- `velocitypulse-dashboard/src/app/api/billing/change-plan/route.ts:34` accepts `priceId`.
- `velocitypulse-dashboard/src/app/api/billing/change-plan/route.ts:78` maps any non-unlimited price to `starter`.
- `velocitypulse-dashboard/src/app/api/billing/change-plan/route.ts:86` updates Stripe with provided `priceId`.

Impact:

- Authorized users with billing permissions can subscribe/change to any reachable Stripe price ID, not only sanctioned starter/unlimited prices.
- Internal plan state may diverge from actual Stripe price when unknown `priceId` is treated as `starter`.

Recommendation:

- Enforce strict server-side whitelist of allowed price IDs (`STRIPE_STARTER_PRICE_ID`, `STRIPE_UNLIMITED_PRICE_ID`).
- Reject unknown price IDs with `400`.
- Derive plan from explicit mapping table, never default fallback.

### 2. Stripe webhook is not idempotent for `checkout.session.completed`

Evidence:

- `velocitypulse-dashboard/src/app/api/webhook/stripe/route.ts:123` inserts into `subscriptions` without upsert/conflict handling.
- `stripe_subscription_id` is unique by schema (`supabase/migrations/001_multi_tenant_schema.sql:231`).
- Global catch returns `500` (`velocitypulse-dashboard/src/app/api/webhook/stripe/route.ts:352`), so duplicate delivery can trigger retries.

Impact:

- Duplicate/replayed webhook deliveries can fail with DB uniqueness errors and return 500.
- Retries increase operational noise and can delay eventual consistency.

Recommendation:

- Add webhook event idempotency store keyed by Stripe `event.id`, or use robust upsert semantics on `subscriptions`.
- Ensure duplicate event processing returns 2xx without reapplying side effects (audit/email duplication guards).

### 3. `customer.subscription.updated` maps unsupported statuses to organization status

Evidence:

- `velocitypulse-dashboard/src/app/api/webhook/stripe/route.ts:175` maps unknown subscription statuses to `'incomplete'`.
- `velocitypulse-dashboard/src/app/api/webhook/stripe/route.ts:195` writes this mapped status to `organizations`.
- `organizations.status` constraint does not allow `incomplete` (`supabase/migrations/001_multi_tenant_schema.sql:24`).

Impact:

- Organization updates can fail on status constraint violations.
- Status drift between Stripe, `subscriptions`, and `organizations` can occur silently because update errors are not handled.

Recommendation:

- Use explicit safe mapping for org-level statuses only (`active`, `past_due`, `cancelled`, `suspended` as policy).
- Handle unsupported Stripe statuses as no-op + warning log + alert.
- Check and log DB update errors for both `subscriptions` and `organizations`.

### 4. Notification event surface advertises agent/scan events that are never emitted

Evidence:

- Notification schema allows `agent.offline`, `agent.online`, `scan.complete` (`velocitypulse-dashboard/src/lib/validations/index.ts:59`).
- UI exposes these event types (`velocitypulse-dashboard/src/app/(dashboard)/notifications/page.tsx:48`).
- Agent helper exists (`velocitypulse-dashboard/src/lib/notifications/service.ts:292`) but no producers call it.
- Only device events are triggered (`velocitypulse-dashboard/src/app/api/agent/devices/status/route.ts:149`).

Impact:

- Users can configure rules that never fire.
- Creates false confidence in incident alerting.

Recommendation:

- Implement producers for:
  - agent online/offline transitions (heartbeat + offline detector)
  - scan completion event (discovery/scan completion path)
- Or temporarily remove/hide unsupported event types.

## P2

### 5. System-wide “first organization” selection is non-deterministic for multi-org users

Evidence:

- Utility explicitly returns first org membership (`velocitypulse-dashboard/src/lib/api/organization.ts:17`).
- Membership fetch pattern repeatedly uses `.limit(1).single()` without org context, e.g. billing cancel (`velocitypulse-dashboard/src/app/api/billing/cancel/route.ts:35`).

Impact:

- For users in multiple organizations, actions may target unintended org depending on query ordering.
- Conflicts with multi-tenant/multi-org data model expectations.

Recommendation:

- Introduce explicit current-org context (header/session claim/cookie).
- Require org ID in mutating routes and validate membership against that org.

### 6. Notification mutation APIs accept weakly validated payloads

Evidence:

- Channel create only checks presence (`velocitypulse-dashboard/src/app/api/notifications/channels/route.ts:57`), no type/schema enforcement.
- Channel patch applies raw body fields (`velocitypulse-dashboard/src/app/api/notifications/channels/[channelId]/route.ts:60`).
- Rule patch applies raw body fields (`velocitypulse-dashboard/src/app/api/notifications/rules/[ruleId]/route.ts:60`).

Impact:

- Invalid/malformed config can be persisted and only fail later at send time.
- Increased runtime errors and unpredictable channel behavior.

Recommendation:

- Apply strict Zod schemas for both create and patch routes.
- Add per-channel config validation (email recipient shape, webhook URL/method, Slack/Teams formats).

### 7. Environment validation exists but is not wired; DB placeholder client hides misconfiguration in development

Evidence:

- Env validators defined in `velocitypulse-dashboard/src/lib/env.ts:47`.
- Repository search shows no call sites for `getServerEnv()`/`getClientEnv()` in `src`.
- Development fallback creates placeholder Supabase client (`velocitypulse-dashboard/src/lib/db/client.ts:27`).

Impact:

- Misconfiguration is discovered late at runtime instead of failing fast.
- Placeholder behavior can mask root-cause configuration faults.

Recommendation:

- Initialize env validation at app startup (or at first server route import path).
- Replace placeholder DB fallback with explicit fail-fast + actionable diagnostics.

### 8. Automated test coverage is sparse for highest-risk billing/webhook flows

Evidence:

- Dashboard API routes: 79.
- Route unit tests: 5 files (`agent heartbeat/status`, `dashboard agents`, `onboarding`, `billing/subscription`).
- No dedicated tests for Stripe webhook handler or billing mutation routes (`change-plan`, `cancel`, `reactivate`, `update-payment`, checkout handlers).

Impact:

- Regressions in revenue-critical lifecycle paths likely to escape before deployment.

Recommendation:

- Add focused tests for Stripe webhook edge cases and billing mutations:
  - duplicate event idempotency
  - unknown price ID rejection
  - out-of-order webhook handling
  - status transitions (`past_due`, `cancelled`, reactivation)

## P3

### 9. Audit action label for command creation is semantically inaccurate

Evidence:

- Command creation logs `action: 'agent.updated'` in `velocitypulse-dashboard/src/app/api/dashboard/agents/[id]/commands/route.ts:82`.

Impact:

- Audit trail semantics are less reliable for investigations/analytics.

Recommendation:

- Use dedicated action names (e.g., `agent.command_created`).

## Test Baseline

Executed:

- `npm test` in `velocitypulse-dashboard` -> **26/26 tests passed**.

Observation:

- Current passing suite does not materially exercise most billing webhook and mutation paths.

## Open Questions / Assumptions

1. Is multi-organization membership intentionally unsupported in product UX, or planned? Current schema supports it; API defaults imply single active org.
2. Should unknown Stripe statuses map to explicit internal status (`suspended`) or remain unchanged until a policy decision?
3. Should `agent.offline/online` and `scan.complete` be launch-required notification events, or hidden until implemented?

## Remediation Plan (Dashboard Component)

1. Billing hardening sprint (P1): whitelist price IDs, fix plan mapping, add Stripe webhook idempotency, and safe status mapping.
2. Notification reliability sprint (P1/P2): implement missing event producers and strict payload validation on channel/rule APIs.
3. Tenant context sprint (P2): introduce explicit org context to replace `.limit(1)` membership resolution.
4. Configuration + observability sprint (P2): enforce env validation on startup and remove placeholder DB fallback behavior.
5. Test expansion sprint (P2): add webhook and billing mutation test matrix before commercial launch gate.
