# VelocityPulse Dashboard Review (2026-02-08)

## Scope
Documentation and code review of `velocitypulse-dashboard` with a focus on authentication, cron security, segment validation, and configuration hygiene. No runtime tests were executed.

## Summary
Key risks are centered around API key rotation (old keys not accepted), cron endpoint authentication when `CRON_SECRET` is unset, and inconsistent CIDR validation across segment-creation endpoints. Documentation also diverges from implementation in multiple places.

## Findings
- Critical: API key rotation grace period is not enforced. Rotated keys are stored with `previous_api_key_hash` but authentication only checks the current key. This breaks agents immediately after rotation.
- High: Cron lifecycle endpoint is unauthenticated if `CRON_SECRET` is missing. API docs also describe `POST`, while the route implements `GET` only.
- High: `/api/dashboard/agents/[id]/segments` only uses a basic CIDR regex and skips overlap checks. `/api/segments` uses stricter validation and overlap detection.
- Medium: Docs vs code mismatch for agent auth header name (`x-api-key` vs `x-agent-key`), staff role source of truth, and Stripe API version.
- Medium: Env validation exists but is unused and partially misaligned (e.g., `SENTRY_DSN` vs `NEXT_PUBLIC_SENTRY_DSN`).
- Low: API documentation does not list several implemented endpoints (invitations, device import/export, clerk webhook, internal admins, etc.).

## Proposed Fix Plan (Core Changes First)
1. API key rotation grace period
   - Accept `previous_api_key_hash` until `previous_api_key_expires_at` for both HTTP and Socket.IO auth.
   - Keep current-key validation unchanged.
2. Cron auth hardening + method alignment
   - Require `CRON_SECRET` in production; return a clear error if missing.
   - Accept both `GET` and `POST` handlers (to match docs and existing Vercel cron).
3. Segment validation parity
   - Reuse shared CIDR validation (`isValidCidr`) and overlap checks (`validateNoOverlap`) in `/api/dashboard/agents/[id]/segments`.

## Follow-on Cleanup
1. Align docs to implementation (agent auth headers, staff role, cron method, Stripe API version).
2. Add missing endpoints to API docs (or explicitly scope the doc).
3. Wire env validation to run at startup; align schemas to actual usage.

## Test Gaps
- No tests cover API key rotation grace period.
- No tests cover cron auth when `CRON_SECRET` is missing.
- No tests cover overlap validation in `/api/dashboard/agents/[id]/segments`.
