'use client'

import { useState, useMemo, useCallback, useEffect, useRef } from 'react'
import { StatusSummary } from '@/components/dashboard/StatusSummary'
import { DeviceGrid } from '@/components/dashboard/DeviceGrid'
import { createBrowserClient } from '@/lib/db/client'
import type { Device, Category, NetworkSegment, ViewMode, StatusSummary as StatusSummaryType } from '@/types'
import type { RealtimeChannel } from '@supabase/supabase-js'

export default function DashboardPage() {
  const [devices, setDevices] = useState<Device[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [segments, setSegments] = useState<NetworkSegment[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null)
  const [realtimeConnected, setRealtimeConnected] = useState(false)
  const [viewMode, setViewMode] = useState<ViewMode>('grid')
  const [groupBySegment, setGroupBySegment] = useState(true)

  const channelRef = useRef<RealtimeChannel | null>(null)
  const supabase = useMemo(() => {
    try {
      return createBrowserClient()
    } catch {
      return null
    }
  }, [])

  // Load data on mount
  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    if (!supabase) {
      setIsLoading(false)
      return
    }

    setIsLoading(true)
    try {
      const [devicesRes, categoriesRes, segmentsRes] = await Promise.all([
        supabase.from('devices').select('*').order('sort_order'),
        supabase.from('categories').select('*').order('sort_order'),
        supabase.from('network_segments').select('*').order('name'),
      ])

      if (devicesRes.data) setDevices(devicesRes.data)
      if (categoriesRes.data) setCategories(categoriesRes.data)
      if (segmentsRes.data) setSegments(segmentsRes.data)
      setLastRefresh(new Date())
    } catch (error) {
      console.error('Failed to load data:', error)
    } finally {
      setIsLoading(false)
    }
  }

  // Subscribe to realtime updates
  useEffect(() => {
    if (!supabase) return

    const channel = supabase
      .channel('devices-realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'devices',
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
  }, [supabase])

  // Calculate status summary
  const summary: StatusSummaryType = useMemo(() => ({
    total: devices.length,
    online: devices.filter(d => d.status === 'online').length,
    offline: devices.filter(d => d.status === 'offline').length,
    degraded: devices.filter(d => d.status === 'degraded').length,
    unknown: devices.filter(d => d.status === 'unknown').length,
  }), [devices])

  // Handle device click
  const handleDeviceClick = useCallback((device: Device) => {
    console.log('Device clicked:', device)
    // TODO: Open device details modal
  }, [])

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

      {/* Device Grid */}
      <DeviceGrid
        devices={devices}
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
