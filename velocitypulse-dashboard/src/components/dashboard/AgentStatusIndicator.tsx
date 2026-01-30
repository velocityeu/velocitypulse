'use client'

import { useEffect, useState } from 'react'
import { Wifi, WifiOff } from 'lucide-react'
import { createBrowserClient } from '@/lib/db/client'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'

interface AgentStatus {
  id: string
  name: string
  is_online: boolean
  last_seen_at: string | null
}

interface AgentStatusIndicatorProps {
  organizationId: string
}

export function AgentStatusIndicator({ organizationId }: AgentStatusIndicatorProps) {
  const [agents, setAgents] = useState<AgentStatus[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!organizationId) return

    const supabase = createBrowserClient()

    // Initial fetch
    async function fetchAgents() {
      const { data } = await supabase
        .from('agents')
        .select('id, name, last_seen_at, is_enabled')
        .eq('organization_id', organizationId)
        .eq('is_enabled', true)

      if (data) {
        const agentsWithStatus = data.map((agent) => ({
          id: agent.id,
          name: agent.name,
          is_online: isAgentOnline(agent.last_seen_at),
          last_seen_at: agent.last_seen_at,
        }))
        setAgents(agentsWithStatus)
      }
      setLoading(false)
    }

    fetchAgents()

    // Subscribe to changes
    const channel = supabase
      .channel('agent-status')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'agents',
          filter: `organization_id=eq.${organizationId}`,
        },
        (payload) => {
          if (payload.eventType === 'DELETE') {
            setAgents((prev) => prev.filter((a) => a.id !== payload.old.id))
          } else {
            const agent = payload.new as { id: string; name: string; last_seen_at: string | null; is_enabled: boolean }
            if (!agent.is_enabled) {
              setAgents((prev) => prev.filter((a) => a.id !== agent.id))
            } else {
              setAgents((prev) => {
                const existing = prev.find((a) => a.id === agent.id)
                const updated = {
                  id: agent.id,
                  name: agent.name,
                  is_online: isAgentOnline(agent.last_seen_at),
                  last_seen_at: agent.last_seen_at,
                }
                if (existing) {
                  return prev.map((a) => (a.id === agent.id ? updated : a))
                }
                return [...prev, updated]
              })
            }
          }
        }
      )
      .subscribe()

    // Refresh online status every 30 seconds
    const interval = setInterval(() => {
      setAgents((prev) =>
        prev.map((agent) => ({
          ...agent,
          is_online: isAgentOnline(agent.last_seen_at),
        }))
      )
    }, 30000)

    return () => {
      supabase.removeChannel(channel)
      clearInterval(interval)
    }
  }, [organizationId])

  if (loading) {
    return (
      <div className="flex items-center gap-1.5 px-2 py-1 text-sm text-muted-foreground">
        <div className="h-2 w-2 rounded-full bg-muted animate-pulse" />
        <span className="hidden sm:inline">Loading...</span>
      </div>
    )
  }

  if (agents.length === 0) {
    return null
  }

  const onlineCount = agents.filter((a) => a.is_online).length
  const totalCount = agents.length
  const allOnline = onlineCount === totalCount
  const allOffline = onlineCount === 0
  const someOffline = !allOnline && !allOffline

  const statusColor = allOnline
    ? 'bg-emerald-500'
    : allOffline
      ? 'bg-red-500'
      : 'bg-amber-500'

  const statusText = allOnline
    ? `${onlineCount} agent${onlineCount !== 1 ? 's' : ''} online`
    : allOffline
      ? `${totalCount} agent${totalCount !== 1 ? 's' : ''} offline`
      : `${onlineCount}/${totalCount} agents online`

  const Icon = allOffline ? WifiOff : Wifi

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div
            className={cn(
              'flex items-center gap-1.5 px-2 py-1 rounded-md text-sm cursor-default transition-colors',
              allOnline && 'text-emerald-600 dark:text-emerald-400',
              allOffline && 'text-red-600 dark:text-red-400',
              someOffline && 'text-amber-600 dark:text-amber-400'
            )}
          >
            <div className={cn('h-2 w-2 rounded-full', statusColor)} />
            <Icon className="h-3.5 w-3.5" />
            <span className="hidden sm:inline font-medium">
              {onlineCount}/{totalCount}
            </span>
          </div>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="max-w-xs">
          <div className="space-y-1">
            <p className="font-medium">{statusText}</p>
            {agents.map((agent) => (
              <div key={agent.id} className="flex items-center gap-2 text-xs">
                <div
                  className={cn(
                    'h-1.5 w-1.5 rounded-full',
                    agent.is_online ? 'bg-emerald-500' : 'bg-red-500'
                  )}
                />
                <span>{agent.name}</span>
                {agent.last_seen_at && (
                  <span className="text-muted-foreground">
                    {formatLastSeen(agent.last_seen_at)}
                  </span>
                )}
              </div>
            ))}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

// Agent is considered online if last seen within 2 minutes
function isAgentOnline(lastSeenAt: string | null): boolean {
  if (!lastSeenAt) return false
  const lastSeen = new Date(lastSeenAt)
  const now = new Date()
  const diffMs = now.getTime() - lastSeen.getTime()
  return diffMs < 2 * 60 * 1000 // 2 minutes
}

function formatLastSeen(lastSeenAt: string): string {
  const lastSeen = new Date(lastSeenAt)
  const now = new Date()
  const diffMs = now.getTime() - lastSeen.getTime()
  const diffSec = Math.floor(diffMs / 1000)
  const diffMin = Math.floor(diffSec / 60)
  const diffHour = Math.floor(diffMin / 60)

  if (diffSec < 60) return 'just now'
  if (diffMin < 60) return `${diffMin}m ago`
  if (diffHour < 24) return `${diffHour}h ago`
  return lastSeen.toLocaleDateString()
}
