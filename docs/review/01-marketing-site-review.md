# Marketing Site Review (Phase 1C Revalidation)

Date: 2026-02-11  
Component: `velocitypulse-web`  
Method: static code revalidation + targeted test execution (`npm test`).

## Current Status

Previous P1 commercial-consistency and form-contract issues are now materially remediated. Remaining items are operational hardening (P2).

## Closed P1 Findings

### 1. Pricing/trial/entitlement parity drift

Evidence:

- `velocitypulse-web/app/pricing/page.tsx:22`
- `velocitypulse-web/components/sections/Hero.tsx:31`
- `velocitypulse-web/components/sections/PricingOverview.tsx:12`
- `velocitypulse-web/components/sections/CTABanner.tsx:18`

Result:

- Marketing copy now reflects enforced platform values (14-day trial, £50/£950 pricing, and capped agent/user limits consistent with dashboard plan enforcement).

### 2. Contact/partner false-success delivery behavior

Evidence:

- `velocitypulse-web/lib/form-delivery.ts:62`
- `velocitypulse-web/app/api/contact/route.ts:27`
- `velocitypulse-web/app/api/partners/route.ts:40`

Result:

- APIs now fail when all sinks fail and expose degraded semantics for partial delivery, with sink-level error handling.

### 3. Hosted Linux installer source mismatch

Evidence:

- `velocitypulse-web/app/api/get/agent-sh/route.ts:164`

Result:

- Hosted installer now references `velocityeu/velocitypulse`, aligned with monorepo release workflow.

## Remaining Findings

## P2

### 1. Distributed rate limiting now exists, but deployment must set Upstash envs to avoid fallback mode

Evidence:

- `velocitypulse-web/middleware.ts:49`
- `velocitypulse-web/middleware.ts:68`
- `velocitypulse-web/middleware.ts:150`

Impact:

- If Upstash envs are not configured, middleware falls back to local in-memory counters.

Recommendation:

- Ensure `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` are set in production environments.

### 2. Runtime env validation is defined but not startup-enforced in app entrypaths

Evidence:

- `velocitypulse-web/lib/env.ts:59`
- `velocitypulse-web/lib/env.ts:97`

Impact:

- Misconfiguration can still surface late if validation helpers are not invoked on startup/runtime-critical routes.

Recommendation:

- Enforce feature-gated validation for enabled integrations during startup or first-request bootstrap.

### 3. Conversion-critical API tests are still narrow

Evidence:

- `velocitypulse-web/lib/form-delivery.test.ts:1`
- `velocitypulse-web/lib/env.test.ts:1`

Impact:

- Core contact/partner lifecycle is better covered than before but still not full route-matrix coverage across edge conditions.

Recommendation:

- Expand route-level tests for contact/partner APIs (validation, rate-limit, multi-sink failure modes).

## Test Baseline

Executed:

- `npm test` in `velocitypulse-web` -> **14/14 passed**.

## Component Verdict

Current status: **No open P1 blockers in this component after remediation; remaining work is P2 hardening.**
