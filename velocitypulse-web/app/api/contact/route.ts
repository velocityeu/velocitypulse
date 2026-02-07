import { NextResponse } from 'next/server'
import { contactFormSchema, formatZodErrors } from '@/lib/validation'
import { isDevelopment } from '@/lib/env'
import { deliverContactForm } from '@/lib/form-delivery'

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

    if (isDevelopment()) {
      // eslint-disable-next-line no-console
      console.log('Contact form submission:', { name, email, organization, subject })
    }

    // Deliver via email and store in Supabase
    await deliverContactForm({ name, email, organization, subject, message })

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
