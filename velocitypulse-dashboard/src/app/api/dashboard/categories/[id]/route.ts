import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { createServiceClient } from '@/lib/db/client'

interface RouteParams {
  params: Promise<{ id: string }>
}

/**
 * GET /api/dashboard/categories/[id]
 * Get a single category by ID
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const supabase = createServiceClient()

    // Get user's organization
    const { data: membership, error: memberError } = await supabase
      .from('organization_members')
      .select('organization_id')
      .eq('user_id', userId)
      .limit(1)
      .single()

    if (memberError || !membership) {
      return NextResponse.json({ error: 'No organization found' }, { status: 404 })
    }

    // Get category
    const { data: category, error: categoryError } = await supabase
      .from('categories')
      .select('*')
      .eq('id', id)
      .eq('organization_id', membership.organization_id)
      .single()

    if (categoryError || !category) {
      return NextResponse.json({ error: 'Category not found' }, { status: 404 })
    }

    // Get device count
    const { count } = await supabase
      .from('devices')
      .select('*', { count: 'exact', head: true })
      .eq('category_id', id)

    return NextResponse.json({ category: { ...category, device_count: count || 0 } })
  } catch (error) {
    console.error('Get category error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * PATCH /api/dashboard/categories/[id]
 * Update a category
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const supabase = createServiceClient()

    // Get user's organization and membership
    const { data: membership, error: memberError } = await supabase
      .from('organization_members')
      .select('organization_id, role, permissions')
      .eq('user_id', userId)
      .limit(1)
      .single()

    if (memberError || !membership) {
      return NextResponse.json({ error: 'No organization found' }, { status: 404 })
    }

    // Check permission
    const canManage = membership.role === 'owner' || membership.role === 'admin' || membership.role === 'editor'
    if (!canManage) {
      return NextResponse.json({ error: 'You do not have permission to update categories' }, { status: 403 })
    }

    // Verify category belongs to organization
    const { data: existingCategory, error: existingError } = await supabase
      .from('categories')
      .select('id')
      .eq('id', id)
      .eq('organization_id', membership.organization_id)
      .single()

    if (existingError || !existingCategory) {
      return NextResponse.json({ error: 'Category not found' }, { status: 404 })
    }

    // Parse request body
    let body: {
      name?: string
      slug?: string
      icon?: string | null
      color?: string | null
      description?: string | null
    }
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
    }

    // Build update object
    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }

    if (body.name !== undefined) updates.name = body.name?.trim() || null
    if (body.slug !== undefined) updates.slug = body.slug?.trim() || null
    if (body.icon !== undefined) updates.icon = body.icon || null
    if (body.color !== undefined) updates.color = body.color || null
    if (body.description !== undefined) updates.description = body.description || null

    // Update category
    const { data: category, error: updateError } = await supabase
      .from('categories')
      .update(updates)
      .eq('id', id)
      .select()
      .single()

    if (updateError) {
      console.error('Update category error:', updateError)
      if (updateError.code === '23505') {
        return NextResponse.json({ error: 'A category with this slug already exists' }, { status: 409 })
      }
      return NextResponse.json({ error: 'Failed to update category' }, { status: 500 })
    }

    // Get device count
    const { count } = await supabase
      .from('devices')
      .select('*', { count: 'exact', head: true })
      .eq('category_id', id)

    return NextResponse.json({ category: { ...category, device_count: count || 0 } })
  } catch (error) {
    console.error('Update category error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * DELETE /api/dashboard/categories/[id]
 * Delete a category
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const supabase = createServiceClient()

    // Get user's organization and membership
    const { data: membership, error: memberError } = await supabase
      .from('organization_members')
      .select('organization_id, role, permissions')
      .eq('user_id', userId)
      .limit(1)
      .single()

    if (memberError || !membership) {
      return NextResponse.json({ error: 'No organization found' }, { status: 404 })
    }

    // Check permission
    const canManage = membership.role === 'owner' || membership.role === 'admin'
    if (!canManage) {
      return NextResponse.json({ error: 'You do not have permission to delete categories' }, { status: 403 })
    }

    // Get category
    const { data: category, error: categoryError } = await supabase
      .from('categories')
      .select('id, name')
      .eq('id', id)
      .eq('organization_id', membership.organization_id)
      .single()

    if (categoryError || !category) {
      return NextResponse.json({ error: 'Category not found' }, { status: 404 })
    }

    // Set category_id to null for all devices in this category
    await supabase
      .from('devices')
      .update({ category_id: null, updated_at: new Date().toISOString() })
      .eq('category_id', id)

    // Delete category
    const { error: deleteError } = await supabase
      .from('categories')
      .delete()
      .eq('id', id)

    if (deleteError) {
      console.error('Delete category error:', deleteError)
      return NextResponse.json({ error: 'Failed to delete category' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Delete category error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
