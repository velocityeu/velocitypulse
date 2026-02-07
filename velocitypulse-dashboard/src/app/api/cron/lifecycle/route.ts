import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/db/client'
import { GRACE_PERIODS } from '@/lib/constants'
import { logger } from '@/lib/logger'
import {
  sendTrialExpiringEmail,
  sendTrialExpiredEmail,
  sendAccountSuspendedEmail,
} from '@/lib/emails/lifecycle'

export const runtime = 'nodejs'

/**
 * Lifecycle cron job - runs every 6 hours via Vercel Cron.
 * Protected by CRON_SECRET or Vercel's automatic cron auth header.
 */
export async function GET(request: NextRequest) {
  // Verify cron secret
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createServiceClient()
  const results = {
    warnings_sent: 0,
    trials_expired: 0,
    orgs_suspended: 0,
    orgs_purged: 0,
    audit_logs_pruned: 0,
    usage_records_pruned: 0,
  }

  try {
    // ===== Job 1: Trial Warning (3 days before expiry) =====
    const threeDaysFromNow = new Date()
    threeDaysFromNow.setDate(threeDaysFromNow.getDate() + 3)

    const { data: warningOrgs } = await supabase
      .from('organizations')
      .select('id, name, trial_ends_at')
      .eq('status', 'trial')
      .gte('trial_ends_at', new Date().toISOString())
      .lte('trial_ends_at', threeDaysFromNow.toISOString())

    for (const org of warningOrgs ?? []) {
      // Check if warning was already sent in last 3 days
      const threeDaysAgo = new Date()
      threeDaysAgo.setDate(threeDaysAgo.getDate() - 3)

      const { data: existingWarning } = await supabase
        .from('audit_logs')
        .select('id')
        .eq('organization_id', org.id)
        .eq('action', 'organization.trial_warning_sent')
        .gte('created_at', threeDaysAgo.toISOString())
        .limit(1)

      if (existingWarning && existingWarning.length > 0) continue

      // Get owner/admin emails
      const recipients = await getOrgRecipients(supabase, org.id)
      if (recipients.length === 0) continue

      const daysLeft = Math.max(1, Math.ceil(
        (new Date(org.trial_ends_at!).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
      ))

      await sendTrialExpiringEmail(org.name, daysLeft, recipients)

      await supabase.from('audit_logs').insert({
        organization_id: org.id,
        actor_type: 'system',
        actor_id: 'cron-lifecycle',
        action: 'organization.trial_warning_sent',
        resource_type: 'organization',
        resource_id: org.id,
        metadata: { days_left: daysLeft },
      })

      results.warnings_sent++
    }

    // ===== Job 2: Trial Expiry =====
    const { data: expiredTrials } = await supabase
      .from('organizations')
      .select('id, name')
      .eq('status', 'trial')
      .lt('trial_ends_at', new Date().toISOString())

    for (const org of expiredTrials ?? []) {
      await supabase
        .from('organizations')
        .update({
          status: 'suspended',
          suspended_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', org.id)

      const recipients = await getOrgRecipients(supabase, org.id)
      if (recipients.length > 0) {
        await sendTrialExpiredEmail(org.name, recipients)
      }

      await supabase.from('audit_logs').insert({
        organization_id: org.id,
        actor_type: 'system',
        actor_id: 'cron-lifecycle',
        action: 'organization.suspended',
        resource_type: 'organization',
        resource_id: org.id,
        metadata: { reason: 'trial_expired' },
      })

      results.trials_expired++
    }

    // ===== Job 3: Grace Period Enforcement (7 days after payment failure) =====
    const gracePeriodThreshold = new Date()
    gracePeriodThreshold.setDate(gracePeriodThreshold.getDate() - GRACE_PERIODS.paymentFailed)

    const { data: pastDueOrgs } = await supabase
      .from('organizations')
      .select('id, name')
      .eq('status', 'past_due')

    for (const org of pastDueOrgs ?? []) {
      // Check when the org became past_due via audit logs
      const { data: pastDueLog } = await supabase
        .from('audit_logs')
        .select('created_at')
        .eq('organization_id', org.id)
        .eq('action', 'subscription.payment_failed')
        .order('created_at', { ascending: false })
        .limit(1)
        .single()

      if (!pastDueLog) continue
      if (new Date(pastDueLog.created_at) > gracePeriodThreshold) continue

      await supabase
        .from('organizations')
        .update({
          status: 'suspended',
          suspended_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', org.id)

      const recipients = await getOrgRecipients(supabase, org.id)
      if (recipients.length > 0) {
        await sendAccountSuspendedEmail(org.name, 'grace_period_exceeded', recipients)
      }

      await supabase.from('audit_logs').insert({
        organization_id: org.id,
        actor_type: 'system',
        actor_id: 'cron-lifecycle',
        action: 'organization.suspended',
        resource_type: 'organization',
        resource_id: org.id,
        metadata: { reason: 'grace_period_exceeded' },
      })

      results.orgs_suspended++
    }

    // ===== Job 4: Data Retention Cleanup (30 days after cancellation) =====
    const retentionThreshold = new Date()
    retentionThreshold.setDate(retentionThreshold.getDate() - GRACE_PERIODS.dataRetention)

    const { data: purgeOrgs } = await supabase
      .from('organizations')
      .select('id, name')
      .eq('status', 'cancelled')
      .lt('cancelled_at', retentionThreshold.toISOString())

    for (const org of purgeOrgs ?? []) {
      // Log purge before deleting (audit logs will be deleted too)
      console.log(`[Lifecycle] Purging data for org ${org.id} (${org.name})`)

      // Cascade delete (same order as admin delete action)
      await supabase.from('audit_logs').delete().eq('organization_id', org.id)
      await supabase.from('agent_commands').delete().eq('organization_id', org.id)
      await supabase.from('devices').delete().eq('organization_id', org.id)
      await supabase.from('agents').delete().eq('organization_id', org.id)
      await supabase.from('network_segments').delete().eq('organization_id', org.id)
      await supabase.from('subscriptions').delete().eq('organization_id', org.id)
      await supabase.from('organization_members').delete().eq('organization_id', org.id)
      await supabase.from('organizations').delete().eq('id', org.id)

      results.orgs_purged++
    }

    // ===== Job 5: Prune Old Audit Logs (365 days retention) =====
    try {
      const { data: auditPruneCount } = await supabase.rpc('prune_audit_logs', { retention_days: 365 })
      results.audit_logs_pruned = auditPruneCount ?? 0
    } catch (pruneError) {
      logger.error('[Lifecycle] Audit log pruning failed', pruneError, { route: 'api/cron/lifecycle' })
    }

    // ===== Job 6: Prune Old Hourly API Usage Records (7 days) =====
    try {
      const { data: usagePruneCount } = await supabase.rpc('prune_api_usage')
      results.usage_records_pruned = usagePruneCount ?? 0
    } catch (pruneError) {
      logger.error('[Lifecycle] API usage pruning failed', pruneError, { route: 'api/cron/lifecycle' })
    }

    return NextResponse.json(results)
  } catch (error) {
    logger.error('[Lifecycle] Cron error', error, { route: 'api/cron/lifecycle' })
    return NextResponse.json(
      { error: 'Lifecycle cron failed', partial_results: results },
      { status: 500 }
    )
  }
}

/**
 * Get email addresses of owners and admins for an organization.
 * Joins organization_members with users table to resolve emails.
 */
async function getOrgRecipients(
  supabase: ReturnType<typeof createServiceClient>,
  orgId: string
): Promise<string[]> {
  const { data: members } = await supabase
    .from('organization_members')
    .select('user_id, role')
    .eq('organization_id', orgId)
    .in('role', ['owner', 'admin'])

  if (!members || members.length === 0) return []

  const userIds = members.map(m => m.user_id)
  const { data: users } = await supabase
    .from('users')
    .select('email')
    .in('id', userIds)

  return users?.map(u => u.email).filter(Boolean) ?? []
}
