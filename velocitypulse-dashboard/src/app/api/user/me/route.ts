import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { ensureUserInDb } from '@/lib/api/ensure-user'

export async function GET() {
  const { userId } = await auth()
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const user = await ensureUserInDb(userId)
  if (!user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 })
  }

  return NextResponse.json({
    user: {
      id: user.id,
      email: user.email,
      first_name: user.first_name,
      last_name: user.last_name,
      image_url: user.image_url,
      is_staff: user.is_staff,
      created_at: user.created_at,
    },
  })
}
