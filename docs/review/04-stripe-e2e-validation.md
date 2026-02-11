# Stripe End-to-End Validation (Phase 2)

Date: 2026-02-11  
Scope: `velocitypulse-dashboard` billing + webhook + lifecycle cron + internal subscription admin actions  
Method: static code-path validation against production SaaS billing scenarios plus post-remediation verification (tests/typecheck/migration parity).

Revalidation notes (2026-02-11):

- Applied remote DB migration `018` via `npx supabase db push`.
- Verified remote/local migration parity through `npx supabase migration list` (both at `018`).
- Verified dashboard regression checks still pass: `npm test`, `npx tsc --noEmit`, and targeted lint on modified Stripe/email files.

Status legend:

- `PASS`: implemented and materially production-safe for the scenario.
- `PARTIAL`: implemented but with reliability/completeness gaps.
- `FAIL`: missing or unsafe for production expectations.

## Lifecycle Matrix

| Scenario | Expected Behavior | Current Behavior | Status | Evidence |
|---|---|---|---|---|
| Trial -> paid purchase (embedded checkout) | Server validates allowed price IDs and creates subscription checkout session | Server rejects unknown `priceId` using strict paid-plan resolver | PASS | `velocitypulse-dashboard/src/app/api/checkout/embedded/route.ts:45`, `velocitypulse-dashboard/src/lib/stripe-pricing.ts:19` |
| Paid plan purchase (hosted checkout) | Server validates allowed price IDs before Stripe session create | Same strict server-side allow-list enforcement as embedded flow | PASS | `velocitypulse-dashboard/src/app/api/checkout/route.ts:49`, `velocitypulse-dashboard/src/lib/stripe-pricing.ts:19` |
| Billing portal access | Authorized billing users can open Stripe portal session | Role/permission checks and portal session creation are in place | PASS | `velocitypulse-dashboard/src/app/api/billing/portal/route.ts:35`, `velocitypulse-dashboard/src/app/api/billing/portal/route.ts:69` |
| `checkout.session.completed` webhook | Idempotent org/subscription reconciliation | Uses event ledger + atomic org/subscription apply RPC + audit + lifecycle email | PASS | `velocitypulse-dashboard/src/app/api/webhook/stripe/route.ts:650`, `velocitypulse-dashboard/src/app/api/webhook/stripe/route.ts:687`, `supabase/migrations/018_stripe_atomic_state_apply.sql:5` |
| `customer.subscription.updated` webhook | Safe status + plan reconciliation for all Stripe statuses | Stripe statuses map to valid local states and are applied atomically with limits/plan updates | PASS | `velocitypulse-dashboard/src/lib/stripe-webhook-lifecycle.ts:6`, `velocitypulse-dashboard/src/app/api/webhook/stripe/route.ts:777`, `supabase/migrations/018_stripe_atomic_state_apply.sql:66` |
| `customer.subscription.deleted` webhook | Marks org/subscription cancelled with audit + communication | Cancellation path now applies atomically and emits audit + cancellation email | PASS | `velocitypulse-dashboard/src/app/api/webhook/stripe/route.ts:850`, `velocitypulse-dashboard/src/app/api/webhook/stripe/route.ts:880` |
| `invoice.payment_failed` webhook | Marks account `past_due`, records audit, notifies billing contacts | Payment-failure state is applied atomically with audit + payment failed email logging | PASS | `velocitypulse-dashboard/src/app/api/webhook/stripe/route.ts:940`, `velocitypulse-dashboard/src/app/api/webhook/stripe/route.ts:969`, `velocitypulse-dashboard/src/app/api/webhook/stripe/route.ts:986` |
| `invoice.payment_succeeded` webhook | Recovers from `past_due`, records recovery audit/notifications | Recovery status and subscription reconciliation are atomic with audit; dedicated recovery email still missing | PARTIAL | `velocitypulse-dashboard/src/app/api/webhook/stripe/route.ts:1035`, `velocitypulse-dashboard/src/app/api/webhook/stripe/route.ts:1067` |
| Cancel at period end | User can schedule cancellation safely | Implemented via Stripe `cancel_at_period_end` + user audit log | PASS | `velocitypulse-dashboard/src/app/api/billing/cancel/route.ts:70`, `velocitypulse-dashboard/src/app/api/billing/cancel/route.ts:75` |
| Reactivate scheduled cancellation | User can remove scheduled cancellation before period end | Implemented via Stripe update + user audit log | PASS | `velocitypulse-dashboard/src/app/api/billing/reactivate/route.ts:70`, `velocitypulse-dashboard/src/app/api/billing/reactivate/route.ts:75` |
| Plan change with proration | Allowed plan transitions only, deterministic plan mapping | Plan change route validates incoming `priceId` against strict allow-list | PASS | `velocitypulse-dashboard/src/app/api/billing/change-plan/route.ts:41`, `velocitypulse-dashboard/src/lib/stripe-pricing.ts:19` |
| Trial expiry -> suspension -> purge | Lifecycle enforcement with warnings and grace periods | Cron policies enforced with send-result checking in warning/suspension paths | PASS | `velocitypulse-dashboard/src/app/api/cron/lifecycle/route.ts:84`, `velocitypulse-dashboard/src/app/api/cron/lifecycle/route.ts:126`, `velocitypulse-dashboard/src/app/api/cron/lifecycle/route.ts:183` |
| Duplicate/replayed webhook deliveries | Replays should be acknowledged without side effects | Duplicate events are acknowledged via webhook event ledger and processing-state guard | PASS | `velocitypulse-dashboard/src/lib/stripe-webhook-events.ts:22`, `velocitypulse-dashboard/src/app/api/webhook/stripe/route.ts:574`, `supabase/migrations/013_stripe_webhook_events.sql:4` |
| Out-of-order webhook deliveries | Older events must not overwrite newer state | Freshness checks remain monotonic by `event.created`; same-second tie-break still not explicit | PARTIAL | `velocitypulse-dashboard/src/lib/stripe-webhook-lifecycle.ts:29`, `supabase/migrations/018_stripe_atomic_state_apply.sql:44`, `supabase/migrations/018_stripe_atomic_state_apply.sql:61` |
| Missing Stripe references (customer/subscription) | Controlled fallback + explicit operational signal | Missing-reference branches emit explicit warning/error logs with event context | PASS | `velocitypulse-dashboard/src/app/api/webhook/stripe/route.ts:609`, `velocitypulse-dashboard/src/app/api/webhook/stripe/route.ts:833`, `velocitypulse-dashboard/src/app/api/webhook/stripe/route.ts:922` |
| Manual cancellation from Stripe portal | Full local reconciliation and comms | End-state cancellation is reconciled; scheduled-cancellation intent is still not represented locally | PARTIAL | `velocitypulse-dashboard/src/app/api/billing/portal/route.ts:69`, `velocitypulse-dashboard/src/app/api/webhook/stripe/route.ts:819` |
| Refund processing + post-refund policy | Deterministic refund lifecycle policy (state/audit/comms) | Full vs partial refund policy is codified with versioned metadata, atomic state apply, and customer comms | PASS | `velocitypulse-dashboard/src/app/api/webhook/stripe/route.ts:82`, `velocitypulse-dashboard/src/app/api/webhook/stripe/route.ts:293`, `velocitypulse-dashboard/src/app/api/webhook/stripe/route.ts:319`, `velocitypulse-dashboard/src/lib/emails/lifecycle.ts:187` |
| Charge disputes / chargebacks | Deterministic dispute lifecycle policy (open/close outcomes) | Dispute created/closed outcomes are codified with atomic state, audit, and dedicated comms templates | PASS | `velocitypulse-dashboard/src/app/api/webhook/stripe/route.ts:421`, `velocitypulse-dashboard/src/app/api/webhook/stripe/route.ts:463`, `velocitypulse-dashboard/src/lib/emails/lifecycle.ts:210`, `velocitypulse-dashboard/src/lib/emails/lifecycle.ts:229` |
| Payment method update flow | Setup intent + default PM updates + recoverability | Update flow is implemented; repeated-failure business policy outside webhook lifecycle still limited | PARTIAL | `velocitypulse-dashboard/src/components/billing/UpdatePaymentMethod.tsx:38`, `velocitypulse-dashboard/src/app/api/billing/update-payment/route.ts:70`, `velocitypulse-dashboard/src/app/api/billing/update-payment/route.ts:149` |
| Org/subscription synchronization | Updates should be atomic or compensated | Main webhook branches now use a single DB RPC for org/subscription writes under row locks | PASS | `velocitypulse-dashboard/src/app/api/webhook/stripe/route.ts:101`, `velocitypulse-dashboard/src/app/api/webhook/stripe/route.ts:650`, `velocitypulse-dashboard/src/app/api/webhook/stripe/route.ts:1035`, `supabase/migrations/018_stripe_atomic_state_apply.sql:34` |
| Billing audit completeness | Every billing-critical transition auditable | Audit coverage includes creation/change/cancel/payment recovery/refund/dispute paths | PASS | `velocitypulse-dashboard/src/app/api/webhook/stripe/route.ts:687`, `velocitypulse-dashboard/src/app/api/webhook/stripe/route.ts:969`, `velocitypulse-dashboard/src/app/api/webhook/stripe/route.ts:1067`, `velocitypulse-dashboard/src/app/api/webhook/stripe/route.ts:350`, `velocitypulse-dashboard/src/app/api/webhook/stripe/route.ts:495` |

## Priority Findings

## P2

### 1. Out-of-order protection still lacks an explicit same-second tie-break contract

Evidence:

- `velocitypulse-dashboard/src/lib/stripe-webhook-lifecycle.ts:29`
- `supabase/migrations/018_stripe_atomic_state_apply.sql:44`
- `supabase/migrations/018_stripe_atomic_state_apply.sql:61`

### 2. Recovery communication coverage is still narrower than full lifecycle expectation

Evidence:

- `velocitypulse-dashboard/src/app/api/webhook/stripe/route.ts:1004`
- `velocitypulse-dashboard/src/app/api/webhook/stripe/route.ts:1067`

### 3. Scheduled cancellation intent is not persisted as a first-class local state

Evidence:

- `velocitypulse-dashboard/src/app/api/billing/cancel/route.ts:70`
- `velocitypulse-dashboard/src/app/api/webhook/stripe/route.ts:819`

## Commercial Readiness Verdict (Stripe)

Current status: **Materially improved with no open P1 blockers in this matrix; remaining items are policy/completeness hardening (P2).**

Remaining launch-relevant work:

1. Add and test an explicit same-second ordering tie-break policy.
2. Decide whether payment recovery requires customer-facing notification.
3. Model scheduled cancellation intent explicitly if product/support workflows require it.

## Delta Since Previous Pass

Closed from previous P1 set:

1. Refund/dispute lifecycle policy codification + customer communications.
2. Org/subscription atomicity hardening for webhook reconciliation.

Still open:

1. Same-second ordering tie-break.
2. Recovery communication and scheduled-cancellation intent completeness.
