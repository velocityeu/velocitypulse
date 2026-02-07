// Zoho Help Desk API integration
// Documentation: https://desk.zoho.com/DeskAPIDocument

const ZOHO_BASE_URL = 'https://desk.zoho.com/api/v1'

interface ZohoTicket {
  subject: string
  description: string
  email: string
  contactId?: string
  channel?: string
  classification?: string
  priority?: string
  status?: string
}

interface ZohoConfig {
  accessToken: string
  orgId: string
}

async function getZohoConfig(): Promise<ZohoConfig> {
  // In production, this would fetch from environment or refresh token endpoint
  return {
    accessToken: process.env.ZOHO_ACCESS_TOKEN || '',
    orgId: process.env.ZOHO_ORG_ID || '',
  }
}

export async function createTicket(ticket: ZohoTicket): Promise<{ ticketId: string }> {
  const config = await getZohoConfig()

  const response = await fetch(`${ZOHO_BASE_URL}/tickets`, {
    method: 'POST',
    headers: {
      'Authorization': `Zoho-oauthtoken ${config.accessToken}`,
      'orgId': config.orgId,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      subject: ticket.subject,
      description: ticket.description,
      email: ticket.email,
      contactId: ticket.contactId,
      channel: ticket.channel || 'Web',
      classification: ticket.classification,
      priority: ticket.priority || 'Medium',
      status: ticket.status || 'Open',
    }),
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Failed to create Zoho ticket: ${error}`)
  }

  const data = await response.json()
  return { ticketId: data.id }
}

export async function createContactFormTicket({
  name,
  email,
  organization,
  subject,
  message,
}: {
  name: string
  email: string
  organization?: string
  subject: string
  message: string
}) {
  return createTicket({
    subject: `[Contact Form] ${subject}: ${name}`,
    description: `
From: ${name}
Email: ${email}
Organization: ${organization || 'Not provided'}

Message:
${message}
    `.trim(),
    email,
    channel: 'Web Form',
  })
}

export async function createPartnerApplicationTicket({
  companyName,
  contactName,
  email,
  phone,
  country,
  website,
  clientCount,
  avgDevices,
  tierPreference,
  whiteLabel,
  taxId,
  businessDescription,
}: {
  companyName: string
  contactName: string
  email: string
  phone?: string
  country: string
  website?: string
  clientCount: string
  avgDevices: string
  tierPreference: string
  whiteLabel: string
  taxId?: string
  businessDescription?: string
}) {
  return createTicket({
    subject: `[Partner Application] ${companyName}`,
    description: `
Partner Application

Company Details:
- Company Name: ${companyName}
- Website: ${website || 'Not provided'}
- Country: ${country}
- Tax ID/VAT: ${taxId || 'Not provided'}

Contact Information:
- Contact Name: ${contactName}
- Email: ${email}
- Phone: ${phone || 'Not provided'}

Business Profile:
- Number of Clients: ${clientCount}
- Average Devices per Client: ${avgDevices}
- Tier Preference: ${tierPreference}
- White-label Interest: ${whiteLabel}

Business Description:
${businessDescription || 'Not provided'}
    `.trim(),
    email,
    channel: 'Web Form',
    classification: 'Partner',
    priority: 'High',
  })
}
