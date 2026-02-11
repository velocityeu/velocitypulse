# Email & Notification End-to-End Validation (Phase 3)

Date: 2026-02-11  
Scope: dashboard lifecycle/member/admin emails + dashboard alert notifications + marketing contact/partner form delivery  
Method: static code-path validation of trigger -> dispatch -> persistence -> observability, then post-remediation re-check.

Revalidation notes (2026-02-11):

- Remote DB includes `015`, `016`, `017`, and `018` (`agent_notification_state`, `outbound_email_deliveries`, `notification_retry_queue`, Stripe atomic lifecycle RPC support).
- Notification retry queue remains scheduled via Vercel cron on `/api/cron/notifications`.
- Dashboard modified-email paths compile and lint clean (`npx tsc --noEmit`, targeted `eslint`).

Status legend:

- `PASS`: implemented and operationally usable.
- `PARTIAL`: implemented with reliability/visibility/policy gaps.
- `FAIL`: missing or materially unsafe for production expectations.

## Trigger Matrix

| Trigger | Expected Behavior | Current Behavior | Status | Evidence |
|---|---|---|---|---|
| Onboarding welcome email | New org owner gets welcome email with failure visibility | Route awaits send and returns `welcome_sent` status in response payload | PASS | `velocitypulse-dashboard/src/app/api/onboarding/route.ts:162`, `velocitypulse-dashboard/src/app/api/onboarding/route.ts:179`, `velocitypulse-dashboard/src/lib/emails/lifecycle.ts:12` |
| Trial expiring warning email | Sent once per policy window, with delivery confirmation | Cron checks send result and only writes warning audit marker on successful delivery | PASS | `velocitypulse-dashboard/src/app/api/cron/lifecycle/route.ts:84`, `velocitypulse-dashboard/src/app/api/cron/lifecycle/route.ts:93`, `velocitypulse-dashboard/src/app/api/cron/lifecycle/route.ts:102` |
| Trial expired email | Sent on suspension due to trial expiry | Send result checked and tracked; no durable retry queue on lifecycle sender path itself | PARTIAL | `velocitypulse-dashboard/src/app/api/cron/lifecycle/route.ts:126`, `velocitypulse-dashboard/src/app/api/cron/lifecycle/route.ts:132`, `velocitypulse-dashboard/src/lib/emails/lifecycle.ts:110` |
| Account suspended email (grace period exceeded) | Sent when billing suspension occurs | Send result checked and tracked; no durable retry queue on lifecycle sender path itself | PARTIAL | `velocitypulse-dashboard/src/app/api/cron/lifecycle/route.ts:183`, `velocitypulse-dashboard/src/app/api/cron/lifecycle/route.ts:190`, `velocitypulse-dashboard/src/lib/emails/lifecycle.ts:149` |
| Subscription activated email | Sent after successful checkout lifecycle event | Webhook persists delivery outcomes to `outbound_email_deliveries` | PASS | `velocitypulse-dashboard/src/app/api/webhook/stripe/route.ts:144`, `velocitypulse-dashboard/src/app/api/webhook/stripe/route.ts:699`, `supabase/migrations/016_outbound_email_deliveries.sql:5` |
| Subscription cancelled email | Sent on cancellation lifecycle event | Same durable delivery recording path as other webhook lifecycle emails | PASS | `velocitypulse-dashboard/src/app/api/webhook/stripe/route.ts:144`, `velocitypulse-dashboard/src/app/api/webhook/stripe/route.ts:891`, `supabase/migrations/016_outbound_email_deliveries.sql:5` |
| Payment failed email | Sent to billing contacts on failed invoice | Same durable delivery recording path as other webhook lifecycle emails | PASS | `velocitypulse-dashboard/src/app/api/webhook/stripe/route.ts:144`, `velocitypulse-dashboard/src/app/api/webhook/stripe/route.ts:986`, `supabase/migrations/016_outbound_email_deliveries.sql:5` |
| Refund processed email | Refund lifecycle sends customer communication with policy context | Full/partial refund templates added and invoked via webhook delivery wrapper | PASS | `velocitypulse-dashboard/src/lib/emails/lifecycle.ts:187`, `velocitypulse-dashboard/src/app/api/webhook/stripe/route.ts:370` |
| Dispute opened email | Dispute-created lifecycle sends action-required customer communication | Dedicated template added and invoked from dispute-created branch | PASS | `velocitypulse-dashboard/src/lib/emails/lifecycle.ts:210`, `velocitypulse-dashboard/src/app/api/webhook/stripe/route.ts:517` |
| Dispute closed email | Dispute-closed lifecycle sends final-outcome communication | Dedicated template added and invoked from dispute-closed branch | PASS | `velocitypulse-dashboard/src/lib/emails/lifecycle.ts:229`, `velocitypulse-dashboard/src/app/api/webhook/stripe/route.ts:532` |
| Member invitation email | Invite email should be guaranteed/visible before reporting invite sent | Route blocks success and rolls back invite when send fails | PASS | `velocitypulse-dashboard/src/app/api/dashboard/members/route.ts:325`, `velocitypulse-dashboard/src/app/api/dashboard/members/route.ts:339`, `velocitypulse-dashboard/src/lib/emails/lifecycle.ts:287` |
| Member invitation resend email | Resend should fail if email send fails | Route returns explicit error when resend delivery fails | PASS | `velocitypulse-dashboard/src/app/api/dashboard/invitations/[id]/resend/route.ts:93`, `velocitypulse-dashboard/src/app/api/dashboard/invitations/[id]/resend/route.ts:109` |
| Member added notification email | Existing user added directly should receive notification | Route captures send result and surfaces `notification_email_sent` flag, but still allows member-add success when email fails | PARTIAL | `velocitypulse-dashboard/src/app/api/dashboard/members/route.ts:255`, `velocitypulse-dashboard/src/app/api/dashboard/members/route.ts:286`, `velocitypulse-dashboard/src/lib/emails/lifecycle.ts:324` |
| Admin invitation email | Admin invite should be durable and auditable | Route blocks success and removes invitation when email send fails | PASS | `velocitypulse-dashboard/src/app/api/internal/admins/route.ts:224`, `velocitypulse-dashboard/src/app/api/internal/admins/route.ts:238`, `velocitypulse-dashboard/src/lib/emails/lifecycle.ts:303` |
| Device status alert notifications | Event -> matching rules -> channel sends -> history log | Existing implementation remains in place | PASS | `velocitypulse-dashboard/src/app/api/agent/devices/status/route.ts:136`, `velocitypulse-dashboard/src/lib/notifications/service.ts:31`, `velocitypulse-dashboard/src/lib/notifications/service.ts:290` |
| Agent offline/online notifications | Agent events emitted when agent status changes | Producers implemented on heartbeat transition (`online`) and lifecycle cron (`offline`) with persistent transition state | PASS | `velocitypulse-dashboard/src/lib/api/agent-auth.ts:92`, `velocitypulse-dashboard/src/app/api/cron/lifecycle/route.ts:225`, `supabase/migrations/015_agent_notification_state.sql:5` |
| Scan complete notifications | Event emitted on scan completion | Producer triggers `scan.complete` after discovery ingestion | PASS | `velocitypulse-dashboard/src/app/api/agent/devices/discovered/route.ts:139`, `velocitypulse-dashboard/src/lib/notifications/service.ts:553` |
| Notification channel config validation | Strong schema validation for create/update per channel type | Create/update routes validate and normalize config per channel type | PASS | `velocitypulse-dashboard/src/lib/notifications/channel-validation.ts:42`, `velocitypulse-dashboard/src/app/api/notifications/channels/route.ts:81`, `velocitypulse-dashboard/src/app/api/notifications/channels/[channelId]/route.ts:92` |
| Notification send retry/fallback | Retries/backoff/dead-letter for transient provider failures | In-process retries plus DB-backed retry queue and dead-letter processing implemented | PASS | `velocitypulse-dashboard/src/lib/notifications/service.ts:13`, `velocitypulse-dashboard/src/lib/notifications/service.ts:309`, `velocitypulse-dashboard/src/lib/notifications/service.ts:377`, `velocitypulse-dashboard/src/app/api/cron/notifications/route.ts:30`, `supabase/migrations/017_notification_retry_queue.sql:5`, `velocitypulse-dashboard/vercel.json:20` |
| Marketing contact form delivery | Success only when at least one durable sink succeeds | API fails when all configured sinks fail and returns degraded flag on partial success | PASS | `velocitypulse-web/lib/form-delivery.ts:62`, `velocitypulse-web/app/api/contact/route.ts:27`, `velocitypulse-web/app/api/contact/route.ts:42` |
| Marketing partner form delivery | Same durability contract as contact form | Same sink-success contract as contact flow | PASS | `velocitypulse-web/lib/form-delivery.ts:85`, `velocitypulse-web/app/api/partners/route.ts:40`, `velocitypulse-web/app/api/partners/route.ts:68` |
| Marketing email provider error handling | Resend non-2xx should be detected and surfaced | Resend HTTP failures now set explicit sink-level errors | PASS | `velocitypulse-web/lib/form-delivery.ts:147`, `velocitypulse-web/lib/form-delivery.ts:209` |
| Marketing form abuse control | API POST endpoints rate-limited in production architecture | Middleware supports Upstash Redis distributed counters with local fallback for non-configured environments | PASS | `velocitypulse-web/middleware.ts:49`, `velocitypulse-web/middleware.ts:68`, `velocitypulse-web/middleware.ts:150` |

## Priority Findings

## P2

### 1. Some lifecycle/member email paths still use degraded semantics rather than strict delivery guarantees

Why this matters:

- Operational visibility exists, but several non-invitation paths remain best-effort and policy-dependent.

Evidence:

- `velocitypulse-dashboard/src/app/api/cron/lifecycle/route.ts:126`
- `velocitypulse-dashboard/src/app/api/cron/lifecycle/route.ts:183`
- `velocitypulse-dashboard/src/app/api/dashboard/members/route.ts:286`

## Commercial Readiness Verdict (Email/Notifications)

Current status: **Materially improved; no open P1 blockers in this matrix.**

Remaining launch-relevant work:

1. Decide policy for strict-vs-degraded behavior on non-invitation lifecycle/member notification emails.

## Delta Since Previous Pass

Closed in this pass:

1. Missing refund/dispute lifecycle customer communication templates.
2. Missing webhook invocation coverage for refund/dispute customer comms.

Still open:

1. Policy tightening for best-effort lifecycle/member non-invitation emails.
