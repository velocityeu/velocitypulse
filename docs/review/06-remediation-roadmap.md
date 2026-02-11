# Commercial Remediation Roadmap (Phase 5)

Date: 2026-02-11  
Scope: consolidated remediation plan across dashboard, marketing site, agent/installer, Stripe lifecycle, and email/notification lifecycle.  
Inputs:

- `/Users/azadmin/Projects/velocitypulse/docs/review/00-technical-baseline.md`
- `/Users/azadmin/Projects/velocitypulse/docs/review/01-marketing-site-review.md`
- `/Users/azadmin/Projects/velocitypulse/docs/review/02-dashboard-review.md`
- `/Users/azadmin/Projects/velocitypulse/docs/review/03-agent-installer-review.md`
- `/Users/azadmin/Projects/velocitypulse/docs/review/04-stripe-e2e-validation.md`
- `/Users/azadmin/Projects/velocitypulse/docs/review/05-email-notification-e2e-validation.md`

## Executive Decision

Current recommendation: **No-Launch (commercial deployment hold).**

Blocking themes:

1. Stripe lifecycle correctness gaps (idempotency, ordering, refunds/disputes, price validation).
2. Email and notification reliability gaps (success reported despite delivery failure; missing alert producers).
3. Agent/installer production safety gaps (release source drift, upgrade safety, unauthenticated local UI).
4. Public commercial inconsistency (pricing/trial claims vs enforced product behavior).

## Priority Model

- `P0` Critical: immediate legal/security/data-loss or active exploit path.
- `P1` High: launch blocker unless explicitly risk-accepted.
- `P2` Medium: should be completed before GA unless mitigation exists.
- `P3` Low: can be scheduled post-GA.

## Consolidated Blocker List (Must Close Pre-Launch)

1. Stripe webhook idempotency and out-of-order protection (`P1`).
2. Stripe refund/dispute/chargeback lifecycle policy and handlers (`P1`).
3. Server-side Stripe price allow-list enforcement (`P1`).
4. Dashboard + marketing email success contract and failure visibility (`P1`).
5. Missing `agent.offline/online` and `scan.complete` notification producers (`P1`).
6. Agent installer release-source alignment and upgrade safety (`P1`).
7. Agent local UI authentication/binding hardening (`P1`).
8. Marketing pricing/trial/entitlement claim parity with dashboard reality (`P1`).

## Workstream Plan

| ID | Workstream | Priority | Owner | Effort | Depends On | Exit Criteria |
|---|---|---|---|---|---|---|
| WS-01 | Stripe core correctness (idempotency/order/price validation) | P1 | Backend + Billing | L | None | Stripe matrix scenarios for replay/order/price abuse pass |
| WS-02 | Stripe financial edge handling (refund/dispute lifecycle) | P1 | Backend + Billing Ops | M | WS-01 | Refund/dispute scenarios have deterministic state/audit/email behavior |
| WS-03 | Email delivery contract hardening (dashboard + web forms) | P1 | Backend + Growth Eng | M | None | APIs no longer return success when all delivery sinks fail |
| WS-04 | Notification parity + reliability | P1/P2 | Backend + Monitoring | M | WS-03 | Agent/scan producers exist or are hidden; retries/validation in place |
| WS-05 | Agent installer + upgrade hardening | P1 | Agent Eng + DevOps | L | None | Installer and upgrade paths are deterministic and tested |
| WS-06 | Agent runtime security hardening (local UI) | P1 | Agent Eng + Security | M | None | UI no longer unauthenticated/public by default |
| WS-07 | Marketing claim and pricing parity | P1 | Product + Web Eng | S | WS-01 decisions | Public pricing/trial/limits align to enforced platform behavior |
| WS-08 | Multi-org context correctness in dashboard APIs | P2 | Backend | M | WS-01 | Mutating routes operate against explicit selected org |
| WS-09 | Env validation + production config fail-fast | P2 | Platform Eng | S | None | All apps fail fast on missing required env for enabled features |
| WS-10 | Test matrix expansion and release gates | P1/P2 | QA + Eng Leads | M | WS-01..WS-07 | CI enforces lifecycle/regression tests for high-risk paths |

## Execution Tracker

Baseline date: 2026-02-11  
Last updated: 2026-02-11  
Update owner: Program lead (or delegated PM/EM)  
Overall program health: `Red`  
Health last updated: 2026-02-11

Status values:

- `Not Started`
- `In Progress`
- `Blocked`
- `Done`

`% Complete` guidance:

- `0%`: not started
- `10-30%`: design/in-progress implementation
- `40-70%`: implementation mostly complete, validation pending
- `80-90%`: validation in progress
- `100%`: done with evidence linked

`Overall program health` guidance:

| Health | Rule |
|---|---|
| Green | No blocked P1 workstreams and all in-flight Wave A items are on schedule |
| Amber | At least one P1 workstream is at risk (slippage <= 3 days) but mitigated |
| Red | Any P1 workstream is blocked, or slippage > 3 days, or launch gates cannot be met in current window |

| Workstream | Owner | Target Start | Target End | Status | % Complete | Last Update | Next Update | Notes / Current Blocker |
|---|---|---|---|---|---|---|---|---|
| WS-01 Stripe core correctness | Backend Lead (Billing) | 2026-02-12 | 2026-02-20 | In Progress | 65% | 2026-02-11 | 2026-02-18 | Implemented: strict `priceId` allow-listing, webhook event ledger + retry semantics, monotonic event freshness columns/guards, safer Stripe status mapping, payment recovery audit, and core webhook write error handling. Remaining: end-to-end replay/order matrix rerun + atomicity hardening via DB transaction/RPC path. |
| WS-02 Stripe financial edge handling | Backend Lead (Billing) + Billing Ops | 2026-02-18 | 2026-02-25 | In Progress | 35% | 2026-02-11 | 2026-02-18 | Implemented webhook handlers for `charge.refunded` and dispute lifecycle (`charge.dispute.created`/`charge.dispute.closed`) with deterministic org status + audit actions. Remaining: finalize explicit product policy (refund consequences, dispute-lost handling), add customer comms templates, and complete matrix retest evidence. |
| WS-03 Email delivery contract hardening | Backend Lead + Growth Eng | 2026-02-12 | 2026-02-19 | In Progress | 78% | 2026-02-11 | 2026-02-18 | Added durable Stripe lifecycle email delivery history (`outbound_email_deliveries`) and retained strict invitation/email false-success protections + marketing sink contract. Remaining: unify lifecycle/member non-invitation email policy (strict fail vs degraded) and standardize telemetry shape across routes. |
| WS-04 Notification parity + reliability | Backend Lead (Monitoring) | 2026-02-20 | 2026-02-28 | In Progress | 72% | 2026-02-11 | 2026-02-18 | Added DB-backed retry/dead-letter queue (`notification_retry_queue`) + cron processor (`/api/cron/notifications`) in addition to earlier producer/config validation work. Remaining: operator-facing queue/history UI and sustained-failure alerting thresholds. |
| WS-05 Agent installer + upgrade hardening | Agent Lead + DevOps Lead | 2026-02-12 | 2026-02-24 | Not Started | 0% | 2026-02-11 | 2026-02-18 | Includes installer source alignment + upgrade rollback safety |
| WS-06 Agent runtime security hardening | Agent Lead + Security Lead | 2026-02-12 | 2026-02-21 | Not Started | 0% | 2026-02-11 | 2026-02-18 | Local UI auth/binding is launch blocker |
| WS-07 Marketing claim/pricing parity | Product Lead + Web Lead | 2026-02-16 | 2026-02-20 | Not Started | 0% | 2026-02-11 | 2026-02-18 | Requires final WS-01 billing policy confirmation |
| WS-08 Multi-org context correctness | Backend Lead | 2026-02-26 | 2026-03-06 | Not Started | 0% | 2026-02-11 | 2026-03-04 | Wave B stabilization |
| WS-09 Env validation fail-fast | Platform Lead | 2026-02-24 | 2026-02-27 | Not Started | 0% | 2026-02-11 | 2026-03-04 | Wave B stabilization, low dependency |
| WS-10 Test matrix + release gates | QA Lead + Eng Leads | 2026-02-21 | 2026-03-07 | Not Started | 0% | 2026-02-11 | 2026-03-04 | Should begin once WS-01/03/05 changes are in PR |

### Tracker Update Protocol

1. On each checkpoint date, update `Last updated` and each row’s `Status`, `% Complete`, `Last Update`, `Next Update`, and blocker notes.
2. Update `Overall program health` and `Health last updated` using the health guidance table.
3. If any workstream slips by more than 3 calendar days, set note prefix to `SLIPPAGE:` and add revised end date rationale.
4. If a workstream becomes blocked by dependency, set `Status` to `Blocked` and cite blocking workstream ID.
5. A workstream can be set to `Done` only when its evidence artifact is updated and launch gate criteria are met.

## Weekly Checkpoint Cadence

| Checkpoint Date | Required Output |
|---|---|
| 2026-02-18 | WS-01/03/05/06 implementation status + blocker list |
| 2026-02-25 | Updated Stripe and email matrices with retest results |
| 2026-03-04 | Launch gate dry-run (LG-01..LG-05) |
| 2026-03-09 | Final launch/no-launch decision review |

## Detailed Component Remediation

## 1) Dashboard + Stripe

### Sequence

1. Implement Stripe event ledger table keyed by `event_id` with unique constraint.
2. Make webhook processing idempotent (already-seen event -> 2xx no-op).
3. Add event freshness/order guard using Stripe event timestamp and local state versioning.
4. Enforce strict server-side mapping of allowed `priceId` values (`starter`, `unlimited` only).
5. Replace fallback plan inference logic that defaults unknown prices to `starter`.
6. Add handlers and policy mapping for refund/dispute events.
7. Enforce atomic org/subscription state updates (transaction or compensating writes + required error checks).
8. Add audit actions for payment recovery and additional lifecycle transitions.

### Acceptance Criteria

1. Duplicate webhook replay does not produce 500.
2. Out-of-order webhook replay cannot regress latest subscription/org state.
3. Unknown `priceId` cannot create/change subscriptions.
4. Refund/dispute events produce deterministic status/audit/communication outcomes.
5. Stripe matrix in `/Users/azadmin/Projects/velocitypulse/docs/review/04-stripe-e2e-validation.md` reaches pass on all P1 scenarios.

## 2) Email + Notification System

### Sequence

1. Define global outbound delivery contract:
   1. request success requires at least one durable sink success, or
   2. request returns explicit degraded/failure semantics.
2. Update dashboard lifecycle/member/admin email routes to check send result and log structured failures.
3. Update marketing form delivery to:
   1. verify Resend HTTP responses,
   2. propagate total-delivery failure to API caller,
   3. emit telemetry for partial failure.
4. Implement notification event producers for:
   1. `agent.offline`/`agent.online` transitions,
   2. `scan.complete` after discovery completion.
5. Add schema validation for notification channel create/update payloads.
6. Add retry and dead-letter handling for notification senders.
7. Add operational history visibility (API/UI) and alerting on sustained send failures.

### Acceptance Criteria

1. No email endpoint reports success when all configured sinks fail.
2. Agent/scan notification rules can be configured and demonstrably triggered.
3. Invalid notification channel configs are rejected at write-time.
4. Failures and retries are visible in history/metrics.
5. Email matrix in `/Users/azadmin/Projects/velocitypulse/docs/review/05-email-notification-e2e-validation.md` passes all P1 scenarios.

## 3) Agent + Installer + Deployment

### Sequence

1. Unify installer release source for Linux/macOS/Windows and hosted endpoints.
2. Add CI smoke checks for installer endpoints resolving latest valid assets.
3. Harden upgrade flow:
   1. require archive URL/manifest format,
   2. install dependencies during upgrade,
   3. health-check + rollback if startup fails.
4. Make agent release workflow test-gated (remove non-blocking tests).
5. Secure local agent UI:
   1. bind to localhost by default,
   2. require auth for HTTP/Socket routes,
   3. optional disable flag for production.
6. Fix dashboard manual upgrade payload requirements.

### Acceptance Criteria

1. Fresh install works on Linux/macOS/Windows from published endpoints.
2. Upgrade succeeds across versions with dependency changes.
3. Release pipeline blocks on failing tests.
4. Local UI is not remotely accessible unauthenticated by default.

## 4) Marketing Site

### Sequence

1. Align pricing/trial/entitlement copy with dashboard-enforced plan constants.
2. Add consistency checks in CI (marketing claims vs canonical plan definitions).
3. Harden contact/partner form API contracts per email delivery workstream.
4. Replace in-memory rate limiter with shared store (Redis/Upstash/KV).
5. Enforce runtime env validation for required production integrations.

### Acceptance Criteria

1. Public claims match enforceable app behavior.
2. Form submission responses reflect true delivery outcome.
3. Abuse control remains effective across horizontal scaling.

## Delivery Waves

## Wave A (Launch blockers only)

- WS-01, WS-02, WS-03, WS-05, WS-06, WS-07

Target outcome:

- resolve all P1 blockers; enable launch-gate verification run.

## Wave B (Stabilization before/at GA)

- WS-04, WS-08, WS-09, WS-10

Target outcome:

- operational resilience, tenancy correctness, and regression guardrails.

## Suggested Ownership

| Domain | Primary Owner | Supporting |
|---|---|---|
| Billing/Stripe | Backend lead | Product + Finance ops |
| Email & Notifications | Backend lead | Growth/Support ops |
| Agent runtime/security | Agent lead | Security |
| Installer/release pipeline | DevOps + Agent lead | Web lead |
| Marketing claims/forms | Web lead | Product + Legal |
| Test governance | QA lead | All engineering leads |

## Launch Gates

| Gate | Requirement | Evidence Artifact |
|---|---|---|
| LG-01 Stripe lifecycle | All P1 scenarios in Stripe matrix pass | Updated `/Users/azadmin/Projects/velocitypulse/docs/review/04-stripe-e2e-validation.md` |
| LG-02 Email reliability | No false-success in critical email/form flows | Updated `/Users/azadmin/Projects/velocitypulse/docs/review/05-email-notification-e2e-validation.md` |
| LG-03 Agent safety | Installer + upgrade + local UI hardening validated | Updated `/Users/azadmin/Projects/velocitypulse/docs/review/03-agent-installer-review.md` |
| LG-04 Commercial consistency | Pricing/trial/legal claims align with product enforcement | Updated `/Users/azadmin/Projects/velocitypulse/docs/review/01-marketing-site-review.md` |
| LG-05 Regression safety | High-risk tests run and required in CI | CI config + test suite reports |

## Risk Acceptance Policy

Pre-launch:

1. No open `P0`.
2. No open `P1` unless explicitly accepted by product, engineering, and business owner with documented mitigation and expiry date.

Post-launch:

1. `P2` items must have owner, due date, and monitoring.
2. `P3` items can be batched into routine hardening cycles.

## Final Commercial Readiness Recommendation

As of 2026-02-11, recommendation remains **No-Launch** until Wave A is complete and launch gates LG-01 through LG-05 are satisfied with evidence.
