import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { getAdminClient } from '@/lib/db/client'

export const runtime = 'nodejs'

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
const MAX_SIZE = 2 * 1024 * 1024 // 2MB

const EXT_MAP: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
}

export async function POST(request: Request) {
  const { userId } = await auth()
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const formData = await request.formData()
  const file = formData.get('file') as File | null

  if (!file) {
    return NextResponse.json({ error: 'No file provided' }, { status: 400 })
  }

  if (!ALLOWED_TYPES.includes(file.type)) {
    return NextResponse.json(
      { error: 'Invalid file type. Allowed: jpeg, png, webp, gif' },
      { status: 400 }
    )
  }

  if (file.size > MAX_SIZE) {
    return NextResponse.json(
      { error: 'File too large. Maximum size is 2MB' },
      { status: 400 }
    )
  }

  const ext = EXT_MAP[file.type] || 'png'
  const path = `${userId}/avatar.${ext}`

  const supabase = getAdminClient()

  // Upload to storage
  const buffer = Buffer.from(await file.arrayBuffer())
  const { error: uploadError } = await supabase.storage
    .from('avatars')
    .upload(path, buffer, {
      contentType: file.type,
      upsert: true,
    })

  if (uploadError) {
    console.error('Avatar upload failed:', uploadError)
    return NextResponse.json({ error: 'Failed to upload avatar' }, { status: 500 })
  }

  // Get public URL
  const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(path)
  const imageUrl = urlData.publicUrl

  // Update user record
  const { error: updateError } = await supabase
    .from('users')
    .update({ image_url: imageUrl })
    .eq('id', userId)

  if (updateError) {
    console.error('Failed to update user image_url:', updateError)
    return NextResponse.json({ error: 'Failed to update profile' }, { status: 500 })
  }

  return NextResponse.json({ image_url: imageUrl })
}

export async function DELETE() {
  const { userId } = await auth()
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = getAdminClient()

  // List and remove all files under the user's avatar path
  const { data: files } = await supabase.storage
    .from('avatars')
    .list(userId)

  if (files && files.length > 0) {
    const paths = files.map(f => `${userId}/${f.name}`)
    await supabase.storage.from('avatars').remove(paths)
  }

  // Clear image_url in user record
  const { error } = await supabase
    .from('users')
    .update({ image_url: null })
    .eq('id', userId)

  if (error) {
    console.error('Failed to clear user image_url:', error)
    return NextResponse.json({ error: 'Failed to remove avatar' }, { status: 500 })
  }

  return NextResponse.json({ image_url: null })
}
