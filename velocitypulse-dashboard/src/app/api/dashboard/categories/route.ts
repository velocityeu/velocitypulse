import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { createServiceClient } from '@/lib/db/client'

export async function GET() {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

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

    const organizationId = membership.organization_id

    // Query categories for this organization with device count
    const { data: categories, error: categoriesError } = await supabase
      .from('categories')
      .select('*')
      .eq('organization_id', organizationId)
      .order('sort_order')

    if (categoriesError) {
      console.error('Failed to fetch categories:', categoriesError)
      return NextResponse.json({ error: 'Failed to fetch categories' }, { status: 500 })
    }

    // Get device counts per category
    const { data: deviceCounts } = await supabase
      .from('devices')
      .select('category_id')
      .eq('organization_id', organizationId)
      .not('category_id', 'is', null)

    const countMap = (deviceCounts || []).reduce((acc, d) => {
      acc[d.category_id] = (acc[d.category_id] || 0) + 1
      return acc
    }, {} as Record<string, number>)

    const categoriesWithCount = (categories || []).map(cat => ({
      ...cat,
      device_count: countMap[cat.id] || 0,
    }))

    return NextResponse.json({ categories: categoriesWithCount })
  } catch (error) {
    console.error('Dashboard categories error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * POST /api/dashboard/categories
 * Create a new category
 */
export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

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
      return NextResponse.json({ error: 'You do not have permission to create categories' }, { status: 403 })
    }

    const organizationId = membership.organization_id

    // Parse request body
    let body: {
      name: string
      slug?: string
      icon?: string
      color?: string
      description?: string
    }
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
    }

    if (!body.name || body.name.trim().length < 1) {
      return NextResponse.json({ error: 'Category name is required' }, { status: 400 })
    }

    // Generate slug if not provided
    const slug = body.slug?.trim() || body.name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

    // Get max sort_order
    const { data: maxCategory } = await supabase
      .from('categories')
      .select('sort_order')
      .eq('organization_id', organizationId)
      .order('sort_order', { ascending: false })
      .limit(1)
      .single()

    const nextSortOrder = (maxCategory?.sort_order || 0) + 1

    // Create category
    const { data: category, error: createError } = await supabase
      .from('categories')
      .insert({
        organization_id: organizationId,
        name: body.name.trim(),
        slug,
        icon: body.icon || null,
        color: body.color || null,
        description: body.description || null,
        sort_order: nextSortOrder,
      })
      .select()
      .single()

    if (createError) {
      console.error('Create category error:', createError)
      if (createError.code === '23505') {
        return NextResponse.json({ error: 'A category with this slug already exists' }, { status: 409 })
      }
      return NextResponse.json({ error: 'Failed to create category' }, { status: 500 })
    }

    return NextResponse.json({ category: { ...category, device_count: 0 } }, { status: 201 })
  } catch (error) {
    console.error('Create category error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
