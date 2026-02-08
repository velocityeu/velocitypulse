import { NextResponse } from 'next/server'

const SCRIPT_URL =
  'https://raw.githubusercontent.com/velocityeu/velocitypulse-agent/main/scripts/install-linux.sh'

export async function GET() {
  try {
    const res = await fetch(SCRIPT_URL, {
      headers: { 'User-Agent': 'VelocityPulse-Installer-Proxy' },
      next: { revalidate: 300 }, // cache 5 minutes
    })

    if (!res.ok) {
      return new NextResponse('Failed to fetch installer script', { status: 502 })
    }

    const script = await res.text()

    return new NextResponse(script, {
      status: 200,
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'public, max-age=300, s-maxage=300',
      },
    })
  } catch {
    return new NextResponse('Installer temporarily unavailable', { status: 502 })
  }
}
