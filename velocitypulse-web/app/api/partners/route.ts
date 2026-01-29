import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  try {
    const body = await request.json()
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
      termsAccepted,
      gdprConsent,
    } = body

    // Validate required fields
    if (
      !companyName ||
      !website ||
      !contactName ||
      !email ||
      !phone ||
      !country ||
      !clientCount ||
      !avgDevices ||
      !tierPreference ||
      !whiteLabel ||
      !termsAccepted ||
      !gdprConsent
    ) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    // TODO: Integrate with Zoho Help Desk API
    // Create a ticket tagged as "Partner Application"
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

    // Zoho Help Desk integration would go here:
    // const zohoResponse = await fetch('https://desk.zoho.com/api/v1/tickets', {
    //   method: 'POST',
    //   headers: {
    //     'Authorization': `Zoho-oauthtoken ${process.env.ZOHO_ACCESS_TOKEN}`,
    //     'orgId': process.env.ZOHO_ORG_ID,
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

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error processing partner application:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
