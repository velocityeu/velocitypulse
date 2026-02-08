'use client'

import { Badge } from '@/components/ui/badge'
import type { Agent } from '@/types'

type AgentState = 'online' | 'offline' | 'disabled' | 'never_connected'

function getAgentState(agent: Agent): AgentState {
  if (!agent.is_enabled) return 'disabled'
  if (agent.is_online && agent.is_enabled) return 'online'
  if (agent.is_enabled && !agent.last_seen_at) return 'never_connected'
  return 'offline'
}

const STATE_CONFIG: Record<AgentState, { label: string; dotColor: string; variant: 'success' | 'destructive' | 'secondary' | 'outline' }> = {
  online: { label: 'Online', dotColor: 'bg-green-500', variant: 'success' },
  offline: { label: 'Offline', dotColor: 'bg-red-500', variant: 'destructive' },
  disabled: { label: 'Disabled', dotColor: 'bg-gray-400', variant: 'secondary' },
  never_connected: { label: 'Never Connected', dotColor: 'bg-blue-500', variant: 'outline' },
}

interface AgentStatusBadgeProps {
  agent: Agent
}

export function AgentStatusBadge({ agent }: AgentStatusBadgeProps) {
  const state = getAgentState(agent)
  const config = STATE_CONFIG[state]

  return (
    <Badge variant={config.variant} className="gap-1.5">
      <span className={`w-2 h-2 rounded-full ${config.dotColor}`} />
      {config.label}
    </Badge>
  )
}
