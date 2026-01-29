import { NextResponse } from 'next/server'
import { contactFormSchema, formatZodErrors } from '@/lib/validation'
import { isZohoConfigured, isDevelopment } from '@/lib/env'

export async function POST(request: Request) {
  try {
    const body = await request.json()

    // Validate input
    const result = contactFormSchema.safeParse(body)
    if (!result.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: formatZodErrors(result.error) },
        { status: 400 }
      )
    }

    const { name, email, organization, subject, message } = result.data

    // TODO: Integrate with Zoho Help Desk API
    // When Zoho is configured, create a support ticket
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
      //     subject: `[Contact Form] ${subject}: ${name}`,
      //     description: message,
      //     email: email,
      //     contactId: organization,
      //     channel: 'Web Form',
      //   }),
      // })
    }

    // For now, log in development only
    if (isDevelopment()) {
      // eslint-disable-next-line no-console
      console.log('Contact form submission:', {
        name,
        email,
        organization,
        subject,
        message,
        timestamp: new Date().toISOString(),
      })
    }

    return NextResponse.json({
      success: true,
      message: 'Thank you for your message. We will get back to you within 24-48 hours.',
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'

    if (isDevelopment()) {
      return NextResponse.json(
        { error: 'Failed to process contact form', details: message },
        { status: 500 }
      )
    }

    return NextResponse.json(
      { error: 'Failed to send message. Please try again later.' },
      { status: 500 }
    )
  }
}
