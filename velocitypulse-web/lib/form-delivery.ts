import { isResendConfigured, isSupabaseConfigured, isZohoConfigured, isDevelopment } from './env'
import { createContactFormTicket, createPartnerApplicationTicket } from './zoho'

interface ContactSubmission {
  name: string
  email: string
  organization?: string
  subject: string
  message: string
}

interface PartnerSubmission {
  companyName: string
  website?: string
  contactName: string
  email: string
  phone?: string
  country: string
  clientCount: string
  avgDevices: string
  tierPreference: string
  whiteLabel: string
  taxId?: string
  businessDescription?: string
}

type DeliverySink = 'email' | 'storage' | 'zoho'

interface DeliverySinkResult {
  sink: DeliverySink
  configured: boolean
  success: boolean
  error?: string
}

export interface FormDeliveryResult {
  success: boolean
  configured_sinks: number
  successful_sinks: number
  failed_sinks: number
  sinks: DeliverySinkResult[]
}

function summarizeDeliveryResults(sinks: DeliverySinkResult[]): FormDeliveryResult {
  const configured = sinks.filter((result) => result.configured)
  const successful = configured.filter((result) => result.success)
  const failed = configured.filter((result) => !result.success)

  return {
    success: successful.length > 0,
    configured_sinks: configured.length,
    successful_sinks: successful.length,
    failed_sinks: failed.length,
    sinks,
  }
}

/**
 * Deliver a contact form submission via email and Supabase/Zoho.
 * Success requires at least one configured sink to succeed.
 */
export async function deliverContactForm(data: ContactSubmission): Promise<FormDeliveryResult> {
  const results = await Promise.all([
    emailContactForm(data),
    storeContactForm(data),
    zohoContactTicket(data),
  ])

  for (const result of results) {
    if (result.configured && !result.success) {
      console.error('[FormDelivery] Contact form delivery error:', {
        sink: result.sink,
        error: result.error,
      })
    }
  }

  return summarizeDeliveryResults(results)
}

/**
 * Deliver a partner form submission via email and Supabase/Zoho.
 * Success requires at least one configured sink to succeed.
 */
export async function deliverPartnerForm(data: PartnerSubmission): Promise<FormDeliveryResult> {
  const results = await Promise.all([
    emailPartnerForm(data),
    storePartnerForm(data),
    zohoPartnerTicket(data),
  ])

  for (const result of results) {
    if (result.configured && !result.success) {
      console.error('[FormDelivery] Partner form delivery error:', {
        sink: result.sink,
        error: result.error,
      })
    }
  }

  return summarizeDeliveryResults(results)
}

// --- Email delivery via Resend ---

async function emailContactForm(data: ContactSubmission): Promise<DeliverySinkResult> {
  if (!isResendConfigured()) {
    if (isDevelopment()) console.log('[FormDelivery] Resend not configured, skipping email')
    return { sink: 'email', configured: false, success: false }
  }

  const teamEmail = process.env.RESEND_TEAM_EMAIL || 'sales@velocitypulse.io'
  const fromEmail = process.env.RESEND_FROM_EMAIL || 'VelocityPulse <noreply@velocitypulse.io>'

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: fromEmail,
        to: [teamEmail],
        subject: `[Contact Form] ${data.subject} - ${data.name}`,
        html: `
<h2>New Contact Form Submission</h2>
<table style="border-collapse: collapse; width: 100%;">
  <tr><td style="padding: 8px; font-weight: bold;">Name:</td><td style="padding: 8px;">${escapeHtml(data.name)}</td></tr>
  <tr><td style="padding: 8px; font-weight: bold;">Email:</td><td style="padding: 8px;"><a href="mailto:${escapeHtml(data.email)}">${escapeHtml(data.email)}</a></td></tr>
  ${data.organization ? `<tr><td style="padding: 8px; font-weight: bold;">Organization:</td><td style="padding: 8px;">${escapeHtml(data.organization)}</td></tr>` : ''}
  <tr><td style="padding: 8px; font-weight: bold;">Subject:</td><td style="padding: 8px;">${escapeHtml(data.subject)}</td></tr>
</table>
<h3>Message</h3>
<p style="white-space: pre-wrap;">${escapeHtml(data.message)}</p>
<hr>
<p style="color: #666; font-size: 12px;">Submitted at ${new Date().toISOString()}</p>`,
      }),
    })

    if (!response.ok) {
      const body = await response.text()
      return {
        sink: 'email',
        configured: true,
        success: false,
        error: `Resend API returned ${response.status}: ${body}`,
      }
    }

    return { sink: 'email', configured: true, success: true }
  } catch (error) {
    return {
      sink: 'email',
      configured: true,
      success: false,
      error: error instanceof Error ? error.message : 'Unknown email error',
    }
  }
}

async function emailPartnerForm(data: PartnerSubmission): Promise<DeliverySinkResult> {
  if (!isResendConfigured()) {
    if (isDevelopment()) console.log('[FormDelivery] Resend not configured, skipping email')
    return { sink: 'email', configured: false, success: false }
  }

  const teamEmail = process.env.RESEND_TEAM_EMAIL || 'partners@velocitypulse.io'
  const fromEmail = process.env.RESEND_FROM_EMAIL || 'VelocityPulse <noreply@velocitypulse.io>'

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: fromEmail,
        to: [teamEmail],
        subject: `[Partner Application] ${data.companyName}`,
        html: `
<h2>New Partner Application</h2>
<table style="border-collapse: collapse; width: 100%;">
  <tr><td style="padding: 8px; font-weight: bold;">Company:</td><td style="padding: 8px;">${escapeHtml(data.companyName)}</td></tr>
  ${data.website ? `<tr><td style="padding: 8px; font-weight: bold;">Website:</td><td style="padding: 8px;"><a href="${escapeHtml(data.website)}">${escapeHtml(data.website)}</a></td></tr>` : ''}
  <tr><td style="padding: 8px; font-weight: bold;">Contact:</td><td style="padding: 8px;">${escapeHtml(data.contactName)}</td></tr>
  <tr><td style="padding: 8px; font-weight: bold;">Email:</td><td style="padding: 8px;"><a href="mailto:${escapeHtml(data.email)}">${escapeHtml(data.email)}</a></td></tr>
  ${data.phone ? `<tr><td style="padding: 8px; font-weight: bold;">Phone:</td><td style="padding: 8px;">${escapeHtml(data.phone)}</td></tr>` : ''}
  <tr><td style="padding: 8px; font-weight: bold;">Country:</td><td style="padding: 8px;">${escapeHtml(data.country)}</td></tr>
  <tr><td style="padding: 8px; font-weight: bold;">Clients:</td><td style="padding: 8px;">${escapeHtml(data.clientCount)}</td></tr>
  <tr><td style="padding: 8px; font-weight: bold;">Avg Devices:</td><td style="padding: 8px;">${escapeHtml(data.avgDevices)}</td></tr>
  <tr><td style="padding: 8px; font-weight: bold;">Tier:</td><td style="padding: 8px;">${escapeHtml(data.tierPreference)}</td></tr>
  <tr><td style="padding: 8px; font-weight: bold;">White-label:</td><td style="padding: 8px;">${escapeHtml(data.whiteLabel)}</td></tr>
  ${data.taxId ? `<tr><td style="padding: 8px; font-weight: bold;">Tax ID:</td><td style="padding: 8px;">${escapeHtml(data.taxId)}</td></tr>` : ''}
</table>
${data.businessDescription ? `<h3>Business Description</h3><p style="white-space: pre-wrap;">${escapeHtml(data.businessDescription)}</p>` : ''}
<hr>
<p style="color: #666; font-size: 12px;">Submitted at ${new Date().toISOString()}</p>`,
      }),
    })

    if (!response.ok) {
      const body = await response.text()
      return {
        sink: 'email',
        configured: true,
        success: false,
        error: `Resend API returned ${response.status}: ${body}`,
      }
    }

    return { sink: 'email', configured: true, success: true }
  } catch (error) {
    return {
      sink: 'email',
      configured: true,
      success: false,
      error: error instanceof Error ? error.message : 'Unknown email error',
    }
  }
}

// --- Supabase storage ---

async function getSupabaseClient() {
  if (!isSupabaseConfigured()) return null

  const { createClient } = await import('@supabase/supabase-js')
  return createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

async function storeContactForm(data: ContactSubmission): Promise<DeliverySinkResult> {
  const supabase = await getSupabaseClient()
  if (!supabase) {
    if (isDevelopment()) console.log('[FormDelivery] Supabase not configured, skipping storage')
    return { sink: 'storage', configured: false, success: false }
  }

  const { error } = await supabase.from('form_submissions').insert({
    form_type: 'contact',
    name: data.name,
    email: data.email,
    organization: data.organization || null,
    subject: data.subject,
    message: data.message,
  })

  if (error) {
    return {
      sink: 'storage',
      configured: true,
      success: false,
      error: error.message,
    }
  }

  return { sink: 'storage', configured: true, success: true }
}

async function storePartnerForm(data: PartnerSubmission): Promise<DeliverySinkResult> {
  const supabase = await getSupabaseClient()
  if (!supabase) {
    if (isDevelopment()) console.log('[FormDelivery] Supabase not configured, skipping storage')
    return { sink: 'storage', configured: false, success: false }
  }

  const { error } = await supabase.from('form_submissions').insert({
    form_type: 'partner',
    name: data.contactName,
    email: data.email,
    organization: data.companyName,
    subject: `Partner Application - ${data.companyName}`,
    metadata: {
      website: data.website,
      phone: data.phone,
      country: data.country,
      clientCount: data.clientCount,
      avgDevices: data.avgDevices,
      tierPreference: data.tierPreference,
      whiteLabel: data.whiteLabel,
      taxId: data.taxId,
      businessDescription: data.businessDescription,
    },
  })

  if (error) {
    return {
      sink: 'storage',
      configured: true,
      success: false,
      error: error.message,
    }
  }

  return { sink: 'storage', configured: true, success: true }
}

// --- Zoho ticket creation ---

async function zohoContactTicket(data: ContactSubmission): Promise<DeliverySinkResult> {
  if (!isZohoConfigured()) {
    if (isDevelopment()) console.log('[FormDelivery] Zoho not configured, skipping ticket')
    return { sink: 'zoho', configured: false, success: false }
  }

  try {
    await createContactFormTicket({
      name: data.name,
      email: data.email,
      organization: data.organization,
      subject: data.subject,
      message: data.message,
    })
    return { sink: 'zoho', configured: true, success: true }
  } catch (error) {
    return {
      sink: 'zoho',
      configured: true,
      success: false,
      error: error instanceof Error ? error.message : 'Unknown Zoho error',
    }
  }
}

async function zohoPartnerTicket(data: PartnerSubmission): Promise<DeliverySinkResult> {
  if (!isZohoConfigured()) {
    if (isDevelopment()) console.log('[FormDelivery] Zoho not configured, skipping ticket')
    return { sink: 'zoho', configured: false, success: false }
  }

  try {
    await createPartnerApplicationTicket({
      companyName: data.companyName,
      contactName: data.contactName,
      email: data.email,
      phone: data.phone,
      country: data.country,
      website: data.website,
      clientCount: data.clientCount,
      avgDevices: data.avgDevices,
      tierPreference: data.tierPreference,
      whiteLabel: data.whiteLabel,
      taxId: data.taxId,
      businessDescription: data.businessDescription,
    })
    return { sink: 'zoho', configured: true, success: true }
  } catch (error) {
    return {
      sink: 'zoho',
      configured: true,
      success: false,
      error: error instanceof Error ? error.message : 'Unknown Zoho error',
    }
  }
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}
