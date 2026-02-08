import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { verifyInternalAccess } from '@/lib/api/internal-auth'
import { supabase, getAdminClient } from '@/lib/db/client'

// Lazy Stripe initialization (same pattern as webhook/checkout routes)
let stripe: Stripe | null = null
function getStripe(): Stripe {
  if (!stripe) {
    const apiKey = process.env.STRIPE_SECRET_KEY
    if (!apiKey) {
      throw new Error('STRIPE_SECRET_KEY is not configured')
    }
    stripe = new Stripe(apiKey, {
      apiVersion: '2026-01-28.clover',
      maxNetworkRetries: 3,
      timeout: 30000,
    })
  }
  return stripe
}

type ActionType =
  | 'extend_trial'
  | 'suspend'
  | 'reactivate'
  | 'cancel'
  | 'delete'
  | 'reset_api_keys'
  | 'export_data'

interface ActionPayload {
  action: ActionType
  days?: number // for extend_trial
  reason?: string
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { authorized, userId, error } = await verifyInternalAccess()
  if (!authorized) return error

  try {
    const { id } = await params
    const body: ActionPayload = await request.json()
    const { action, days, reason } = body

    // Get organization
    const { data: org, error: orgError } = await supabase
      .from('organizations')
      .select('*')
      .eq('id', id)
      .single()

    if (orgError || !org) {
      return NextResponse.json(
        { error: 'Organization not found' },
        { status: 404 }
      )
    }

    let updateData: Record<string, unknown> = {}
    let auditAction = ''

    switch (action) {
      case 'extend_trial': {
        if (org.status !== 'trial') {
          return NextResponse.json(
            { error: 'Organization is not in trial status' },
            { status: 400 }
          )
        }
        const extensionDays = days || 7
        const currentEnd = org.trial_ends_at ? new Date(org.trial_ends_at) : new Date()
        currentEnd.setDate(currentEnd.getDate() + extensionDays)
        updateData = { trial_ends_at: currentEnd.toISOString() }
        auditAction = 'organization.trial_extended'
        break
      }

      case 'suspend': {
        if (org.status === 'suspended') {
          return NextResponse.json(
            { error: 'Organization is already suspended' },
            { status: 400 }
          )
        }
        updateData = {
          status: 'suspended',
          suspended_at: new Date().toISOString(),
        }
        auditAction = 'organization.suspended'
        break
      }

      case 'reactivate': {
        if (org.status !== 'suspended') {
          return NextResponse.json(
            { error: 'Organization is not suspended' },
            { status: 400 }
          )
        }
        // Determine the status to reactivate to
        const newStatus = org.stripe_subscription_id ? 'active' : 'trial'
        updateData = {
          status: newStatus,
          suspended_at: null,
        }
        // If reactivating to trial, extend the trial by 7 days
        if (newStatus === 'trial') {
          const newTrialEnd = new Date()
          newTrialEnd.setDate(newTrialEnd.getDate() + 7)
          updateData.trial_ends_at = newTrialEnd.toISOString()
        }
        auditAction = 'organization.reactivated'
        break
      }

      case 'cancel': {
        if (org.status === 'cancelled') {
          return NextResponse.json(
            { error: 'Organization is already cancelled' },
            { status: 400 }
          )
        }
        // Cancel Stripe subscription if one exists
        if (org.stripe_subscription_id) {
          try {
            await getStripe().subscriptions.cancel(org.stripe_subscription_id)
          } catch (stripeError) {
            console.error('Failed to cancel Stripe subscription:', stripeError)
            // Continue with org cancellation even if Stripe fails -
            // the subscription.deleted webhook will handle cleanup
          }
        }

        updateData = {
          status: 'cancelled',
          cancelled_at: new Date().toISOString(),
        }
        auditAction = 'organization.cancelled'
        break
      }

      case 'delete': {
        if (org.status !== 'cancelled') {
          return NextResponse.json(
            { error: 'Organization must be cancelled before deletion' },
            { status: 400 }
          )
        }

        // Cancel any remaining Stripe resources
        if (org.stripe_subscription_id) {
          try {
            await getStripe().subscriptions.cancel(org.stripe_subscription_id)
          } catch {
            // Already cancelled or doesn't exist — continue
          }
        }
        if (org.stripe_customer_id) {
          try {
            // Void open invoices
            const invoices = await getStripe().invoices.list({
              customer: org.stripe_customer_id,
              status: 'open',
              limit: 100,
            })
            await Promise.allSettled(
              invoices.data.map(inv => getStripe().invoices.voidInvoice(inv.id))
            )
          } catch {
            // Non-fatal — continue with deletion
          }
        }

        // Delete Supabase Storage branding files (if org has custom branding)
        if (org.custom_branding) {
          try {
            const adminClient = getAdminClient()
            const { data: files } = await adminClient.storage
              .from('branding')
              .list(id)
            if (files && files.length > 0) {
              await adminClient.storage
                .from('branding')
                .remove(files.map(f => `${id}/${f.name}`))
            }
          } catch {
            // Non-fatal — continue with deletion
          }
        }

        // Delete organization and ALL related data (FK-safe order)
        // 1. Notification-related tables
        await supabase.from('notification_cooldowns').delete().eq('organization_id', id)
        await supabase.from('notification_history').delete().eq('organization_id', id)
        await supabase.from('notification_rules').delete().eq('organization_id', id)
        await supabase.from('notification_channels').delete().eq('organization_id', id)

        // 2. Device status history (via device IDs)
        const { data: orgDevices } = await supabase
          .from('devices')
          .select('id')
          .eq('organization_id', id)
        if (orgDevices && orgDevices.length > 0) {
          const deviceIds = orgDevices.map(d => d.id)
          await supabase.from('device_status_history').delete().in('device_id', deviceIds)
        }

        // 3. API usage tracking
        await supabase.from('api_usage_monthly').delete().eq('organization_id', id)
        await supabase.from('api_usage_hourly').delete().eq('organization_id', id)

        // 4. Support tickets and comments
        const { data: tickets } = await supabase
          .from('support_tickets')
          .select('id')
          .eq('organization_id', id)
        if (tickets && tickets.length > 0) {
          const ticketIds = tickets.map(t => t.id)
          await supabase.from('ticket_comments').delete().in('ticket_id', ticketIds)
        }
        await supabase.from('support_tickets').delete().eq('organization_id', id)

        // 5. Admin audit logs — SET NULL instead of delete (preserve admin trail)
        await supabase
          .from('admin_audit_logs')
          .update({ organization_id: null })
          .eq('organization_id', id)

        // 6. Invitations
        await supabase.from('invitations').delete().eq('organization_id', id)

        // 7. Original tables (existing cleanup)
        await supabase.from('audit_logs').delete().eq('organization_id', id)
        await supabase.from('agent_commands').delete().eq('organization_id', id)
        await supabase.from('devices').delete().eq('organization_id', id)
        await supabase.from('agents').delete().eq('organization_id', id)
        await supabase.from('network_segments').delete().eq('organization_id', id)
        await supabase.from('subscriptions').delete().eq('organization_id', id)
        await supabase.from('organization_members').delete().eq('organization_id', id)
        await supabase.from('organizations').delete().eq('id', id)

        return NextResponse.json({
          success: true,
          message: 'Organization deleted permanently',
        })
      }

      case 'reset_api_keys': {
        // Invalidate all agent API keys by deleting and regenerating
        const { data: agents } = await supabase
          .from('agents')
          .select('id')
          .eq('organization_id', id)

        if (agents && agents.length > 0) {
          // Mark all agents as needing new API keys
          await supabase
            .from('agents')
            .update({
              api_key_hash: null,
              api_key_prefix: null,
              updated_at: new Date().toISOString(),
            })
            .eq('organization_id', id)
        }
        auditAction = 'organization.api_keys_reset'
        break
      }

      case 'export_data': {
        // Generate GDPR data export
        // In production, this would create a job to generate and email the export
        const [orgData, members, devices, agents, auditLogs] = await Promise.all([
          supabase.from('organizations').select('*').eq('id', id).single(),
          supabase.from('organization_members').select('*').eq('organization_id', id),
          supabase.from('devices').select('*').eq('organization_id', id),
          supabase.from('agents').select('id, name, last_seen_at, version, created_at').eq('organization_id', id),
          supabase.from('audit_logs').select('*').eq('organization_id', id),
        ])

        const exportData = {
          exported_at: new Date().toISOString(),
          organization: orgData.data,
          members: members.data,
          devices: devices.data,
          agents: agents.data,
          audit_logs: auditLogs.data,
        }

        // Log the export
        await supabase.from('audit_logs').insert({
          organization_id: id,
          actor_type: 'user',
          actor_id: userId,
          action: 'organization.data_exported',
          resource_type: 'organization',
          resource_id: id,
          metadata: { reason: 'GDPR request' },
        })

        return NextResponse.json({
          success: true,
          export: exportData,
        })
      }

      default:
        return NextResponse.json(
          { error: 'Invalid action' },
          { status: 400 }
        )
    }

    // Update organization if we have update data
    if (Object.keys(updateData).length > 0) {
      updateData.updated_at = new Date().toISOString()

      const { error: updateError } = await supabase
        .from('organizations')
        .update(updateData)
        .eq('id', id)

      if (updateError) throw updateError
    }

    // Log the action
    if (auditAction) {
      await supabase.from('audit_logs').insert({
        organization_id: id,
        actor_type: 'user',
        actor_id: userId,
        action: auditAction,
        resource_type: 'organization',
        resource_id: id,
        metadata: { reason, days },
      })
    }

    return NextResponse.json({
      success: true,
      action,
      message: `Action '${action}' completed successfully`,
    })
  } catch (error) {
    console.error('Failed to perform action:', error)
    return NextResponse.json(
      { error: 'Failed to perform action' },
      { status: 500 }
    )
  }
}
