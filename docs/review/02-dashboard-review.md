# Dashboard Review (Phase 1A Revalidation)

Date: 2026-02-11  
Component: `velocitypulse-dashboard`  
Method: static code revalidation + targeted test execution (`npm test`, `npx tsc --noEmit`, targeted eslint on modified paths).

## Current Status

Most previously identified P1 implementation gaps are now closed in code. Remaining launch blockers are concentrated in Stripe policy/atomicity, not base plumbing.

## Closed Findings (from initial pass)

1. Server-side Stripe `priceId` trust gap: closed via strict allow-list resolver in checkout/change-plan flows.
2. Stripe webhook replay/idempotency gap: closed via event ledger + duplicate handling.
3. Unsafe Stripe status mapping to unsupported org statuses: closed with explicit lifecycle mapping + stale guards.
4. Missing notification producers (`agent.offline/online`, `scan.complete`): closed.
5. Notification channel weak payload validation: closed.
6. Manual agent upgrade command payload mismatch: closed with route-level payload normalization + validation.
7. Multi-org non-deterministic behavior in high-risk billing/notification/command routes: partially mitigated with explicit `x-organization-id` support and deterministic fallback ordering.
8. DB placeholder fallback masking misconfiguration: closed in dashboard DB client by validated env fail-fast path.

## Active Findings

## P1

### 1. Stripe financial policy semantics remain incomplete

Why this matters:

- Refund/dispute handlers exist, but entitlement policy, customer comms, and support-operational outcomes are not fully codified as deterministic product policy.

Evidence:

- `velocitypulse-dashboard/src/app/api/webhook/stripe/route.ts:899`
- `velocitypulse-dashboard/src/app/api/webhook/stripe/route.ts:905`
- `docs/review/04-stripe-e2e-validation.md:71`

### 2. Stripe webhook org/subscription updates are still not transactionally atomic

Why this matters:

- Cross-table state can still diverge under mid-flow write failures.

Evidence:

- `velocitypulse-dashboard/src/app/api/webhook/stripe/route.ts:513`
- `velocitypulse-dashboard/src/app/api/webhook/stripe/route.ts:660`
- `docs/review/04-stripe-e2e-validation.md:76`

## P2

### 3. Multi-org context rollout is partial

Evidence:

- `velocitypulse-dashboard/src/app/api/billing/cancel/route.ts:34`
- `velocitypulse-dashboard/src/app/api/billing/change-plan/route.ts:52`
- `velocitypulse-dashboard/src/app/api/dashboard/agents/[id]/commands/route.ts:84`

### 4. CI-wide regression gating remains broader than route-critical tests but not full lifecycle matrix

Evidence:

- `.github/workflows/ci.yml:1`
- `docs/review/04-stripe-e2e-validation.md:93`

## Validation Baseline

Executed:

- `npm test` in `velocitypulse-dashboard` -> **44/44 passed**.
- `npx tsc --noEmit` in `velocitypulse-dashboard` -> **passed**.
- targeted `eslint` over modified dashboard API/lib files -> **passed** (repository-wide lint still has pre-existing unrelated violations).

## Component Verdict

Current status: **Improved and materially hardened. Remaining launch blockers are Stripe policy/atomicity completion and full matrix retest evidence.**
