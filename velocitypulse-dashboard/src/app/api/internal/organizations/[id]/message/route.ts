import { NextRequest, NextResponse } from 'next/server'
import { verifyInternalAccess, hasAdminRole } from '@/lib/api/internal-auth'
import { createServiceClient } from '@/lib/db/client'

const FROM_EMAIL = process.env.RESEND_FROM_EMAIL || 'VelocityPulse <no-reply@velocitypulse.io>'

/**
 * POST /api/internal/organizations/[id]/message
 * Send a message to the organization owner via email
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { authorized, userId, adminRole, error } = await verifyInternalAccess()
  if (!authorized) return error

  if (!hasAdminRole(adminRole, 'support_admin')) {
    return NextResponse.json(
      { error: 'Insufficient admin role' },
      { status: 403 }
    )
  }

  try {
    const { id } = await params

    let body: { subject: string; message: string }
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
    }

    if (!body.subject?.trim() || !body.message?.trim()) {
      return NextResponse.json(
        { error: 'Subject and message are required' },
        { status: 400 }
      )
    }

    const supabase = createServiceClient()

    // Get organization
    const { data: org, error: orgError } = await supabase
      .from('organizations')
      .select('id, name')
      .eq('id', id)
      .single()

    if (orgError || !org) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 })
    }

    // Get owner email via organization_members + users table
    const { data: ownerMember } = await supabase
      .from('organization_members')
      .select('user_id')
      .eq('organization_id', id)
      .eq('role', 'owner')
      .limit(1)
      .single()

    if (!ownerMember) {
      return NextResponse.json({ error: 'Organization owner not found' }, { status: 404 })
    }

    const { data: ownerUser } = await supabase
      .from('users')
      .select('email')
      .eq('id', ownerMember.user_id)
      .single()

    if (!ownerUser?.email) {
      return NextResponse.json({ error: 'Owner email not found' }, { status: 404 })
    }

    // Send email via Resend
    const apiKey = process.env.RESEND_API_KEY
    if (!apiKey) {
      return NextResponse.json({ error: 'Email service not configured' }, { status: 500 })
    }

    const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 20px; background-color: #f5f5f5;">
  <div style="max-width: 600px; margin: 0 auto; background-color: white; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
    <div style="background-color: #2563eb; padding: 20px; color: white;">
      <h1 style="margin: 0; font-size: 20px;">Message from VelocityPulse</h1>
    </div>
    <div style="padding: 20px;">
      <p>Hi,</p>
      <p>This is a message regarding your organization <strong>${org.name}</strong>:</p>
      <div style="background: #f8fafc; border-left: 4px solid #2563eb; padding: 16px; margin: 16px 0; border-radius: 0 4px 4px 0;">
        ${body.message.replace(/\n/g, '<br>')}
      </div>
      <p style="color: #666; font-size: 14px; margin-top: 24px;">
        If you have questions, reply to this email or contact us at
        <a href="mailto:support@velocitypulse.io" style="color: #2563eb;">support@velocitypulse.io</a>.
      </p>
    </div>
    <div style="padding: 15px 20px; background-color: #f9f9f9; border-top: 1px solid #eee; font-size: 12px; color: #666;">
      Sent by <a href="https://velocitypulse.io" style="color: #2563eb; text-decoration: none;">VelocityPulse</a>
    </div>
  </div>
</body>
</html>`

    const emailRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: FROM_EMAIL,
        to: [ownerUser.email],
        subject: body.subject.trim(),
        html,
      }),
    })

    if (!emailRes.ok) {
      const text = await emailRes.text()
      console.error('[SendMessage] Resend API error:', emailRes.status, text)
      return NextResponse.json({ error: 'Failed to send email' }, { status: 500 })
    }

    // Audit log
    await supabase.from('audit_logs').insert({
      organization_id: id,
      actor_type: 'user',
      actor_id: userId,
      action: 'organization.message_sent',
      resource_type: 'organization',
      resource_id: id,
      metadata: { subject: body.subject.trim(), recipient: ownerUser.email },
    })

    return NextResponse.json({
      success: true,
      message: `Email sent to ${ownerUser.email}`,
    })
  } catch (error) {
    console.error('Send message error:', error)
    return NextResponse.json({ error: 'Failed to send message' }, { status: 500 })
  }
}
