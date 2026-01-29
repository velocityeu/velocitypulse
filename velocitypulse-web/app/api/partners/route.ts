import { NextResponse } from 'next/server'
import { partnerFormSchema, formatZodErrors } from '@/lib/validation'
import { isZohoConfigured, isDevelopment } from '@/lib/env'

export async function POST(request: Request) {
  try {
    const body = await request.json()

    // Validate input
    const result = partnerFormSchema.safeParse(body)
    if (!result.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: formatZodErrors(result.error) },
        { status: 400 }
      )
    }

    const {
      companyName,
      website,
      contactName,
      email,
      phone,
      country,
      clientCount,
      avgDevices,
      tierPreference,
      whiteLabel,
      taxId,
      businessDescription,
    } = result.data

    // TODO: Integrate with Zoho Help Desk API
    // When Zoho is configured, create a partner application ticket
    if (isZohoConfigured()) {
      // Future implementation:
      // const zohoResponse = await fetch('https://desk.zoho.com/api/v1/tickets', {
      //   method: 'POST',
      //   headers: {
      //     'Authorization': `Zoho-oauthtoken ${process.env.ZOHO_ACCESS_TOKEN}`,
      //     'orgId': process.env.ZOHO_ORG_ID!,
      //     'Content-Type': 'application/json',
      //   },
      //   body: JSON.stringify({
      //     subject: `[Partner Application] ${companyName}`,
      //     description: `
      //       Company: ${companyName}
      //       Website: ${website}
      //       Contact: ${contactName}
      //       Email: ${email}
      //       Phone: ${phone}
      //       Country: ${country}
      //       Clients: ${clientCount}
      //       Avg Devices: ${avgDevices}
      //       Tier: ${tierPreference}
      //       White-label: ${whiteLabel}
      //       Tax ID: ${taxId || 'Not provided'}
      //
      //       Business Description:
      //       ${businessDescription || 'Not provided'}
      //     `,
      //     email: email,
      //     channel: 'Web Form',
      //     classification: 'Partner',
      //   }),
      // })
    }

    // For now, log in development only
    if (isDevelopment()) {
      // eslint-disable-next-line no-console
      console.log('Partner application:', {
        companyName,
        website,
        contactName,
        email,
        phone,
        country,
        clientCount,
        avgDevices,
        tierPreference,
        whiteLabel,
        taxId,
        businessDescription,
        timestamp: new Date().toISOString(),
      })
    }

    return NextResponse.json({
      success: true,
      message: 'Thank you for your application. We will review it and get back to you within 2-3 business days.',
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'

    if (isDevelopment()) {
      return NextResponse.json(
        { error: 'Failed to process partner application', details: message },
        { status: 500 }
      )
    }

    return NextResponse.json(
      { error: 'Failed to submit application. Please try again later.' },
      { status: 500 }
    )
  }
}
