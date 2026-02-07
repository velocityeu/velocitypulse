import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { createServiceClient } from '@/lib/db/client'

/**
 * POST /api/dashboard/categories/reorder
 * Bulk update category sort_order values
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
      return NextResponse.json({ error: 'You do not have permission to reorder categories' }, { status: 403 })
    }

    // Parse request body
    let body: { orderedIds: string[] }
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
    }

    if (!Array.isArray(body.orderedIds) || body.orderedIds.length === 0) {
      return NextResponse.json({ error: 'orderedIds array is required' }, { status: 400 })
    }

    const organizationId = membership.organization_id

    // Verify all categories belong to this organization
    const { data: existingCategories, error: existingError } = await supabase
      .from('categories')
      .select('id')
      .eq('organization_id', organizationId)
      .in('id', body.orderedIds)

    if (existingError) {
      return NextResponse.json({ error: 'Failed to verify categories' }, { status: 500 })
    }

    const existingIds = new Set((existingCategories || []).map(c => c.id))
    const invalidIds = body.orderedIds.filter(id => !existingIds.has(id))

    if (invalidIds.length > 0) {
      return NextResponse.json(
        { error: `Categories not found: ${invalidIds.join(', ')}` },
        { status: 404 }
      )
    }

    // Update sort_order for each category
    const updates = body.orderedIds.map((id, index) => ({
      id,
      sort_order: index + 1,
      updated_at: new Date().toISOString(),
    }))

    // Perform updates
    for (const update of updates) {
      const { error: updateError } = await supabase
        .from('categories')
        .update({ sort_order: update.sort_order, updated_at: update.updated_at })
        .eq('id', update.id)
        .eq('organization_id', organizationId)

      if (updateError) {
        console.error('Update sort_order error:', updateError)
        return NextResponse.json({ error: 'Failed to update category order' }, { status: 500 })
      }
    }

    // Audit log (fire-and-forget)
    supabase.from('audit_logs').insert({
      organization_id: organizationId,
      actor_type: 'user',
      actor_id: userId,
      action: 'category.reordered',
      resource_type: 'category',
      resource_id: organizationId,
      metadata: { ordered_ids: body.orderedIds },
    }).then(({ error: auditError }) => {
      if (auditError) console.error('[Audit] category.reordered failed:', auditError)
    })

    // Return updated categories
    const { data: categories, error: fetchError } = await supabase
      .from('categories')
      .select('*')
      .eq('organization_id', organizationId)
      .order('sort_order')

    if (fetchError) {
      return NextResponse.json({ error: 'Failed to fetch updated categories' }, { status: 500 })
    }

    return NextResponse.json({ categories: categories || [], success: true })
  } catch (error) {
    console.error('Reorder categories error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
