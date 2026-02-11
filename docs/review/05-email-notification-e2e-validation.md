# Email & Notification End-to-End Validation (Phase 3)

Date: 2026-02-11  
Scope: dashboard lifecycle/member/admin emails + dashboard alert notifications + marketing contact/partner form delivery  
Method: static code path validation of trigger -> dispatch -> persistence -> observability, then post-remediation re-check.

Revalidation notes (2026-02-11):

- Remote DB now includes migrations `015`, `016`, and `017` (`agent_notification_state`, `outbound_email_deliveries`, `notification_retry_queue`).
- Notification retry queue is scheduled via Vercel cron on `/api/cron/notifications`.

Status legend:

- `PASS`: implemented and operationally usable.
- `PARTIAL`: implemented with reliability/visibility gaps.
- `FAIL`: missing or materially unsafe for production expectations.

## Trigger Matrix

| Trigger | Expected Behavior | Current Behavior | Status | Evidence |
|---|---|---|---|---|
| Onboarding welcome email | New org owner gets welcome email with failure visibility | Route now awaits send and returns `welcome_sent` status in response payload | PASS | `velocitypulse-dashboard/src/app/api/onboarding/route.ts:162`, `velocitypulse-dashboard/src/app/api/onboarding/route.ts:179`, `velocitypulse-dashboard/src/lib/emails/lifecycle.ts:12` |
| Trial expiring warning email | Sent once per policy window, with delivery confirmation | Cron checks send result and only writes warning audit marker on successful delivery | PASS | `velocitypulse-dashboard/src/app/api/cron/lifecycle/route.ts:84`, `velocitypulse-dashboard/src/app/api/cron/lifecycle/route.ts:93`, `velocitypulse-dashboard/src/app/api/cron/lifecycle/route.ts:102` |
| Trial expired email | Sent on suspension due to trial expiry | Send result is checked and tracked; no durable retry queue yet for lifecycle-email sender path itself | PARTIAL | `velocitypulse-dashboard/src/app/api/cron/lifecycle/route.ts:126`, `velocitypulse-dashboard/src/app/api/cron/lifecycle/route.ts:132`, `velocitypulse-dashboard/src/lib/emails/lifecycle.ts:110` |
| Account suspended email (grace period exceeded) | Sent when billing suspension occurs | Send result is checked and tracked; no durable retry queue yet for lifecycle-email sender path itself | PARTIAL | `velocitypulse-dashboard/src/app/api/cron/lifecycle/route.ts:183`, `velocitypulse-dashboard/src/app/api/cron/lifecycle/route.ts:190`, `velocitypulse-dashboard/src/lib/emails/lifecycle.ts:149` |
| Subscription activated email | Sent after successful checkout lifecycle event | Webhook now persists delivery outcomes to `outbound_email_deliveries` | PASS | `velocitypulse-dashboard/src/app/api/webhook/stripe/route.ts:208`, `velocitypulse-dashboard/src/app/api/webhook/stripe/route.ts:220`, `velocitypulse-dashboard/src/app/api/webhook/stripe/route.ts:614`, `supabase/migrations/016_outbound_email_deliveries.sql:5` |
| Subscription cancelled email | Sent on cancellation lifecycle event | Same durable delivery recording path as other webhook lifecycle emails | PASS | `velocitypulse-dashboard/src/app/api/webhook/stripe/route.ts:208`, `velocitypulse-dashboard/src/app/api/webhook/stripe/route.ts:220`, `velocitypulse-dashboard/src/app/api/webhook/stripe/route.ts:806`, `supabase/migrations/016_outbound_email_deliveries.sql:5` |
| Payment failed email | Sent to billing contacts on failed invoice | Same durable delivery recording path as other webhook lifecycle emails | PASS | `velocitypulse-dashboard/src/app/api/webhook/stripe/route.ts:208`, `velocitypulse-dashboard/src/app/api/webhook/stripe/route.ts:220`, `velocitypulse-dashboard/src/app/api/webhook/stripe/route.ts:885`, `supabase/migrations/016_outbound_email_deliveries.sql:5` |
| Member invitation email | Invite email should be guaranteed/visible before reporting invite sent | Route now blocks success and rolls back invite when send fails | PASS | `velocitypulse-dashboard/src/app/api/dashboard/members/route.ts:325`, `velocitypulse-dashboard/src/app/api/dashboard/members/route.ts:339`, `velocitypulse-dashboard/src/lib/emails/lifecycle.ts:196` |
| Member invitation resend email | Resend should fail if email send fails | Route now returns explicit error when resend delivery fails | PASS | `velocitypulse-dashboard/src/app/api/dashboard/invitations/[id]/resend/route.ts:93`, `velocitypulse-dashboard/src/app/api/dashboard/invitations/[id]/resend/route.ts:109` |
| Member added notification email | Existing user added directly should receive notification | Route captures send result and surfaces `notification_email_sent` flag, but still allows success on member-add even when email fails | PARTIAL | `velocitypulse-dashboard/src/app/api/dashboard/members/route.ts:255`, `velocitypulse-dashboard/src/app/api/dashboard/members/route.ts:286`, `velocitypulse-dashboard/src/lib/emails/lifecycle.ts:233` |
| Admin invitation email | Admin invite should be durable and auditable | Route now blocks success and removes invitation when email send fails | PASS | `velocitypulse-dashboard/src/app/api/internal/admins/route.ts:224`, `velocitypulse-dashboard/src/app/api/internal/admins/route.ts:238`, `velocitypulse-dashboard/src/lib/emails/lifecycle.ts:212` |
| Device status alert notifications | Event -> matching rules -> channel sends -> history log | Existing implementation remains in place | PASS | `velocitypulse-dashboard/src/app/api/agent/devices/status/route.ts:136`, `velocitypulse-dashboard/src/lib/notifications/service.ts:31`, `velocitypulse-dashboard/src/lib/notifications/service.ts:290` |
| Agent offline/online notifications | Agent events emitted when agent status changes | Producers now implemented on heartbeat transition (`online`) and lifecycle cron (`offline`) with persistent transition state | PASS | `velocitypulse-dashboard/src/lib/api/agent-auth.ts:92`, `velocitypulse-dashboard/src/app/api/cron/lifecycle/route.ts:225`, `supabase/migrations/015_agent_notification_state.sql:5` |
| Scan complete notifications | Event emitted on scan completion | Producer now triggers `scan.complete` after discovery ingestion | PASS | `velocitypulse-dashboard/src/app/api/agent/devices/discovered/route.ts:139`, `velocitypulse-dashboard/src/lib/notifications/service.ts:553` |
| Notification channel config validation | Strong schema validation for create/update per channel type | Create/update routes now validate and normalize config per channel type | PASS | `velocitypulse-dashboard/src/lib/notifications/channel-validation.ts:42`, `velocitypulse-dashboard/src/app/api/notifications/channels/route.ts:81`, `velocitypulse-dashboard/src/app/api/notifications/channels/[channelId]/route.ts:92` |
| Notification send retry/fallback | Retries/backoff/dead-letter for transient provider failures | In-process retries plus DB-backed retry queue and dead-letter processing are now implemented | PASS | `velocitypulse-dashboard/src/lib/notifications/service.ts:13`, `velocitypulse-dashboard/src/lib/notifications/service.ts:309`, `velocitypulse-dashboard/src/lib/notifications/service.ts:377`, `velocitypulse-dashboard/src/app/api/cron/notifications/route.ts:30`, `supabase/migrations/017_notification_retry_queue.sql:5`, `velocitypulse-dashboard/vercel.json:20` |
| Marketing contact form delivery | Success only when at least one durable sink succeeds | API now fails when all configured sinks fail and returns degraded flag on partial success | PASS | `velocitypulse-web/lib/form-delivery.ts:62`, `velocitypulse-web/app/api/contact/route.ts:27`, `velocitypulse-web/app/api/contact/route.ts:42` |
| Marketing partner form delivery | Same durability contract as contact form | Same sink-success contract as contact flow | PASS | `velocitypulse-web/lib/form-delivery.ts:85`, `velocitypulse-web/app/api/partners/route.ts:40`, `velocitypulse-web/app/api/partners/route.ts:68` |
| Marketing email provider error handling | Resend non-2xx should be detected and surfaced | Resend HTTP failures now set explicit sink-level errors | PASS | `velocitypulse-web/lib/form-delivery.ts:147`, `velocitypulse-web/lib/form-delivery.ts:209` |
| Marketing form abuse control | API POST endpoints rate-limited in production architecture | In-memory limiter remains; no distributed/shared limiter implementation yet | PARTIAL | `velocitypulse-web/middleware.ts:4`, `velocitypulse-web/middleware.ts:14`, `velocitypulse-web/middleware.ts:91` |

## Priority Findings

## P2

### 1. Marketing form rate-limiting is still not horizontally durable

Why this matters:

- Multi-instance deployments can bypass in-memory request counters.

Evidence:

- `velocitypulse-web/middleware.ts:4`
- `velocitypulse-web/middleware.ts:14`

### 2. Some lifecycle/member email paths still expose partial semantics rather than strict delivery guarantees

Why this matters:

- Operational visibility exists, but some non-invitation email sends are still best-effort rather than hard-fail workflows.

Evidence:

- `velocitypulse-dashboard/src/app/api/cron/lifecycle/route.ts:126`
- `velocitypulse-dashboard/src/app/api/cron/lifecycle/route.ts:183`
- `velocitypulse-dashboard/src/app/api/dashboard/members/route.ts:286`

## Commercial Readiness Verdict (Email/Notifications)

Current status: **Materially improved; no open P1 blockers in this matrix.**

Remaining launch-relevant work:

1. Implement distributed marketing POST rate limiting.
2. Decide policy for strict-vs-degraded behavior on non-invitation lifecycle/member notification emails.

## Delta Since Previous Pass

Closed from previous P1 set:

1. False-success responses for marketing contact/partner APIs.
2. Missing `agent.offline/online` and `scan.complete` producers.
3. Missing strict channel config validation on notification channel mutations.
4. Missing durable retry/dead-letter pipeline for notification send failures.
5. Missing durable webhook lifecycle email delivery history.

Still open (narrowed scope):

1. Distributed rate limiter hardening for marketing POST endpoints.
2. Policy tightening for best-effort lifecycle/member non-invitation emails.
