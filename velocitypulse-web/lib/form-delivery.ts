import { isResendConfigured, isSupabaseConfigured, isDevelopment } from './env'

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

/**
 * Deliver a contact form submission via email and Supabase
 */
export async function deliverContactForm(data: ContactSubmission): Promise<void> {
  const results = await Promise.allSettled([
    emailContactForm(data),
    storeContactForm(data),
  ])

  for (const result of results) {
    if (result.status === 'rejected') {
      console.error('[FormDelivery] Contact form delivery error:', result.reason)
    }
  }
}

/**
 * Deliver a partner form submission via email and Supabase
 */
export async function deliverPartnerForm(data: PartnerSubmission): Promise<void> {
  const results = await Promise.allSettled([
    emailPartnerForm(data),
    storePartnerForm(data),
  ])

  for (const result of results) {
    if (result.status === 'rejected') {
      console.error('[FormDelivery] Partner form delivery error:', result.reason)
    }
  }
}

// --- Email delivery via Resend ---

async function emailContactForm(data: ContactSubmission): Promise<void> {
  if (!isResendConfigured()) {
    if (isDevelopment()) console.log('[FormDelivery] Resend not configured, skipping email')
    return
  }

  const teamEmail = process.env.RESEND_TEAM_EMAIL || 'sales@velocitypulse.io'
  const fromEmail = process.env.RESEND_FROM_EMAIL || 'VelocityPulse <noreply@velocitypulse.io>'

  await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
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
}

async function emailPartnerForm(data: PartnerSubmission): Promise<void> {
  if (!isResendConfigured()) {
    if (isDevelopment()) console.log('[FormDelivery] Resend not configured, skipping email')
    return
  }

  const teamEmail = process.env.RESEND_TEAM_EMAIL || 'partners@velocitypulse.io'
  const fromEmail = process.env.RESEND_FROM_EMAIL || 'VelocityPulse <noreply@velocitypulse.io>'

  await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
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

async function storeContactForm(data: ContactSubmission): Promise<void> {
  const supabase = await getSupabaseClient()
  if (!supabase) {
    if (isDevelopment()) console.log('[FormDelivery] Supabase not configured, skipping storage')
    return
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
    console.error('[FormDelivery] Supabase insert error:', error.message)
  }
}

async function storePartnerForm(data: PartnerSubmission): Promise<void> {
  const supabase = await getSupabaseClient()
  if (!supabase) {
    if (isDevelopment()) console.log('[FormDelivery] Supabase not configured, skipping storage')
    return
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
    console.error('[FormDelivery] Supabase insert error:', error.message)
  }
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}
