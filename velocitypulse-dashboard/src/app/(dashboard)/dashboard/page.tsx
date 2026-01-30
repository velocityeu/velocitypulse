'use client'

import { useState, useMemo, useCallback, useEffect, useRef } from 'react'
import Link from 'next/link'
import { useOrganization } from '@/lib/contexts/OrganizationContext'
import { createBrowserClient } from '@/lib/db/client'
import type { Device, Category, NetworkSegment, Agent, StatusSummary as StatusSummaryType } from '@/types'
import type { RealtimeChannel } from '@supabase/supabase-js'
import {
  Loader2,
  Activity,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Monitor,
  FolderOpen,
  Server,
  ArrowRight,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

export default function DashboardPage() {
  const { organization, isLoading: orgLoading } = useOrganization()

  const [devices, setDevices] = useState<Device[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [segments, setSegments] = useState<NetworkSegment[]>([])
  const [agents, setAgents] = useState<Agent[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null)
  const [realtimeConnected, setRealtimeConnected] = useState(false)

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

  // Calculate status summary
  const summary: StatusSummaryType = useMemo(() => ({
    total: devices.length,
    online: devices.filter(d => d.status === 'online').length,
    offline: devices.filter(d => d.status === 'offline').length,
    degraded: devices.filter(d => d.status === 'degraded').length,
    unknown: devices.filter(d => d.status === 'unknown').length,
  }), [devices])

  // Calculate agent stats
  const agentStats = useMemo(() => ({
    total: agents.length,
    online: agents.filter(a => a.is_online).length,
  }), [agents])

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

  const statusCards = [
    {
      label: 'Total Devices',
      value: summary.total,
      icon: Activity,
      color: 'text-foreground',
      bgColor: 'bg-muted',
    },
    {
      label: 'Online',
      value: summary.online,
      icon: CheckCircle2,
      color: 'text-status-online',
      bgColor: 'bg-status-online/10',
    },
    {
      label: 'Offline',
      value: summary.offline,
      icon: XCircle,
      color: 'text-status-offline',
      bgColor: 'bg-status-offline/10',
    },
    {
      label: 'Degraded',
      value: summary.degraded,
      icon: AlertTriangle,
      color: 'text-status-degraded',
      bgColor: 'bg-status-degraded/10',
    },
  ]

  return (
    <div className="space-y-8">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Overview</h1>
        <p className="text-muted-foreground">
          Monitor your IT infrastructure at a glance
        </p>
      </div>

      {/* Status Summary Cards */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        {statusCards.map(card => {
          const Icon = card.icon
          return (
            <Card key={card.label} className={card.bgColor}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">{card.label}</p>
                    <p className={`text-3xl font-bold ${card.color}`}>{card.value}</p>
                  </div>
                  <div className={`rounded-full p-3 ${card.bgColor}`}>
                    <Icon className={`h-6 w-6 ${card.color}`} />
                  </div>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Quick Action Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        {/* Devices Card */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <Monitor className="h-5 w-5 text-muted-foreground" />
              <CardTitle className="text-lg">Devices</CardTitle>
            </div>
            <CardDescription>
              {devices.length} device{devices.length !== 1 ? 's' : ''} total
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between text-sm text-muted-foreground mb-4">
              <span>{summary.online} online</span>
              <span>{summary.offline} offline</span>
            </div>
            <Button variant="outline" className="w-full" asChild>
              <Link href="/devices">
                View Devices
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </CardContent>
        </Card>

        {/* Categories Card */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <FolderOpen className="h-5 w-5 text-muted-foreground" />
              <CardTitle className="text-lg">Categories</CardTitle>
            </div>
            <CardDescription>
              {categories.length} categor{categories.length !== 1 ? 'ies' : 'y'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-1 mb-4 min-h-[20px]">
              {categories.slice(0, 3).map(cat => (
                <span
                  key={cat.id}
                  className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-xs"
                >
                  {cat.icon && <span className="mr-1">{cat.icon}</span>}
                  {cat.name}
                </span>
              ))}
              {categories.length > 3 && (
                <span className="text-xs text-muted-foreground">
                  +{categories.length - 3} more
                </span>
              )}
            </div>
            <Button variant="outline" className="w-full" asChild>
              <Link href="/categories">
                View Categories
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </CardContent>
        </Card>

        {/* Agents Card */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <Server className="h-5 w-5 text-muted-foreground" />
              <CardTitle className="text-lg">Agents</CardTitle>
            </div>
            <CardDescription>
              {agents.length} agent{agents.length !== 1 ? 's' : ''} ({agentStats.online} online)
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-4 min-h-[20px]">
              {agents.length === 0 ? (
                <span>No agents configured</span>
              ) : (
                <>
                  <span className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-status-online" />
                    {agentStats.online} active
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-status-offline" />
                    {agentStats.total - agentStats.online} inactive
                  </span>
                </>
              )}
            </div>
            <Button variant="outline" className="w-full" asChild>
              <Link href="/agents">
                Manage Agents
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>

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
