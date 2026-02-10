import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { createServiceClient } from '@/lib/db/client'
import { PLAN_LIMITS } from '@/lib/constants'
import { logger } from '@/lib/logger'

const IP_REGEX = /^(\d{1,3}\.){3}\d{1,3}$/
const VALID_CHECK_TYPES = ['ping', 'http', 'tcp', 'ssl', 'dns']

interface ImportError {
  row: number
  error: string
}

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const supabase = createServiceClient()

    // Get membership and permissions
    const { data: membership } = await supabase
      .from('organization_members')
      .select('organization_id, role, permissions')
      .eq('user_id', userId)
      .limit(1)
      .single()

    if (!membership) {
      return NextResponse.json({ error: 'No organization found' }, { status: 404 })
    }

    const permissions = (membership.permissions as string[]) || []
    const canManage = membership.role === 'owner' || membership.role === 'admin' || permissions.includes('can_manage_devices')
    if (!canManage) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }

    const orgId = membership.organization_id

    // Parse multipart form data
    const formData = await request.formData()
    const file = formData.get('file') as File | null

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    if (!file.name.endsWith('.csv')) {
      return NextResponse.json({ error: 'File must be a .csv' }, { status: 400 })
    }

    const text = await file.text()
    const lines = text.split('\n').map(l => l.trim()).filter(Boolean)

    if (lines.length < 2) {
      return NextResponse.json({ error: 'CSV must have a header row and at least one data row' }, { status: 400 })
    }

    // Parse header
    const headerLine = lines[0].toLowerCase()
    const headers = headerLine.split(',').map(h => h.replace(/"/g, '').trim())

    const nameIdx = headers.indexOf('name')
    if (nameIdx === -1) {
      return NextResponse.json({ error: 'CSV must have a "name" column' }, { status: 400 })
    }

    const ipIdx = headers.indexOf('ip_address')
    const macIdx = headers.indexOf('mac_address')
    const hostnameIdx = headers.indexOf('hostname')
    const categoryIdx = headers.indexOf('category_name')
    const checkTypeIdx = headers.indexOf('check_type')
    const descriptionIdx = headers.indexOf('description')

    // Check device limit
    const { data: org } = await supabase
      .from('organizations')
      .select('plan, device_limit')
      .eq('id', orgId)
      .single()

    const plan = (org?.plan || 'trial') as keyof typeof PLAN_LIMITS
    const deviceLimit = org?.device_limit || PLAN_LIMITS[plan]?.devices || 100

    const { count: currentCount } = await supabase
      .from('devices')
      .select('*', { count: 'exact', head: true })
      .eq('organization_id', orgId)

    const availableSlots = deviceLimit - (currentCount || 0)

    // Load categories for name -> id resolution
    const { data: categories } = await supabase
      .from('categories')
      .select('id, name')
      .eq('organization_id', orgId)

    const categoryMap = new Map((categories || []).map(c => [c.name.toLowerCase(), c.id]))

    // Parse and validate rows
    const errors: ImportError[] = []
    const validRows: Record<string, unknown>[] = []

    for (let i = 1; i < lines.length; i++) {
      const cells = parseCSVLine(lines[i])
      const rowNum = i + 1

      const name = cells[nameIdx]?.replace(/"/g, '').trim()
      if (!name) {
        errors.push({ row: rowNum, error: 'Name is required' })
        continue
      }

      const ip = ipIdx >= 0 ? cells[ipIdx]?.replace(/"/g, '').trim() : undefined
      if (ip && !IP_REGEX.test(ip)) {
        errors.push({ row: rowNum, error: `Invalid IP address: ${ip}` })
        continue
      }

      const checkType = checkTypeIdx >= 0 ? cells[checkTypeIdx]?.replace(/"/g, '').trim().toLowerCase() : 'ping'
      if (checkType && !VALID_CHECK_TYPES.includes(checkType)) {
        errors.push({ row: rowNum, error: `Invalid check_type: ${checkType}. Must be ping, http, tcp, ssl, or dns` })
        continue
      }

      const categoryName = categoryIdx >= 0 ? cells[categoryIdx]?.replace(/"/g, '').trim() : undefined
      const categoryId = categoryName ? categoryMap.get(categoryName.toLowerCase()) : undefined

      if (categoryName && !categoryId) {
        errors.push({ row: rowNum, error: `Category not found: ${categoryName}` })
        continue
      }

      if (validRows.length >= availableSlots) {
        errors.push({ row: rowNum, error: 'Device limit reached' })
        continue
      }

      validRows.push({
        organization_id: orgId,
        name,
        ip_address: ip || null,
        mac_address: macIdx >= 0 ? cells[macIdx]?.replace(/"/g, '').trim() || null : null,
        hostname: hostnameIdx >= 0 ? cells[hostnameIdx]?.replace(/"/g, '').trim() || null : null,
        category_id: categoryId || null,
        check_type: checkType || 'ping',
        description: descriptionIdx >= 0 ? cells[descriptionIdx]?.replace(/"/g, '').trim() || null : null,
        status: 'unknown',
        is_enabled: true,
        is_monitored: true,
        sort_order: 0,
      })
    }

    // Batch insert valid rows
    let imported = 0
    if (validRows.length > 0) {
      const { error: insertError } = await supabase
        .from('devices')
        .insert(validRows)

      if (insertError) {
        logger.error('Bulk device import insert error', insertError, { route: 'api/dashboard/devices/import' })
        return NextResponse.json({ error: 'Failed to insert devices' }, { status: 500 })
      }

      imported = validRows.length

      // Audit log
      await supabase.from('audit_logs').insert({
        organization_id: orgId,
        actor_type: 'user',
        actor_id: userId,
        action: 'device.created',
        resource_type: 'device',
        resource_id: orgId,
        metadata: { bulk_import: true, count: imported },
      })
    }

    return NextResponse.json({
      imported,
      skipped: errors.length,
      errors,
    })
  } catch (error) {
    logger.error('Device import error', error, { route: 'api/dashboard/devices/import' })
    return NextResponse.json({ error: 'Failed to import devices' }, { status: 500 })
  }
}

/** Parse a single CSV line, handling quoted fields with commas */
function parseCSVLine(line: string): string[] {
  const result: string[] = []
  let current = ''
  let inQuotes = false

  for (let i = 0; i < line.length; i++) {
    const char = line[i]
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"'
        i++
      } else {
        inQuotes = !inQuotes
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current)
      current = ''
    } else {
      current += char
    }
  }
  result.push(current)
  return result
}
