# Email & Notification End-to-End Validation (Phase 3)

Date: 2026-02-11  
Scope: dashboard lifecycle/member/admin emails + dashboard alert notifications + marketing contact/partner form delivery  
Method: static code path validation of trigger -> dispatch -> persistence -> observability.

Status legend:

- `PASS`: implemented and operationally usable.
- `PARTIAL`: implemented with reliability/visibility gaps.
- `FAIL`: missing or materially unsafe for production expectations.

## Trigger Matrix

| Trigger | Expected Behavior | Current Behavior | Status | Evidence |
|---|---|---|---|---|
| Onboarding welcome email | New org owner gets welcome email with failure visibility | Email is sent fire-and-forget; failures can be silent | PARTIAL | `velocitypulse-dashboard/src/app/api/onboarding/route.ts:157`, `velocitypulse-dashboard/src/app/api/onboarding/route.ts:160`, `velocitypulse-dashboard/src/lib/emails/lifecycle.ts:12` |
| Trial expiring warning email | Sent once per policy window, with delivery confirmation | Cron sends email and writes audit marker regardless of send result | PARTIAL | `velocitypulse-dashboard/src/app/api/cron/lifecycle/route.ts:79`, `velocitypulse-dashboard/src/app/api/cron/lifecycle/route.ts:81`, `velocitypulse-dashboard/src/lib/emails/lifecycle.ts:40` |
| Trial expired email | Sent on suspension due to trial expiry | Trigger exists, but boolean send outcome is ignored | PARTIAL | `velocitypulse-dashboard/src/app/api/cron/lifecycle/route.ts:113`, `velocitypulse-dashboard/src/lib/emails/lifecycle.ts:110` |
| Account suspended email (grace period exceeded) | Sent when billing suspension occurs | Trigger exists, but send outcome is ignored | PARTIAL | `velocitypulse-dashboard/src/app/api/cron/lifecycle/route.ts:163`, `velocitypulse-dashboard/src/lib/emails/lifecycle.ts:149` |
| Subscription activated email | Sent after successful checkout lifecycle event | Triggered from Stripe webhook, fire-and-forget | PARTIAL | `velocitypulse-dashboard/src/app/api/webhook/stripe/route.ts:145`, `velocitypulse-dashboard/src/app/api/webhook/stripe/route.ts:152` |
| Subscription cancelled email | Sent on cancellation lifecycle event | Triggered from Stripe webhook, fire-and-forget | PARTIAL | `velocitypulse-dashboard/src/app/api/webhook/stripe/route.ts:265`, `velocitypulse-dashboard/src/app/api/webhook/stripe/route.ts:272` |
| Payment failed email | Sent to billing contacts on failed invoice | Trigger exists from webhook, but success/failure not persisted | PARTIAL | `velocitypulse-dashboard/src/app/api/webhook/stripe/route.ts:309`, `velocitypulse-dashboard/src/app/api/webhook/stripe/route.ts:321` |
| Member invitation email | Invite email should be guaranteed/visible before reporting invite sent | Send function returns boolean but route does not validate it | PARTIAL | `velocitypulse-dashboard/src/app/api/dashboard/members/route.ts:315`, `velocitypulse-dashboard/src/app/api/dashboard/members/route.ts:318`, `velocitypulse-dashboard/src/lib/emails/lifecycle.ts:196` |
| Member invitation resend email | Resend should fail if email send fails | Same boolean outcome ignored | PARTIAL | `velocitypulse-dashboard/src/app/api/dashboard/invitations/[id]/resend/route.ts:92`, `velocitypulse-dashboard/src/app/api/dashboard/invitations/[id]/resend/route.ts:95` |
| Member added notification email | Existing user added directly should receive notification | Send is awaited but result is ignored | PARTIAL | `velocitypulse-dashboard/src/app/api/dashboard/members/route.ts:252`, `velocitypulse-dashboard/src/lib/emails/lifecycle.ts:233` |
| Admin invitation email | Admin invite should be durable and auditable | Send outcome not checked before success response/audit | PARTIAL | `velocitypulse-dashboard/src/app/api/internal/admins/route.ts:223`, `velocitypulse-dashboard/src/app/api/internal/admins/route.ts:226` |
| Device status alert notifications | Event -> matching rules -> channel sends -> history log | Implemented for device status changes with cooldown and history | PASS | `velocitypulse-dashboard/src/app/api/agent/devices/status/route.ts:137`, `velocitypulse-dashboard/src/lib/notifications/service.ts:29`, `velocitypulse-dashboard/src/lib/notifications/service.ts:145`, `velocitypulse-dashboard/src/lib/notifications/service.ts:238` |
| Agent offline/online notifications | Agent events emitted when agent status changes | Event types exist in schema/UI but no producer emits them | FAIL | `velocitypulse-dashboard/src/lib/validations/index.ts:59`, `velocitypulse-dashboard/src/app/(dashboard)/notifications/page.tsx:52`, `velocitypulse-dashboard/src/lib/notifications/service.ts:292`, `velocitypulse-dashboard/src/app/api/agent/devices/status/route.ts:149` |
| Scan complete notifications | Event emitted on scan completion | Event type exists but no producer path found | FAIL | `velocitypulse-dashboard/src/lib/validations/index.ts:59`, `velocitypulse-dashboard/src/app/(dashboard)/notifications/page.tsx:54`, `velocitypulse-dashboard/src/app/api/agent/devices/discovered/route.ts:94`, `velocitypulse-dashboard/src/app/api/agent/devices/discovered/route.ts:130` |
| Notification channel config validation | Strong schema validation for create/update per channel type | Channels create/update accept raw config with minimal checks | PARTIAL | `velocitypulse-dashboard/src/app/api/notifications/channels/route.ts:57`, `velocitypulse-dashboard/src/app/api/notifications/channels/[channelId]/route.ts:60` |
| Notification send retry/fallback | Retries/backoff/dead-letter for transient provider failures | Single-attempt sender calls; failures only logged to history | PARTIAL | `velocitypulse-dashboard/src/lib/notifications/service.ts:126`, `velocitypulse-dashboard/src/lib/notifications/service.ts:249`, `velocitypulse-dashboard/src/lib/notifications/senders/email.ts:36` |
| Marketing contact form delivery | Success only when at least one durable sink succeeds | Route always returns success after delivery call | FAIL | `velocitypulse-web/app/api/contact/route.ts:27`, `velocitypulse-web/app/api/contact/route.ts:29`, `velocitypulse-web/lib/form-delivery.ts:31` |
| Marketing partner form delivery | Same durability contract as contact form | Same always-success pattern | FAIL | `velocitypulse-web/app/api/partners/route.ts:40`, `velocitypulse-web/app/api/partners/route.ts:55`, `velocitypulse-web/lib/form-delivery.ts:48` |
| Marketing email provider error handling | Resend non-2xx should be detected and surfaced | Fetch response status not checked in form-delivery email functions | FAIL | `velocitypulse-web/lib/form-delivery.ts:72`, `velocitypulse-web/lib/form-delivery.ts:107` |
| Marketing form abuse control | API POST endpoints rate-limited in production architecture | In-memory limiter exists; not distributed across instances | PARTIAL | `velocitypulse-web/middleware.ts:4`, `velocitypulse-web/middleware.ts:14`, `velocitypulse-web/middleware.ts:91` |

## Priority Findings

## P1

### 1. Multiple email paths can report success when no email was actually delivered

Scope:

- Dashboard lifecycle/member/admin sends.
- Marketing contact/partner form acknowledgements.

Why this matters:

- Creates silent communication failures in customer-facing and revenue-adjacent workflows.
- Operators cannot trust API success responses as proof of delivery.

Key evidence:

- `velocitypulse-dashboard/src/lib/emails/lifecycle.ts:12`
- `velocitypulse-dashboard/src/app/api/dashboard/members/route.ts:315`
- `velocitypulse-dashboard/src/app/api/internal/admins/route.ts:223`
- `velocitypulse-web/app/api/contact/route.ts:29`
- `velocitypulse-web/lib/form-delivery.ts:72`

### 2. Alert feature advertises agent/scan events that are never emitted

Why this matters:

- Users can configure rules that never fire.
- This is high risk for incident response expectations.

Key evidence:

- `velocitypulse-dashboard/src/lib/validations/index.ts:59`
- `velocitypulse-dashboard/src/app/(dashboard)/notifications/page.tsx:52`
- `velocitypulse-dashboard/src/lib/notifications/service.ts:292`
- `velocitypulse-dashboard/src/app/api/agent/devices/status/route.ts:149`

## P2

### 3. Notification channel mutation APIs lack strong config validation

Evidence:

- `velocitypulse-dashboard/src/app/api/notifications/channels/route.ts:57`
- `velocitypulse-dashboard/src/app/api/notifications/channels/[channelId]/route.ts:60`

### 4. No retry queue/dead-letter strategy for notification delivery

Evidence:

- `velocitypulse-dashboard/src/lib/notifications/service.ts:126`
- `velocitypulse-dashboard/src/lib/notifications/service.ts:249`

### 5. Marketing form rate-limiting is not horizontally durable

Evidence:

- `velocitypulse-web/middleware.ts:4`
- `velocitypulse-web/middleware.ts:5`

## Commercial Readiness Verdict (Email/Notifications)

Current status: **Not launch-ready for communication reliability guarantees.**

Launch blockers:

1. Success responses without assured delivery (dashboard + marketing).
2. Missing agent/scan notification event producers.
3. No production-grade failure handling strategy for critical outbound communication.

## Remediation Plan (Email/Notifications)

1. Define and enforce a delivery contract: API success requires at least one verified sink success (or explicit degraded response contract).
2. In all dashboard email routes, check boolean send outcomes and record structured audit/log entries for failures.
3. Implement agent offline/online and scan-complete event producers (or remove unsupported event types until implemented).
4. Add strict per-channel schema validation for notification channel create/update routes.
5. Add queued retries with exponential backoff and dead-letter capture for outbound email/webhook/slack/teams sends.
6. Add operator observability: delivery metrics, alerting, and searchable history endpoints/views.
7. Replace in-memory marketing API rate limiting with shared/distributed storage for production.
