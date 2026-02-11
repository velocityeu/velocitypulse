# Stripe End-to-End Validation (Phase 2)

Date: 2026-02-11  
Scope: `velocitypulse-dashboard` billing + webhook + lifecycle cron + internal subscription admin actions  
Method: static code path validation against production SaaS billing scenarios, then post-remediation re-check.

Revalidation notes (2026-02-11):

- Applied remote DB migrations `013`, `014`, `015` via `npx supabase db push`.
- Verified remote/local migration parity through `npx supabase migration list` (both at `015`).

Status legend:

- `PASS`: implemented and materially production-safe for the scenario.
- `PARTIAL`: implemented but with material reliability/consistency gaps.
- `FAIL`: missing or unsafe for production expectations.

## Lifecycle Matrix

| Scenario | Expected Behavior | Current Behavior | Status | Evidence |
|---|---|---|---|---|
| Trial -> paid purchase (embedded checkout) | Server validates allowed price IDs and creates subscription checkout session | Server rejects unknown `priceId` using strict paid-plan resolver | PASS | `velocitypulse-dashboard/src/app/api/checkout/embedded/route.ts:45`, `velocitypulse-dashboard/src/lib/stripe-pricing.ts:19` |
| Paid plan purchase (hosted checkout) | Server validates allowed price IDs before Stripe session create | Same strict server-side allow-list enforcement as embedded flow | PASS | `velocitypulse-dashboard/src/app/api/checkout/route.ts:49`, `velocitypulse-dashboard/src/lib/stripe-pricing.ts:19` |
| Billing portal access | Authorized billing users can open Stripe portal session | Role/permission checks and portal session creation are in place | PASS | `velocitypulse-dashboard/src/app/api/billing/portal/route.ts:35`, `velocitypulse-dashboard/src/app/api/billing/portal/route.ts:69` |
| `checkout.session.completed` webhook | Idempotent create/update of subscription + org sync | Uses event ledger, stale-event guard, bounded updates, and upsert-style subscription handling | PASS | `velocitypulse-dashboard/src/app/api/webhook/stripe/route.ts:437`, `velocitypulse-dashboard/src/app/api/webhook/stripe/route.ts:480`, `velocitypulse-dashboard/src/app/api/webhook/stripe/route.ts:532`, `supabase/migrations/013_stripe_webhook_events.sql:4`, `supabase/migrations/014_stripe_event_freshness.sql:6` |
| `customer.subscription.updated` webhook | Safe status + plan reconciliation for all Stripe statuses | Stripe statuses now map to valid local org/subscription states; stale events skipped | PASS | `velocitypulse-dashboard/src/lib/stripe-webhook-lifecycle.ts:6`, `velocitypulse-dashboard/src/app/api/webhook/stripe/route.ts:604`, `velocitypulse-dashboard/src/app/api/webhook/stripe/route.ts:660` |
| `customer.subscription.deleted` webhook | Marks subscription/org cancelled with audit + communication | Handler now includes stale guard + deterministic local updates + audit + send wrapper | PASS | `velocitypulse-dashboard/src/app/api/webhook/stripe/route.ts:706`, `velocitypulse-dashboard/src/app/api/webhook/stripe/route.ts:729`, `velocitypulse-dashboard/src/app/api/webhook/stripe/route.ts:738`, `velocitypulse-dashboard/src/app/api/webhook/stripe/route.ts:749` |
| `invoice.payment_failed` webhook | Marks account `past_due`, records audit, notifies billing contacts | Stale-safe org/subscription update + audit + lifecycle email send wrapper | PASS | `velocitypulse-dashboard/src/app/api/webhook/stripe/route.ts:783`, `velocitypulse-dashboard/src/app/api/webhook/stripe/route.ts:796`, `velocitypulse-dashboard/src/app/api/webhook/stripe/route.ts:806`, `velocitypulse-dashboard/src/app/api/webhook/stripe/route.ts:823` |
| `invoice.payment_succeeded` webhook | Recovers from `past_due`, records recovery audit/notifications | Recovery audit added and local state reconciled; no dedicated recovery email path yet | PARTIAL | `velocitypulse-dashboard/src/app/api/webhook/stripe/route.ts:857`, `velocitypulse-dashboard/src/app/api/webhook/stripe/route.ts:883` |
| Cancel at period end | User can schedule cancellation safely | Implemented via Stripe `cancel_at_period_end` + user audit log | PASS | `velocitypulse-dashboard/src/app/api/billing/cancel/route.ts:70`, `velocitypulse-dashboard/src/app/api/billing/cancel/route.ts:75` |
| Reactivate scheduled cancellation | User can remove scheduled cancellation before period end | Implemented via Stripe update + user audit log | PASS | `velocitypulse-dashboard/src/app/api/billing/reactivate/route.ts:70`, `velocitypulse-dashboard/src/app/api/billing/reactivate/route.ts:75` |
| Plan change with proration | Allowed plan transitions only, deterministic plan mapping | Plan change route now validates incoming `priceId` against strict allow-list | PASS | `velocitypulse-dashboard/src/app/api/billing/change-plan/route.ts:41`, `velocitypulse-dashboard/src/lib/stripe-pricing.ts:19` |
| Trial expiry -> suspension -> purge | Lifecycle enforcement with warnings and grace periods | Cron policies still enforced; email outcomes now checked in warning/suspension paths | PASS | `velocitypulse-dashboard/src/app/api/cron/lifecycle/route.ts:84`, `velocitypulse-dashboard/src/app/api/cron/lifecycle/route.ts:126`, `velocitypulse-dashboard/src/app/api/cron/lifecycle/route.ts:183` |
| Duplicate/replayed webhook deliveries | Replays should be acknowledged without side effects | Duplicate events are acknowledged via event ledger and processing-state checks | PASS | `velocitypulse-dashboard/src/lib/stripe-webhook-events.ts:22`, `velocitypulse-dashboard/src/app/api/webhook/stripe/route.ts:437`, `velocitypulse-dashboard/src/app/api/webhook/stripe/route.ts:438`, `supabase/migrations/013_stripe_webhook_events.sql:4` |
| Out-of-order webhook deliveries | Older events must not overwrite newer state | Monotonic `event.created` freshness checks are in place, but no tie-breaker when events share same timestamp second | PARTIAL | `velocitypulse-dashboard/src/lib/stripe-webhook-lifecycle.ts:29`, `velocitypulse-dashboard/src/app/api/webhook/stripe/route.ts:480`, `velocitypulse-dashboard/src/app/api/webhook/stripe/route.ts:595`, `supabase/migrations/014_stripe_event_freshness.sql:6` |
| Missing Stripe references (customer/subscription) | Controlled fallback + explicit operational signal | Missing-reference branches now emit explicit warning/error logs with event context | PASS | `velocitypulse-dashboard/src/app/api/webhook/stripe/route.ts:463`, `velocitypulse-dashboard/src/app/api/webhook/stripe/route.ts:472`, `velocitypulse-dashboard/src/app/api/webhook/stripe/route.ts:587` |
| Manual cancellation from Stripe portal | Full local reconciliation and comms | End-state cancellation is reconciled; scheduled cancellation intent is still not represented as explicit local state | PARTIAL | `velocitypulse-dashboard/src/app/api/billing/portal/route.ts:69`, `velocitypulse-dashboard/src/app/api/webhook/stripe/route.ts:685` |
| Refund processing + post-refund policy | Refund events update local billing state/audit/comms policy | `charge.refunded` handler now exists with audit + reconciliation, but product policy (entitlement impact/comms rules) is not fully codified | PARTIAL | `velocitypulse-dashboard/src/app/api/webhook/stripe/route.ts:899`, `velocitypulse-dashboard/src/app/api/webhook/stripe/route.ts:279`, `velocitypulse-dashboard/src/app/api/internal/subscriptions/[id]/actions/route.ts:199` |
| Charge disputes / chargebacks | Dedicated dispute lifecycle policy + handlers | Dispute handlers now exist and update suspension/audit state; final business policy remains incomplete | PARTIAL | `velocitypulse-dashboard/src/app/api/webhook/stripe/route.ts:905`, `velocitypulse-dashboard/src/app/api/webhook/stripe/route.ts:364`, `velocitypulse-dashboard/src/app/api/webhook/stripe/route.ts:399` |
| Payment method update flow | Setup intent + default PM updates + recoverability | Update flow is implemented; repeated failure policy beyond webhook handling still limited | PARTIAL | `velocitypulse-dashboard/src/components/billing/UpdatePaymentMethod.tsx:38`, `velocitypulse-dashboard/src/app/api/billing/update-payment/route.ts:70`, `velocitypulse-dashboard/src/app/api/billing/update-payment/route.ts:149` |
| Org/subscription synchronization | Updates should be atomic or compensated | Error handling is improved, but cross-table webhook updates are still not transactionally atomic | PARTIAL | `velocitypulse-dashboard/src/app/api/webhook/stripe/route.ts:513`, `velocitypulse-dashboard/src/app/api/webhook/stripe/route.ts:532`, `velocitypulse-dashboard/src/app/api/webhook/stripe/route.ts:660` |
| Billing audit completeness | Every billing-critical transition auditable | Audit coverage improved materially (including recovery/refund/dispute), but some lifecycle policy outcomes are still policy-dependent | PARTIAL | `velocitypulse-dashboard/src/app/api/webhook/stripe/route.ts:550`, `velocitypulse-dashboard/src/app/api/webhook/stripe/route.ts:883`, `velocitypulse-dashboard/src/app/api/webhook/stripe/route.ts:374`, `velocitypulse-dashboard/src/app/api/webhook/stripe/route.ts:399` |

## Priority Findings

## P1

### 1. Refund/dispute lifecycle handlers exist, but production policy is still incomplete

Why this matters:

- Core webhook plumbing is now present, but policy-level behavior is still underspecified for outcomes such as full refund entitlement handling, dispute-lost enforcement windows, and customer-facing comms requirements.

Evidence:

- `velocitypulse-dashboard/src/app/api/webhook/stripe/route.ts:899`
- `velocitypulse-dashboard/src/app/api/webhook/stripe/route.ts:905`
- `docs/review/06-remediation-roadmap.md:112`

### 2. Org + subscription state changes are still not transactionally coupled

Why this matters:

- Multi-write webhook branches can still leave temporary divergence between `organizations` and `subscriptions` under mid-flow failures.

Evidence:

- `velocitypulse-dashboard/src/app/api/webhook/stripe/route.ts:513`
- `velocitypulse-dashboard/src/app/api/webhook/stripe/route.ts:532`
- `velocitypulse-dashboard/src/app/api/webhook/stripe/route.ts:660`

## P2

### 3. Out-of-order protection lacks a tie-break for same-second Stripe events

Evidence:

- `velocitypulse-dashboard/src/lib/stripe-webhook-lifecycle.ts:29`
- `velocitypulse-dashboard/src/app/api/webhook/stripe/route.ts:480`
- `velocitypulse-dashboard/src/app/api/webhook/stripe/route.ts:595`

### 4. Recovery communication coverage is still narrower than full lifecycle expectation

Evidence:

- `velocitypulse-dashboard/src/app/api/webhook/stripe/route.ts:883`
- `velocitypulse-dashboard/src/app/api/webhook/stripe/route.ts:887`

## Commercial Readiness Verdict (Stripe)

Current status: **Improved, but still not launch-ready for Stripe production lifecycle.**

Launch blockers:

1. Finalize and codify refund/dispute/chargeback policy semantics (state + customer communication + support workflow).
2. Move webhook org/subscription reconciliation to transactionally atomic path (DB function/RPC or equivalent compensation strategy).
3. Re-run full Stripe replay/out-of-order matrix with explicit evidence for same-second event ordering behavior.

## Delta Since Previous Pass

Closed from previous P1 set:

1. Webhook replay idempotency gap.
2. Server-side price ID trust gap.
3. Missing webhook handlers for refund/dispute event types.

Still open (newly narrowed scope):

1. Financial policy completeness.
2. Atomicity and edge-ordering hardening.
