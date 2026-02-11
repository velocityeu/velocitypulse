# Email & Notification End-to-End Validation (Phase 3)

Date: 2026-02-11  
Scope: dashboard lifecycle/member/admin emails + dashboard alert notifications + marketing contact/partner form delivery  
Method: static code path validation of trigger -> dispatch -> persistence -> observability, then post-remediation re-check.

Revalidation notes (2026-02-11):

- Remote DB now includes migration `015_agent_notification_state` supporting agent transition notification state.
- Matrix updated after code changes in dashboard + marketing repos.

Status legend:

- `PASS`: implemented and operationally usable.
- `PARTIAL`: implemented with reliability/visibility gaps.
- `FAIL`: missing or materially unsafe for production expectations.

## Trigger Matrix

| Trigger | Expected Behavior | Current Behavior | Status | Evidence |
|---|---|---|---|---|
| Onboarding welcome email | New org owner gets welcome email with failure visibility | Route now awaits send and returns `welcome_sent` status in response payload | PASS | `velocitypulse-dashboard/src/app/api/onboarding/route.ts:162`, `velocitypulse-dashboard/src/app/api/onboarding/route.ts:179`, `velocitypulse-dashboard/src/lib/emails/lifecycle.ts:12` |
| Trial expiring warning email | Sent once per policy window, with delivery confirmation | Cron checks send result and only writes warning audit marker on successful delivery | PASS | `velocitypulse-dashboard/src/app/api/cron/lifecycle/route.ts:84`, `velocitypulse-dashboard/src/app/api/cron/lifecycle/route.ts:93`, `velocitypulse-dashboard/src/app/api/cron/lifecycle/route.ts:102` |
| Trial expired email | Sent on suspension due to trial expiry | Send result is now checked/logged, but no durable retry queue exists | PARTIAL | `velocitypulse-dashboard/src/app/api/cron/lifecycle/route.ts:126`, `velocitypulse-dashboard/src/app/api/cron/lifecycle/route.ts:132`, `velocitypulse-dashboard/src/lib/emails/lifecycle.ts:110` |
| Account suspended email (grace period exceeded) | Sent when billing suspension occurs | Send result is checked/logged, but no durable retry queue exists | PARTIAL | `velocitypulse-dashboard/src/app/api/cron/lifecycle/route.ts:183`, `velocitypulse-dashboard/src/app/api/cron/lifecycle/route.ts:190`, `velocitypulse-dashboard/src/lib/emails/lifecycle.ts:149` |
| Subscription activated email | Sent after successful checkout lifecycle event | Webhook now uses send wrapper with explicit failure logging; failures are not persisted to dedicated delivery table | PARTIAL | `velocitypulse-dashboard/src/app/api/webhook/stripe/route.ts:562`, `velocitypulse-dashboard/src/app/api/webhook/stripe/route.ts:208` |
| Subscription cancelled email | Sent on cancellation lifecycle event | Same wrapper pattern; no durable retry/dead-letter path | PARTIAL | `velocitypulse-dashboard/src/app/api/webhook/stripe/route.ts:749`, `velocitypulse-dashboard/src/app/api/webhook/stripe/route.ts:208` |
| Payment failed email | Sent to billing contacts on failed invoice | Same wrapper pattern; no durable retry/dead-letter path | PARTIAL | `velocitypulse-dashboard/src/app/api/webhook/stripe/route.ts:823`, `velocitypulse-dashboard/src/app/api/webhook/stripe/route.ts:208` |
| Member invitation email | Invite email should be guaranteed/visible before reporting invite sent | Route now blocks success and rolls back invite when send fails | PASS | `velocitypulse-dashboard/src/app/api/dashboard/members/route.ts:325`, `velocitypulse-dashboard/src/app/api/dashboard/members/route.ts:339`, `velocitypulse-dashboard/src/lib/emails/lifecycle.ts:196` |
| Member invitation resend email | Resend should fail if email send fails | Route now returns explicit error when resend delivery fails | PASS | `velocitypulse-dashboard/src/app/api/dashboard/invitations/[id]/resend/route.ts:93`, `velocitypulse-dashboard/src/app/api/dashboard/invitations/[id]/resend/route.ts:109` |
| Member added notification email | Existing user added directly should receive notification | Route captures send result and surfaces `notification_email_sent` flag | PARTIAL | `velocitypulse-dashboard/src/app/api/dashboard/members/route.ts:255`, `velocitypulse-dashboard/src/app/api/dashboard/members/route.ts:286`, `velocitypulse-dashboard/src/lib/emails/lifecycle.ts:233` |
| Admin invitation email | Admin invite should be durable and auditable | Route now blocks success and removes invitation when email send fails | PASS | `velocitypulse-dashboard/src/app/api/internal/admins/route.ts:224`, `velocitypulse-dashboard/src/app/api/internal/admins/route.ts:238`, `velocitypulse-dashboard/src/lib/emails/lifecycle.ts:212` |
| Device status alert notifications | Event -> matching rules -> channel sends -> history log | Existing implementation remains in place | PASS | `velocitypulse-dashboard/src/app/api/agent/devices/status/route.ts:136`, `velocitypulse-dashboard/src/lib/notifications/service.ts:31`, `velocitypulse-dashboard/src/lib/notifications/service.ts:275` |
| Agent offline/online notifications | Agent events emitted when agent status changes | Producers now implemented on heartbeat transition (`online`) and lifecycle cron (`offline`) with persistent transition state | PASS | `velocitypulse-dashboard/src/lib/api/agent-auth.ts:92`, `velocitypulse-dashboard/src/app/api/cron/lifecycle/route.ts:225`, `supabase/migrations/015_agent_notification_state.sql:5` |
| Scan complete notifications | Event emitted on scan completion | Producer now triggers `scan.complete` after discovery ingestion | PASS | `velocitypulse-dashboard/src/app/api/agent/devices/discovered/route.ts:139`, `velocitypulse-dashboard/src/lib/notifications/service.ts:344` |
| Notification channel config validation | Strong schema validation for create/update per channel type | Create/update routes now validate and normalize config per channel type | PASS | `velocitypulse-dashboard/src/lib/notifications/channel-validation.ts:42`, `velocitypulse-dashboard/src/app/api/notifications/channels/route.ts:81`, `velocitypulse-dashboard/src/app/api/notifications/channels/[channelId]/route.ts:92` |
| Notification send retry/fallback | Retries/backoff/dead-letter for transient provider failures | In-process retries with backoff now exist, but no queue-backed retries or dead-letter capture | PARTIAL | `velocitypulse-dashboard/src/lib/notifications/service.ts:12`, `velocitypulse-dashboard/src/lib/notifications/service.ts:213`, `velocitypulse-dashboard/src/lib/notifications/service.ts:254` |
| Marketing contact form delivery | Success only when at least one durable sink succeeds | API now fails when all configured sinks fail and returns degraded flag on partial success | PASS | `velocitypulse-web/lib/form-delivery.ts:62`, `velocitypulse-web/app/api/contact/route.ts:27`, `velocitypulse-web/app/api/contact/route.ts:42` |
| Marketing partner form delivery | Same durability contract as contact form | Same sink-success contract as contact flow | PASS | `velocitypulse-web/lib/form-delivery.ts:85`, `velocitypulse-web/app/api/partners/route.ts:40`, `velocitypulse-web/app/api/partners/route.ts:68` |
| Marketing email provider error handling | Resend non-2xx should be detected and surfaced | Resend HTTP failures now set explicit sink-level errors | PASS | `velocitypulse-web/lib/form-delivery.ts:147`, `velocitypulse-web/lib/form-delivery.ts:209` |
| Marketing form abuse control | API POST endpoints rate-limited in production architecture | In-memory limiter remains; no distributed/shared limiter implementation yet | PARTIAL | `velocitypulse-web/middleware.ts:4`, `velocitypulse-web/middleware.ts:14`, `velocitypulse-web/middleware.ts:91` |

## Priority Findings

## P1

### 1. Notification delivery still lacks durable queue/dead-letter semantics

Why this matters:

- Retries are currently process-local and short-lived.
- Transient provider outages across deploys/restarts can still drop high-value notifications.

Key evidence:

- `velocitypulse-dashboard/src/lib/notifications/service.ts:12`
- `velocitypulse-dashboard/src/lib/notifications/service.ts:213`
- `docs/review/06-remediation-roadmap.md:196`

### 2. Stripe lifecycle emails have failure visibility but no durable delivery persistence

Why this matters:

- Webhook email failures are logged, but not persisted in a dedicated outbound-delivery record for support and audit workflows.

Key evidence:

- `velocitypulse-dashboard/src/app/api/webhook/stripe/route.ts:208`
- `velocitypulse-dashboard/src/app/api/webhook/stripe/route.ts:562`
- `velocitypulse-dashboard/src/app/api/webhook/stripe/route.ts:823`

## P2

### 3. Marketing form rate-limiting is still not horizontally durable

Evidence:

- `velocitypulse-web/middleware.ts:4`
- `velocitypulse-web/middleware.ts:14`

### 4. Some lifecycle email paths are visible but not yet standardized to a single delivery telemetry model

Evidence:

- `velocitypulse-dashboard/src/app/api/onboarding/route.ts:179`
- `velocitypulse-dashboard/src/app/api/cron/lifecycle/route.ts:37`
- `velocitypulse-dashboard/src/app/api/dashboard/members/route.ts:286`

## Commercial Readiness Verdict (Email/Notifications)

Current status: **Improved, but still not launch-ready for communication reliability guarantees.**

Launch blockers:

1. Add queue-backed retries + dead-letter capture for critical outbound notifications.
2. Add durable outbound delivery history for Stripe lifecycle emails to support operations and auditability.

## Delta Since Previous Pass

Closed from previous P1 set:

1. False-success responses for marketing contact/partner APIs.
2. Missing `agent.offline/online` and `scan.complete` producers.
3. Missing strict channel config validation on notification channel mutations.

Still open (narrowed scope):

1. Durable retry/dead-letter and operator telemetry depth.
2. Distributed rate-limiter hardening for marketing POST endpoints.
