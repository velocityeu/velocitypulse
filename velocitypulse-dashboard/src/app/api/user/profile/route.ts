import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { getAdminClient } from '@/lib/db/client'

export async function GET() {
  const { userId } = await auth()
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = getAdminClient()
  const { data: user, error } = await supabase
    .from('users')
    .select('id, email, first_name, last_name, image_url, is_staff, created_at')
    .eq('id', userId)
    .single()

  if (error || !user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 })
  }

  return NextResponse.json({ user })
}

export async function PATCH(request: Request) {
  const { userId } = await auth()
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: { first_name?: string; last_name?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  // Only allow updating name fields
  const updates: Record<string, string | null> = {}
  if ('first_name' in body) {
    updates.first_name = body.first_name?.trim() || null
  }
  if ('last_name' in body) {
    updates.last_name = body.last_name?.trim() || null
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 })
  }

  const supabase = getAdminClient()
  const { data: user, error } = await supabase
    .from('users')
    .update(updates)
    .eq('id', userId)
    .select('id, email, first_name, last_name, image_url, is_staff, created_at')
    .single()

  if (error) {
    console.error('Failed to update user profile:', error)
    return NextResponse.json({ error: 'Failed to update profile' }, { status: 500 })
  }

  return NextResponse.json({ user })
}
