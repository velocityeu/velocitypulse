# Marketing Site Review (Phase 1C)

Date: 2026-02-11  
Component: `velocitypulse-web`  
Method: static code review + targeted test execution (`npm test`).

## Findings (Ordered by Severity)

## P1

### 1. Public pricing and entitlement claims diverge from dashboard source of truth

Evidence:

- Marketing pricing page advertises `30 days` trial and `Unlimited agents/users` for paid plans (`velocitypulse-web/app/pricing/page.tsx:24`, `velocitypulse-web/app/pricing/page.tsx:45`, `velocitypulse-web/app/pricing/page.tsx:46`, `velocitypulse-web/app/pricing/page.tsx:65`, `velocitypulse-web/app/pricing/page.tsx:66`).
- Marketing metadata and pricing page use `$50/$950` (`velocitypulse-web/app/layout.tsx:23`, `velocitypulse-web/app/pricing/page.tsx:40`, `velocitypulse-web/app/pricing/page.tsx:60`).
- Dashboard canonical plan limits are lower and trial is 14 days (`velocitypulse-dashboard/src/lib/constants.ts:20`, `velocitypulse-dashboard/src/lib/constants.ts:38`, `velocitypulse-dashboard/src/lib/constants.ts:39`, `velocitypulse-dashboard/src/lib/constants.ts:46`, `velocitypulse-dashboard/src/lib/constants.ts:47`), with pricing represented as `£50/£950` (`velocitypulse-dashboard/src/lib/constants.ts:23`, `velocitypulse-dashboard/src/lib/constants.ts:24`).

Impact:

- Commercial messaging can materially misrepresent paid entitlements and trial length.
- High risk of customer disputes, failed expectations, and legal/compliance exposure.

Recommendation:

- Generate marketing plan copy from shared canonical plan config.
- Align currency, trial length, and limits with billing-enforced values.
- Add release check that compares marketing claims against dashboard constants.

### 2. Contact/partner form APIs can return success while all delivery channels fail

Evidence:

- Form delivery uses `Promise.allSettled` and only logs errors, never fails request (`velocitypulse-web/lib/form-delivery.ts:31`, `velocitypulse-web/lib/form-delivery.ts:39`, `velocitypulse-web/lib/form-delivery.ts:48`, `velocitypulse-web/lib/form-delivery.ts:56`).
- API routes always return success after calling delivery (`velocitypulse-web/app/api/contact/route.ts:27`, `velocitypulse-web/app/api/contact/route.ts:29`, `velocitypulse-web/app/api/partners/route.ts:40`, `velocitypulse-web/app/api/partners/route.ts:55`).
- Resend requests do not validate HTTP status/result body (`velocitypulse-web/lib/form-delivery.ts:72`, `velocitypulse-web/lib/form-delivery.ts:107`).

Impact:

- Silent lead/support-ticket loss is possible in production with false-positive UX confirmation.
- Sales/support response SLAs can be missed without operator visibility.

Recommendation:

- Define delivery success criteria (at least one durable sink must succeed).
- Treat total delivery failure as API error and surface actionable failure path to user.
- Validate Resend response codes and add telemetry/alerts for failed sends.

### 3. Hosted Linux installer endpoint is misaligned with current release source

Evidence:

- Hosted Linux script uses `REPO="velocityeu/velocitypulse-agent"` (`velocitypulse-web/app/api/get/agent-sh/route.ts:164`).
- Agent release workflow publishes `agent-v*` in monorepo context (`.github/workflows/agent-release.yml:6`, `.github/workflows/agent-release.yml:82`).
- Hosted Windows script points to monorepo release API (`velocitypulse-web/app/api/get/agent/route.ts:835`), creating platform inconsistency.

Impact:

- Installer reliability from marketing entrypoint (`get.velocitypulse.io/agent.sh`) is at risk.
- New Linux/macOS customers may fail at first-run install.

Recommendation:

- Align `/agent.sh` source to monorepo release path used by Windows installer.
- Add endpoint smoke test in CI/CD to verify latest downloadable asset resolution.

## P2

### 4. Environment validation exists but is not enforced at runtime

Evidence:

- Strict env validators are defined (`velocitypulse-web/lib/env.ts:59`, `velocitypulse-web/lib/env.ts:97`).
- Search results show usage concentrated on helper predicates and tests, with no startup-level `getServerEnv()/getClientEnv()` enforcement in app/runtime paths.

Impact:

- Misconfiguration is discovered late and inconsistently.
- Required keys can be missing while request paths still appear “successful” due graceful fallbacks.

Recommendation:

- Enforce env validation on startup for required production variables.
- Separate required-vs-optional keys by feature flags and fail fast when a required integration is enabled.

### 5. API abuse controls are lightweight for production traffic patterns

Evidence:

- Rate limit uses in-memory map in middleware with explicit comment to use Redis in production (`velocitypulse-web/middleware.ts:4`, `velocitypulse-web/middleware.ts:5`).
- CSP allows `unsafe-inline` and `unsafe-eval` scripts (`velocitypulse-web/middleware.ts:73`).

Impact:

- In-memory limits are easy to bypass across instances and cold starts.
- CSP protections are weaker than expected for an internet-facing marketing surface.

Recommendation:

- Move form rate limiting to shared external store (Redis/Upstash/edge KV).
- Tighten CSP over time (nonce/hash-based inline policy; remove `unsafe-eval` where feasible).

### 6. Test coverage does not exercise conversion-critical API behavior

Evidence:

- Current test scope is limited to env validation (`velocitypulse-web/lib/env.test.ts`).
- No route-level tests for `contact`, `partners`, or form-delivery fallback/error behavior.

Impact:

- Regressions in lead capture and notification reliability can ship undetected.

Recommendation:

- Add API tests for:
  - validation failures
  - partial delivery success/failure matrix
  - total delivery failure contract
  - rate-limit behavior and response codes

## P3

### 7. Installer scripts are duplicated as large inlined route constants (manual sync risk)

Evidence:

- Route files embed full installer scripts with “keep in sync” comments (`velocitypulse-web/app/api/get/agent/route.ts:3`, `velocitypulse-web/app/api/get/agent-sh/route.ts:3`).

Impact:

- Drift risk increases during urgent hotfixes.

Recommendation:

- Generate served script content from canonical files in `velocitypulse-agent/scripts` during build.
- Add checksum/assertion in CI to detect drift between source scripts and served output.

## Test Baseline

Executed:

- `npm test` in `velocitypulse-web` -> **11/11 tests passed** (`lib/env.test.ts` only).

Observation:

- Passing suite does not validate production behavior of form API delivery/error paths.

## Open Questions / Assumptions

1. Is pricing intended to be USD externally while dashboard logic/pricing constants remain GBP, or is this unintended drift?
2. For contact/partner forms, what is the minimum acceptable success condition (email only, DB only, or both)?
3. Should installer scripts continue to be served from marketing app routes, or move to versioned static artifacts/CDN?

## Remediation Plan (Marketing Component)

1. Pricing/trial claim alignment (P1): reconcile marketing copy with dashboard-enforced limits, currency, and lifecycle.
2. Form delivery reliability (P1): implement explicit success/failure contract, response validation, and alerting.
3. Installer endpoint correction (P1): align Linux installer release source with monorepo and add CI smoke checks.
4. Config/abuse hardening (P2): enforce env validation and move to distributed rate-limiting.
5. Test expansion (P2): add route tests for contact/partners and delivery-failure matrices.
