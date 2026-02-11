# VelocityPulse End-to-End Commercial Readiness Review Plan

## Objective

Execute a methodical, evidence-based review of the full repository to identify inconsistencies, defects, operational risks, and production-readiness gaps across:

1. Marketing site (`velocitypulse-web`)
2. Dashboard app (`velocitypulse-dashboard`)
3. Agent + installer + deployment flow (`velocitypulse-agent`, installer endpoints, release/deployment scripts)

Special focus:

- Stripe billing lifecycle correctness (purchase -> lifecycle changes -> cancellation -> recovery -> refunds/disputes edge handling)
- Email and notification reliability (lifecycle, invitations, alerts, forms, admin comms)

## Deliverables (Saved Artifacts)

1. `docs/review/00-technical-baseline.md`
   - System architecture and data flow map (apps, APIs, DB, auth, billing, notifications, deployments)
   - Source-of-truth matrix (where each business rule is implemented)

2. `docs/review/01-marketing-site-review.md`
3. `docs/review/02-dashboard-review.md`
4. `docs/review/03-agent-installer-review.md`
   - For each: findings by severity, evidence, impact, reproducibility, recommended fix

5. `docs/review/04-stripe-e2e-validation.md`
   - Lifecycle scenario matrix and pass/fail results

6. `docs/review/05-email-notification-e2e-validation.md`
   - Trigger matrix, deliverability checks, fallback behavior, observability coverage

7. `docs/review/06-remediation-roadmap.md`
   - Component-by-component fix plan with owner, effort, dependency, rollout order

## Severity Model

- `P0` Critical: revenue/security/data-loss/compliance blocker to commercial launch
- `P1` High: material production risk; must fix before launch unless explicit risk acceptance
- `P2` Medium: should fix before GA or behind explicit mitigation
- `P3` Low: quality/documentation/non-blocking inconsistencies

Each finding must include: scope, exact file(s), behavior, expected behavior, risk, and suggested fix.

## Phase Plan

## Phase 0: Baseline & Scope Lock

1. Inventory the codebase, runtime boundaries, and deployment topology.
2. Build architecture diagrams and sequence flows:
   - Signup/onboarding
   - Checkout/subscription events
   - Agent install/register/heartbeat/reporting
   - Notification and email dispatch paths
3. Produce `00-technical-baseline.md`.

Exit criteria:

- Every core workflow is mapped end-to-end with code references.
- Known assumptions and unknowns are explicitly listed.

## Phase 1: Static Review by Component

Run component audits in this order: Dashboard -> Agent/Installer -> Marketing (because billing + notifications center in dashboard, agent depends on dashboard APIs, marketing references both).

### 1A. Dashboard App Review (`velocitypulse-dashboard`)

Checklist:

1. Architecture and boundaries
   - Route ownership, server/client responsibilities, auth boundaries (Clerk, staff/internal paths)
2. Data integrity
   - Supabase schema alignment, status transitions, plan limit enforcement, audit log completeness
3. API consistency
   - Validation parity across routes, error contracts, idempotency, authz checks, rate limiting
4. Stripe integration
   - Checkout routes, billing routes, webhook handler, subscription table/org table synchronization
5. Notification/email
   - Trigger sources, channel senders, cooldown logic, lifecycle/invitation/admin emails
6. Security and ops
   - Secrets handling, webhook verification, cron auth, CSP/rate limits, monitoring/logging
7. Test coverage
   - Ensure high-risk flows have tests; identify uncovered edge cases

### 1B. Agent + Installer + Deployment Review (`velocitypulse-agent`, scripts, get-agent endpoints)

Checklist:

1. Agent runtime correctness
   - Config parsing, auth headers/API key usage, retry/backoff, segment/device/report semantics
2. Installer reliability and safety
   - Linux/macOS and Windows paths, upgrades, rollback/uninstall, privilege boundaries, script drift risks
3. Distribution and release integrity
   - Release tag/version sync, artifact retrieval, fallback behavior, checksum/signing gaps
4. Agent-dashboard compatibility
   - API contract/version compatibility, command lifecycle, heartbeat/status assumptions
5. Deployment script/process quality
   - Environment assumptions, failure handling, observability, rollback clarity

### 1C. Marketing Site Review (`velocitypulse-web`)

Checklist:

1. Product claims vs actual implementation
   - Pricing, plan metadata, payment paths, legal promises, support/refund statements
2. Conversion-critical flows
   - Contact/partner forms, CTA routing, dashboard handoff
3. Email/data delivery
   - Resend/Supabase/Zoho fallback behavior, error handling, silent-failure risks
4. Security and reliability
   - Input validation, rate limiting, environment validation usage, production hardening
5. Consistency with dashboard
   - Pricing IDs/currencies, plan naming, onboarding and installer URLs

Exit criteria (Phase 1):

- Per-component review docs created with prioritized findings and evidence.

## Phase 2: Stripe End-to-End Validation

Create a scenario matrix and validate code + runtime behavior for each path:

1. Checkout start
   - Trial -> paid via embedded checkout
   - Paid plan purchase via hosted checkout
2. Webhook ingestion and idempotency
   - `checkout.session.completed`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.payment_succeeded`
   - `invoice.payment_failed`
3. Subscription lifecycle transitions
   - Active <-> past_due recovery
   - Cancel at period end + reactivation
   - Plan change (proration behavior)
   - Trial expiry, suspension, grace period, purge
4. Financial edge cases for SaaS readiness
   - Duplicate/replayed webhook events
   - Out-of-order events
   - Missing customer/subscription references
   - Manual cancellation from Stripe portal
   - Refund events and post-refund state policy
   - Charge disputes/chargebacks policy and handling
   - Payment method update failures
5. Data and audit consistency
   - `organizations` and `subscriptions` remain synchronized
   - Audit logs recorded for all billing-critical state changes
6. User communication
   - Correct lifecycle emails triggered with correct recipients

Output:

- `04-stripe-e2e-validation.md` with pass/fail, gap, and remediation recommendation per scenario.

## Phase 3: Email & Notification End-to-End Validation

Validate trigger -> dispatch -> persistence -> observability for:

1. Lifecycle emails (trial warnings/expiry, subscription activation/cancellation, payment failure, suspension)
2. Invitation and admin communications
3. Monitoring alerts (email/slack/teams/webhook channel logic)
4. Marketing form emails (contact + partner)

Checks:

- Recipient correctness and role scoping
- Failure handling (provider unavailable, invalid config, transient errors)
- Retry/idempotency expectations
- Logging/audit/history completeness
- Template correctness and consistency

Output:

- `05-email-notification-e2e-validation.md` with matrix of trigger and expected outcome.

## Phase 4: Cross-Component Consistency Sweep

Systematically reconcile:

1. Docs vs code (README, API docs, deployment docs, legal/pricing pages)
2. Env vars and configuration keys across projects
3. Plan names, limits, statuses, and pricing IDs across web/dashboard/db
4. API contracts between agent/dashboard and installer source-of-truth copies
5. Deployment/release instructions vs actual scripts/workflows

Output:

- Consolidated inconsistency log in each component report and cross-linked in roadmap.

## Phase 5: Commercial Readiness Decision & Remediation Plan

1. Roll up all findings and classify launch blockers (`P0/P1`) vs post-launch (`P2/P3`).
2. Create a remediation roadmap per component with:
   - Fix scope
   - Priority
   - Dependency ordering
   - Test requirements
   - Rollout/rollback plan
3. Define launch gates:
   - No open `P0`
   - All `P1` fixed or explicitly risk-accepted with mitigation
   - Stripe and email matrices fully passing for defined critical scenarios

Output:

- `06-remediation-roadmap.md` + launch/no-launch recommendation.

## Execution Method

For every finding:

1. Reproduce with exact path/route/input.
2. Capture objective evidence (code references, test output, runtime trace).
3. Record user/business impact.
4. Propose minimal, safe fix and test to prevent regression.

For every fix plan item:

1. Define acceptance criteria before implementation.
2. Add or update automated tests when feasible.
3. Include monitoring/alert additions if operational risk remains.

## Proposed Review Sequence (Practical)

1. Produce baseline technical description (`00-technical-baseline.md`).
2. Complete Dashboard review + Stripe matrix draft.
3. Complete Agent/Installer/deployment review.
4. Complete Marketing review.
5. Complete email/notification matrix.
6. Publish remediation roadmap and launch readiness decision.
