'use client'

import { useState, useMemo, useCallback, useEffect, useRef } from 'react'
import { useSearchParams } from 'next/navigation'
import { useOrganization } from '@/lib/contexts/OrganizationContext'
import { createBrowserClient } from '@/lib/db/client'
import type { Device, Category, NetworkSegment, Agent, ViewMode, SortField, SortDirection } from '@/types'
import type { RealtimeChannel } from '@supabase/supabase-js'
import {
  Search, RefreshCw, Settings2, Server, CheckCircle2, X
} from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { DeviceGrid } from '@/components/dashboard/DeviceGrid'
import { ViewToggle } from '@/components/dashboard/ViewToggle'
import { SortControls } from '@/components/dashboard/SortControls'
import { CategoryChips } from '@/components/dashboard/CategoryChips'
import { StatusSummary } from '@/components/dashboard/StatusSummary'
import { UsageQuotaWarnings } from '@/components/dashboard/UsageQuotaWarnings'
import { AGENT_ONLINE_THRESHOLD_MS } from '@/lib/constants'

// Local storage keys
const STORAGE_KEYS = {
  viewMode: 'velocitypulse-dashboard-viewMode',
  sortField: 'velocitypulse-dashboard-sortField',
  sortDirection: 'velocitypulse-dashboard-sortDirection',
  groupBySegment: 'velocitypulse-dashboard-groupBySegment',
}

export default function DashboardPage() {
  const { organization, isLoading: orgLoading } = useOrganization()
  const searchParams = useSearchParams()
  const [checkoutSuccess, setCheckoutSuccess] = useState(false)

  // Data state
  const [devices, setDevices] = useState<Device[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [segments, setSegments] = useState<NetworkSegment[]>([])
  const [agents, setAgents] = useState<Agent[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [realtimeConnected, setRealtimeConnected] = useState(false)

  // View preferences (initialized from localStorage)
  const [viewMode, setViewMode] = useState<ViewMode>('grid')
  const [sortField, setSortField] = useState<SortField>('name')
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc')
  const [groupBySegment, setGroupBySegment] = useState(false)

  // Filter state
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)

  // Refs
  const channelRef = useRef<RealtimeChannel | null>(null)
  const supabase = useMemo(() => {
    try {
      return createBrowserClient()
    } catch {
      return null
    }
  }, [])

  // Load preferences from localStorage on mount
  useEffect(() => {
    if (typeof window === 'undefined') return

    const savedViewMode = localStorage.getItem(STORAGE_KEYS.viewMode)
    const savedSortField = localStorage.getItem(STORAGE_KEYS.sortField)
    const savedSortDirection = localStorage.getItem(STORAGE_KEYS.sortDirection)
    const savedGroupBySegment = localStorage.getItem(STORAGE_KEYS.groupBySegment)

    if (savedViewMode) setViewMode(savedViewMode as ViewMode)
    if (savedSortField) setSortField(savedSortField as SortField)
    if (savedSortDirection) setSortDirection(savedSortDirection as SortDirection)
    if (savedGroupBySegment) setGroupBySegment(savedGroupBySegment === 'true')
  }, [])

  // Handle checkout success query param
  useEffect(() => {
    if (searchParams.get('checkout') === 'success') {
      setCheckoutSuccess(true)
      // Clean URL without triggering navigation
      window.history.replaceState({}, '', '/dashboard')
      // Auto-dismiss after 8 seconds
      const timer = setTimeout(() => setCheckoutSuccess(false), 8000)
      return () => clearTimeout(timer)
    }
  }, [searchParams])

  // Save preferences to localStorage
  const handleViewModeChange = (mode: ViewMode) => {
    setViewMode(mode)
    localStorage.setItem(STORAGE_KEYS.viewMode, mode)
  }

  const handleSortFieldChange = (field: SortField) => {
    setSortField(field)
    localStorage.setItem(STORAGE_KEYS.sortField, field)
  }

  const handleSortDirectionChange = (direction: SortDirection) => {
    setSortDirection(direction)
    localStorage.setItem(STORAGE_KEYS.sortDirection, direction)
  }

  const handleGroupBySegmentChange = (enabled: boolean) => {
    setGroupBySegment(enabled)
    localStorage.setItem(STORAGE_KEYS.groupBySegment, String(enabled))
  }

  // Load data from API
  const loadData = useCallback(async () => {
    if (!organization) return

    setIsLoading(true)
    try {
      const [devicesRes, categoriesRes, segmentsRes, agentsRes] = await Promise.all([
        fetch('/api/dashboard/devices'),
        fetch('/api/dashboard/categories'),
        fetch('/api/dashboard/segments'),
        fetch('/api/dashboard/agents'),
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

      if (agentsRes.ok) {
        const data = await agentsRes.json()
        setAgents(data.agents || [])
      }
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

  // Subscribe to realtime updates
  useEffect(() => {
    if (!supabase || !organization) return

    if (channelRef.current) {
      supabase.removeChannel(channelRef.current)
    }

    const channel = supabase
      .channel(`dashboard-${organization.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'devices',
          filter: `organization_id=eq.${organization.id}`,
        },
        (payload) => {
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

  // Filter and sort devices
  const filteredAndSortedDevices = useMemo(() => {
    let result = [...devices]

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase()
      result = result.filter(d =>
        d.name.toLowerCase().includes(query) ||
        d.ip_address?.toLowerCase().includes(query) ||
        d.hostname?.toLowerCase().includes(query) ||
        d.mac_address?.toLowerCase().includes(query) ||
        d.manufacturer?.toLowerCase().includes(query)
      )
    }

    // Apply category filter
    if (selectedCategory) {
      result = result.filter(d => d.category_id === selectedCategory)
    }

    // Apply sorting
    result.sort((a, b) => {
      let comparison = 0

      switch (sortField) {
        case 'name':
          comparison = a.name.localeCompare(b.name)
          break
        case 'ip_address':
          comparison = (a.ip_address || '').localeCompare(b.ip_address || '')
          break
        case 'status':
          const statusOrder = { online: 0, degraded: 1, offline: 2, unknown: 3 }
          comparison = (statusOrder[a.status] || 3) - (statusOrder[b.status] || 3)
          break
        case 'response_time_ms':
          comparison = (a.response_time_ms || Infinity) - (b.response_time_ms || Infinity)
          break
        case 'last_check':
          comparison = new Date(b.last_check || 0).getTime() - new Date(a.last_check || 0).getTime()
          break
        default:
          comparison = 0
      }

      return sortDirection === 'asc' ? comparison : -comparison
    })

    return result
  }, [devices, searchQuery, selectedCategory, sortField, sortDirection])

  // Calculate status summary
  const statusSummary = useMemo(() => ({
    total: devices.length,
    online: devices.filter(d => d.status === 'online').length,
    offline: devices.filter(d => d.status === 'offline').length,
    degraded: devices.filter(d => d.status === 'degraded').length,
    unknown: devices.filter(d => d.status === 'unknown').length,
  }), [devices])

  // Calculate agent stats
  const agentStats = useMemo(() => {
    const now = Date.now()
    const onlineAgents = agents.filter(a => {
      if (!a.last_seen_at) return false
      return (now - new Date(a.last_seen_at).getTime()) < AGENT_ONLINE_THRESHOLD_MS
    })
    return {
      total: agents.length,
      online: onlineAgents.length,
    }
  }, [agents])

  return (
    <div className="space-y-6">
      {/* Checkout success banner */}
      {checkoutSuccess && (
        <div className="flex items-center gap-3 rounded-lg border border-green-200 bg-green-50 px-4 py-3 dark:border-green-800 dark:bg-green-950">
          <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400 shrink-0" />
          <p className="text-sm font-medium text-green-800 dark:text-green-200">
            Payment successful! Your subscription is now active.
          </p>
          <button
            onClick={() => setCheckoutSuccess(false)}
            className="ml-auto text-green-600 hover:text-green-800 dark:text-green-400 dark:hover:text-green-200"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Usage quota warnings */}
      <UsageQuotaWarnings />

      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground">
            Real-time network monitoring
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* Agent status badge */}
          <div className="flex items-center gap-2 text-sm text-muted-foreground border rounded-lg px-3 py-1.5">
            <Server className="h-4 w-4" />
            <span>{agentStats.online}/{agentStats.total} agents online</span>
          </div>
          <Button variant="outline" size="icon" onClick={loadData} disabled={isLoading}>
            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      {/* Status Summary */}
      <StatusSummary summary={statusSummary} />

      {/* Toolbar */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        {/* Search */}
        <div className="relative w-full md:w-80">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search devices..."
            className="pl-9"
          />
        </div>

        {/* View controls */}
        <div className="flex items-center gap-2 flex-wrap">
          <ViewToggle
            viewMode={viewMode}
            onViewModeChange={handleViewModeChange}
          />

          <SortControls
            sortField={sortField}
            sortDirection={sortDirection}
            onSortFieldChange={handleSortFieldChange}
            onSortDirectionChange={handleSortDirectionChange}
          />

          {/* Settings dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="icon" className="h-9 w-9">
                <Settings2 className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>View Settings</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <div className="p-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="group-by-segment" className="text-sm">
                    Group by segment
                  </Label>
                  <Switch
                    id="group-by-segment"
                    checked={groupBySegment}
                    onCheckedChange={handleGroupBySegmentChange}
                  />
                </div>
              </div>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Category chips */}
      <CategoryChips
        categories={categories}
        devices={devices}
        selectedCategory={selectedCategory}
        onSelectCategory={setSelectedCategory}
      />

      {/* Device grid */}
      <DeviceGrid
        devices={filteredAndSortedDevices}
        categories={categories}
        segments={segments}
        isLoading={isLoading}
        viewMode={viewMode}
        groupBySegment={groupBySegment}
      />

      {/* Results count */}
      {!isLoading && filteredAndSortedDevices.length > 0 && (
        <p className="text-sm text-muted-foreground">
          Showing {filteredAndSortedDevices.length} of {devices.length} device{devices.length !== 1 ? 's' : ''}
        </p>
      )}

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
