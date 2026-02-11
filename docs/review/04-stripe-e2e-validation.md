# Stripe End-to-End Validation (Phase 2)

Date: 2026-02-11  
Scope: `velocitypulse-dashboard` billing + webhook + lifecycle cron + internal subscription admin actions  
Method: static code path validation against production SaaS billing scenarios.

Status legend:

- `PASS`: implemented and materially production-safe for the scenario.
- `PARTIAL`: implemented but with material reliability/consistency gaps.
- `FAIL`: missing or unsafe for production expectations.

## Lifecycle Matrix

| Scenario | Expected Behavior | Current Behavior | Status | Evidence |
|---|---|---|---|---|
| Trial -> paid purchase (embedded checkout) | Server validates allowed price IDs and creates subscription checkout session | Embedded checkout flow exists, but `priceId` is accepted from client without whitelist | PARTIAL | `velocitypulse-dashboard/src/components/billing/EmbeddedCheckout.tsx:19`, `velocitypulse-dashboard/src/app/api/checkout/embedded/route.ts:35`, `velocitypulse-dashboard/src/app/api/checkout/embedded/route.ts:110` |
| Paid plan purchase (hosted checkout) | Server validates allowed price IDs before Stripe session create | Hosted checkout route exists, but same client-supplied `priceId` trust | PARTIAL | `velocitypulse-dashboard/src/app/api/checkout/route.ts:39`, `velocitypulse-dashboard/src/app/api/checkout/route.ts:118` |
| Billing portal access | Authorized billing users can open Stripe portal session | Implemented with role/permission checks and Stripe portal session creation | PASS | `velocitypulse-dashboard/src/app/api/billing/portal/route.ts:35`, `velocitypulse-dashboard/src/app/api/billing/portal/route.ts:69` |
| `checkout.session.completed` webhook | Idempotent create/update of subscription + org sync | Handles event and updates org/subscription, but uses raw insert without idempotency | PARTIAL | `velocitypulse-dashboard/src/app/api/webhook/stripe/route.ts:76`, `velocitypulse-dashboard/src/app/api/webhook/stripe/route.ts:123`, `supabase/migrations/001_multi_tenant_schema.sql:231` |
| `customer.subscription.updated` webhook | Safe status + plan reconciliation for all Stripe statuses | Handles event, but unknown statuses map to `incomplete` and can violate org status constraint | PARTIAL | `velocitypulse-dashboard/src/app/api/webhook/stripe/route.ts:175`, `velocitypulse-dashboard/src/app/api/webhook/stripe/route.ts:196`, `supabase/migrations/001_multi_tenant_schema.sql:24` |
| `customer.subscription.deleted` webhook | Marks subscription/org cancelled with audit + communication | Implemented and sends cancellation email, but no idempotency guard | PARTIAL | `velocitypulse-dashboard/src/app/api/webhook/stripe/route.ts:228`, `velocitypulse-dashboard/src/app/api/webhook/stripe/route.ts:255`, `velocitypulse-dashboard/src/app/api/webhook/stripe/route.ts:265` |
| `invoice.payment_failed` webhook | Marks account `past_due`, records audit, notifies billing contacts | Implemented for status + audit + email | PARTIAL | `velocitypulse-dashboard/src/app/api/webhook/stripe/route.ts:280`, `velocitypulse-dashboard/src/app/api/webhook/stripe/route.ts:293`, `velocitypulse-dashboard/src/app/api/webhook/stripe/route.ts:309` |
| `invoice.payment_succeeded` webhook | Recovers from `past_due`, records recovery audit/notifications | Only flips org `past_due -> active`; no audit trail or communication | PARTIAL | `velocitypulse-dashboard/src/app/api/webhook/stripe/route.ts:329`, `velocitypulse-dashboard/src/app/api/webhook/stripe/route.ts:341` |
| Cancel at period end | User can schedule cancellation safely | Implemented via Stripe `cancel_at_period_end` + user audit log | PASS | `velocitypulse-dashboard/src/app/api/billing/cancel/route.ts:70`, `velocitypulse-dashboard/src/app/api/billing/cancel/route.ts:75` |
| Reactivate scheduled cancellation | User can remove scheduled cancellation before period end | Implemented via Stripe update + user audit log | PASS | `velocitypulse-dashboard/src/app/api/billing/reactivate/route.ts:70`, `velocitypulse-dashboard/src/app/api/billing/reactivate/route.ts:75` |
| Plan change with proration | Allowed plan transitions only, deterministic plan mapping | Proration is enabled, but unknown `priceId` coerces to `starter` | PARTIAL | `velocitypulse-dashboard/src/app/api/billing/change-plan/route.ts:78`, `velocitypulse-dashboard/src/app/api/billing/change-plan/route.ts:86` |
| Trial expiry -> suspension -> purge | Lifecycle enforcement with warnings and grace periods | Cron jobs exist for trial warning/expiry, past_due suspension, and cancelled purge | PASS | `velocitypulse-dashboard/src/app/api/cron/lifecycle/route.ts:45`, `velocitypulse-dashboard/src/app/api/cron/lifecycle/route.ts:94`, `velocitypulse-dashboard/src/app/api/cron/lifecycle/route.ts:129`, `velocitypulse-dashboard/src/app/api/cron/lifecycle/route.ts:179` |
| Duplicate/replayed webhook deliveries | Replays should be acknowledged without side effects | No event ledger/upsert strategy; duplicates can error and return 500 | FAIL | `velocitypulse-dashboard/src/app/api/webhook/stripe/route.ts:123`, `velocitypulse-dashboard/src/app/api/webhook/stripe/route.ts:352`, `supabase/migrations/001_multi_tenant_schema.sql:231` |
| Out-of-order webhook deliveries | Older events must not overwrite newer state | No sequence/timestamp guard; updates apply in arrival order | FAIL | `velocitypulse-dashboard/src/app/api/webhook/stripe/route.ts:183`, `velocitypulse-dashboard/src/app/api/webhook/stripe/route.ts:207` |
| Missing Stripe references (customer/subscription) | Controlled fallback + explicit operational signal | Several branches silently `break` or continue without alerting | PARTIAL | `velocitypulse-dashboard/src/app/api/webhook/stripe/route.ts:86`, `velocitypulse-dashboard/src/app/api/webhook/stripe/route.ts:164`, `velocitypulse-dashboard/src/app/api/webhook/stripe/route.ts:231` |
| Manual cancellation from Stripe portal | Full local reconciliation and comms | End-state cancellation handled on `subscription.deleted`; scheduled cancellation semantics not explicitly tracked locally | PARTIAL | `velocitypulse-dashboard/src/app/api/billing/portal/route.ts:69`, `velocitypulse-dashboard/src/app/api/webhook/stripe/route.ts:228` |
| Refund processing + post-refund policy | Refund events update local billing state/audit/comms policy | Only internal manual refund action exists; no Stripe refund/dispute webhook handling | FAIL | `velocitypulse-dashboard/src/app/api/internal/subscriptions/[id]/actions/route.ts:199`, `velocitypulse-dashboard/src/app/api/internal/subscriptions/[id]/actions/route.ts:214`, `velocitypulse-dashboard/src/app/api/webhook/stripe/route.ts:75` |
| Charge disputes / chargebacks | Dedicated dispute lifecycle policy + handlers | No dispute event handling in webhook switch | FAIL | `velocitypulse-dashboard/src/app/api/webhook/stripe/route.ts:75`, `velocitypulse-dashboard/src/app/api/webhook/stripe/route.ts:351` |
| Payment method update flow | Setup intent + default PM updates + recoverability | Implemented for update, but no explicit lifecycle policy for repeated PM failures beyond `invoice.payment_failed` | PARTIAL | `velocitypulse-dashboard/src/components/billing/UpdatePaymentMethod.tsx:38`, `velocitypulse-dashboard/src/app/api/billing/update-payment/route.ts:70`, `velocitypulse-dashboard/src/app/api/billing/update-payment/route.ts:149` |
| Org/subscription synchronization | Updates should be atomic or compensated | Updates occur across tables without transaction/error checks on each write | PARTIAL | `velocitypulse-dashboard/src/app/api/webhook/stripe/route.ts:183`, `velocitypulse-dashboard/src/app/api/webhook/stripe/route.ts:207` |
| Billing audit completeness | Every billing-critical transition auditable | Many paths log audits, but recovery, replay handling, and unsupported events have gaps | PARTIAL | `velocitypulse-dashboard/src/app/api/webhook/stripe/route.ts:134`, `velocitypulse-dashboard/src/app/api/webhook/stripe/route.ts:299`, `velocitypulse-dashboard/src/app/api/webhook/stripe/route.ts:329` |

## Priority Findings

## P1

### 1. Webhook idempotency and event ordering controls are missing

Why this matters:

- Stripe retry/replay is normal in production.
- Current handler can hard-fail on duplicates and has no protection against stale events overwriting current state.

Evidence:

- `velocitypulse-dashboard/src/app/api/webhook/stripe/route.ts:123`
- `velocitypulse-dashboard/src/app/api/webhook/stripe/route.ts:352`
- `supabase/migrations/001_multi_tenant_schema.sql:231`

### 2. Price ID trust model allows non-sanctioned subscription prices

Why this matters:

- Billing routes accept arbitrary `priceId`.
- Plan mapping fallback to `starter` can desynchronize internal plan vs Stripe price.

Evidence:

- `velocitypulse-dashboard/src/app/api/checkout/route.ts:39`
- `velocitypulse-dashboard/src/app/api/checkout/embedded/route.ts:35`
- `velocitypulse-dashboard/src/app/api/billing/change-plan/route.ts:78`

### 3. Refund/dispute lifecycle is not implemented in webhook policy

Why this matters:

- Production SaaS requires deterministic behavior for refunds, disputes, and chargebacks.
- Internal admin refund action alone is not enough for lifecycle consistency.

Evidence:

- `velocitypulse-dashboard/src/app/api/internal/subscriptions/[id]/actions/route.ts:199`
- `velocitypulse-dashboard/src/app/api/webhook/stripe/route.ts:75`

## P2

### 4. Unsupported Stripe status mapping can violate org status constraints

Evidence:

- `velocitypulse-dashboard/src/app/api/webhook/stripe/route.ts:175`
- `velocitypulse-dashboard/src/app/api/webhook/stripe/route.ts:196`
- `supabase/migrations/001_multi_tenant_schema.sql:24`

### 5. Billing recovery and some lifecycle transitions are not fully auditable

Evidence:

- `velocitypulse-dashboard/src/app/api/webhook/stripe/route.ts:329`
- `velocitypulse-dashboard/src/app/api/webhook/stripe/route.ts:341`

## Commercial Readiness Verdict (Stripe)

Current status: **Not launch-ready for Stripe production lifecycle.**

Launch blockers:

1. Webhook idempotency + replay/out-of-order handling.
2. Refund/dispute/chargeback lifecycle coverage.
3. Server-side price ID allow-list enforcement.

## Remediation Plan (Stripe)

1. Implement a Stripe event ledger (`event.id` uniqueness) and no-op replay acknowledgements.
2. Introduce monotonic state transition checks (event-created timestamp/version gate).
3. Enforce strict server-side price mapping (`starter`/`unlimited` IDs only) across checkout and plan-change APIs.
4. Extend webhook handlers for refund/dispute events with explicit org/subscription policy and audit actions.
5. Make org/subscription updates atomic (transaction or compensation + mandatory error checks).
6. Add billing test matrix automation for all scenarios above, including replay/out-of-order and negative-path assertions.
