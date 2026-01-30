'use client'

import { useState, useMemo, useCallback, useEffect, useRef } from 'react'
import { StatusSummary } from '@/components/dashboard/StatusSummary'
import { DeviceGrid } from '@/components/dashboard/DeviceGrid'
import { CategoryChips } from '@/components/dashboard/CategoryChips'
import { SearchFilter } from '@/components/dashboard/SearchFilter'
import { ViewToggle } from '@/components/dashboard/ViewToggle'
import { useOrganization } from '@/lib/contexts/OrganizationContext'
import { createBrowserClient } from '@/lib/db/client'
import type { Device, Category, NetworkSegment, ViewMode, StatusSummary as StatusSummaryType } from '@/types'
import type { RealtimeChannel } from '@supabase/supabase-js'
import { Loader2 } from 'lucide-react'

export default function DashboardPage() {
  const { organization, isLoading: orgLoading } = useOrganization()

  const [devices, setDevices] = useState<Device[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [segments, setSegments] = useState<NetworkSegment[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null)
  const [realtimeConnected, setRealtimeConnected] = useState(false)
  const [viewMode, setViewMode] = useState<ViewMode>('grid')
  const [groupBySegment, setGroupBySegment] = useState(true)

  // Filtering state
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)

  const channelRef = useRef<RealtimeChannel | null>(null)
  const supabase = useMemo(() => {
    try {
      return createBrowserClient()
    } catch {
      return null
    }
  }, [])

  // Load data from API routes
  const loadData = useCallback(async () => {
    if (!organization) return

    setIsLoading(true)
    try {
      const [devicesRes, categoriesRes, segmentsRes] = await Promise.all([
        fetch('/api/dashboard/devices'),
        fetch('/api/dashboard/categories'),
        fetch('/api/dashboard/segments'),
      ])

      if (devicesRes.ok) {
        const data = await devicesRes.json()
        setDevices(data.devices || [])
      }

      if (categoriesRes.ok) {
        const data = await categoriesRes.json()
        setCategories(data.categories || [])
      }

      if (segmentsRes.ok) {
        const data = await segmentsRes.json()
        setSegments(data.segments || [])
      }

      setLastRefresh(new Date())
    } catch (error) {
      console.error('Failed to load data:', error)
    } finally {
      setIsLoading(false)
    }
  }, [organization])

  // Load data when organization is available
  useEffect(() => {
    if (organization && !orgLoading) {
      loadData()
    }
  }, [organization, orgLoading, loadData])

  // Subscribe to realtime updates with organization filter
  useEffect(() => {
    if (!supabase || !organization) return

    // Clean up previous subscription
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current)
    }

    const channel = supabase
      .channel(`devices-${organization.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'devices',
          filter: `organization_id=eq.${organization.id}`,
        },
        (payload) => {
          setLastRefresh(new Date())

          if (payload.eventType === 'INSERT') {
            setDevices(prev => [...prev, payload.new as Device])
          } else if (payload.eventType === 'UPDATE') {
            setDevices(prev => prev.map(d => d.id === (payload.new as Device).id ? payload.new as Device : d))
          } else if (payload.eventType === 'DELETE') {
            setDevices(prev => prev.filter(d => d.id !== (payload.old as { id: string }).id))
          }
        }
      )
      .subscribe((status) => {
        setRealtimeConnected(status === 'SUBSCRIBED')
      })

    channelRef.current = channel

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current)
      }
    }
  }, [supabase, organization])

  // Filter devices based on search and category
  const filteredDevices = useMemo(() => {
    let result = devices

    // Filter by category
    if (selectedCategory) {
      result = result.filter(d => d.category_id === selectedCategory)
    }

    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase()
      result = result.filter(d =>
        d.name.toLowerCase().includes(query) ||
        d.ip_address?.toLowerCase().includes(query) ||
        d.hostname?.toLowerCase().includes(query) ||
        d.mac_address?.toLowerCase().includes(query) ||
        d.description?.toLowerCase().includes(query)
      )
    }

    return result
  }, [devices, selectedCategory, searchQuery])

  // Calculate status summary from filtered devices
  const summary: StatusSummaryType = useMemo(() => ({
    total: filteredDevices.length,
    online: filteredDevices.filter(d => d.status === 'online').length,
    offline: filteredDevices.filter(d => d.status === 'offline').length,
    degraded: filteredDevices.filter(d => d.status === 'degraded').length,
    unknown: filteredDevices.filter(d => d.status === 'unknown').length,
  }), [filteredDevices])

  // Handle device click
  const handleDeviceClick = useCallback((device: Device) => {
    console.log('Device clicked:', device)
    // TODO: Open device details modal
  }, [])

  // Show loading state if organization is loading
  if (orgLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Loading organization...</p>
        </div>
      </div>
    )
  }

  // Show prompt if no organization
  if (!organization) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="flex flex-col items-center gap-3 text-center">
          <p className="text-lg font-medium">No organization found</p>
          <p className="text-sm text-muted-foreground">Please complete onboarding to continue.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">
          Monitor your IT infrastructure in real-time
        </p>
      </div>

      {/* Status Summary */}
      <StatusSummary summary={summary} lastCheck={lastRefresh?.toISOString()} />

      {/* Toolbar: Search, Category Filter, View Toggle */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:flex-1">
          {/* Search */}
          <div className="w-full sm:w-64">
            <SearchFilter
              value={searchQuery}
              onChange={setSearchQuery}
              placeholder="Search devices..."
            />
          </div>

          {/* Category Chips */}
          <div className="flex-1 overflow-hidden">
            <CategoryChips
              categories={categories}
              devices={devices}
              selectedCategory={selectedCategory}
              onSelectCategory={setSelectedCategory}
            />
          </div>
        </div>

        {/* View Toggle */}
        <div className="flex items-center gap-2">
          <ViewToggle
            viewMode={viewMode}
            onViewModeChange={setViewMode}
          />
        </div>
      </div>

      {/* Device Grid */}
      <DeviceGrid
        devices={filteredDevices}
        categories={categories}
        segments={segments}
        isLoading={isLoading}
        viewMode={viewMode}
        groupBySegment={groupBySegment}
        onDeviceClick={handleDeviceClick}
      />

      {/* Connection status indicator */}
      <div className="fixed bottom-4 right-4">
        <div className={`rounded-lg border px-3 py-1.5 text-xs shadow-lg flex items-center gap-2 ${
          realtimeConnected
            ? 'bg-status-online/10 border-status-online/20 text-status-online'
            : 'bg-status-degraded/10 border-status-degraded/20 text-status-degraded'
        }`}>
          <span className={`w-2 h-2 rounded-full ${realtimeConnected ? 'bg-status-online animate-pulse' : 'bg-status-degraded'}`} />
          {realtimeConnected ? 'Live updates' : 'Connecting...'}
        </div>
      </div>
    </div>
  )
}
