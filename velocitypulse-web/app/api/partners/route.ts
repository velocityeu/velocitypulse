import { NextResponse } from 'next/server'
import { partnerFormSchema, formatZodErrors } from '@/lib/validation'
import { isDevelopment } from '@/lib/env'
import { deliverPartnerForm } from '@/lib/form-delivery'

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

    if (isDevelopment()) {
      // eslint-disable-next-line no-console
      console.log('Partner application:', { companyName, contactName, email })
    }

    // Deliver via configured sinks with explicit success contract
    const delivery = await deliverPartnerForm({
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
    })
    if (!delivery.success) {
      const status = delivery.configured_sinks === 0 ? 503 : 502
      return NextResponse.json(
        {
          error: 'Failed to deliver your application. Please try again later.',
          ...(isDevelopment() ? { delivery } : {}),
        },
        { status }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Thank you for your application. We will review it and get back to you within 2-3 business days.',
      degraded: delivery.failed_sinks > 0,
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
