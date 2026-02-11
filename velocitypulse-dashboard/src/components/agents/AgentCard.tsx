'use client'

import { useState } from 'react'
import { Trash2, ChevronDown, ChevronRight, Download } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { AgentStatusBadge } from '@/components/agents/AgentStatusBadge'
import { AgentVersionBadge } from '@/components/agents/AgentVersionBadge'
import { AgentCommandBar } from '@/components/agents/AgentCommandBar'
import { SegmentManager } from '@/components/agents/SegmentManager'
import { AgentSetupDialog } from '@/components/agents/AgentSetupDialog'
import type { Agent, NetworkSegment } from '@/types'
import type { PingResult } from '@/lib/hooks/useSonarPing'

interface AgentWithSegments extends Agent {
  network_segments?: NetworkSegment[]
}

interface AgentCardProps {
  agent: AgentWithSegments
  isPinging: boolean
  onPing: () => void
  onSendCommand: (commandType: string) => void
  onDelete: () => void
  onToggleEnabled: (enabled: boolean) => void
  onSegmentAdded: (segment: NetworkSegment) => void
  onSegmentDeleted: (segmentId: string) => void
  onSegmentUpdated: (segment: NetworkSegment) => void
  pingResult?: PingResult
}

export function AgentCard({
  agent,
  isPinging,
  onPing,
  onSendCommand,
  onDelete,
  onToggleEnabled,
  onSegmentAdded,
  onSegmentDeleted,
  onSegmentUpdated,
  pingResult,
}: AgentCardProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  const [showSetup, setShowSetup] = useState(false)
  const segments = agent.network_segments || []
  const isNeverConnected = agent.is_enabled && !agent.last_seen_at

  const formatLastSeen = (lastSeenAt?: string) => {
    if (!lastSeenAt) return 'Never'
    const diffMs = Date.now() - new Date(lastSeenAt).getTime()
    const diffMins = Math.floor(diffMs / 60000)
    if (diffMins < 1) return 'Just now'
    if (diffMins < 60) return `${diffMins}m ago`
    const diffHours = Math.floor(diffMins / 60)
    if (diffHours < 24) return `${diffHours}h ago`
    return `${Math.floor(diffHours / 24)}d ago`
  }

  return (
    <Card>
      <CardContent className="p-0">
        {/* Agent header */}
        <div className="p-4 flex items-center gap-4">
          {/* Agent info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-medium truncate">{agent.name}</h3>
              <AgentStatusBadge agent={agent} />
              <AgentVersionBadge version={agent.version} />
            </div>
            <p className="text-sm text-muted-foreground truncate">
              {agent.description || 'No description'}
            </p>
          </div>

          {/* Agent metadata */}
          <div className="hidden md:flex items-center gap-6 text-sm text-muted-foreground">
            {agent.last_ip_address && (
              <div>
                <span className="text-xs uppercase tracking-wide">IP</span>
                <p className="font-mono">{agent.last_ip_address}</p>
              </div>
            )}
            <div>
              <span className="text-xs uppercase tracking-wide">API Key</span>
              <p className="font-mono">{agent.api_key_prefix}...</p>
            </div>
            <div>
              <span className="text-xs uppercase tracking-wide">Last Seen</span>
              <p>{formatLastSeen(agent.last_seen_at)}</p>
            </div>
          </div>

          {/* Enable/disable toggle */}
          <button
            className="h-5 w-9 rounded-full relative cursor-pointer transition-colors shrink-0"
            style={{ backgroundColor: agent.is_enabled ? 'hsl(var(--status-online))' : 'hsl(var(--muted))' }}
            onClick={() => onToggleEnabled(!agent.is_enabled)}
            title={agent.is_enabled ? 'Disable agent' : 'Enable agent'}
          >
            <span
              className="absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform"
              style={{ transform: agent.is_enabled ? 'translateX(18px)' : 'translateX(2px)' }}
            />
          </button>

          {/* Command bar */}
          <AgentCommandBar
            agent={agent}
            isPinging={isPinging}
            onPing={onPing}
            onScanNow={() => onSendCommand('scan_now')}
            onUpgrade={() => onSendCommand('upgrade')}
            pingResult={pingResult}
          />

          {/* Setup button for never-connected agents */}
          {isNeverConnected && (
            <Button
              variant="outline"
              size="sm"
              className="gap-1 text-blue-600 border-blue-600/30 hover:bg-blue-600/10 hover:text-blue-600"
              onClick={() => setShowSetup(true)}
            >
              <Download className="h-4 w-4" />
              <span className="hidden sm:inline">Setup</span>
            </Button>
          )}

          {/* Expand segments */}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsExpanded(!isExpanded)}
            className="gap-1"
          >
            {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            <span className="hidden sm:inline">{segments.length} segment{segments.length !== 1 ? 's' : ''}</span>
          </Button>

          {/* Delete */}
          <Button
            variant="ghost"
            size="icon"
            onClick={onDelete}
            className="text-destructive hover:text-destructive hover:bg-destructive/10"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>

        {/* Mobile metadata */}
        <div className="md:hidden px-4 pb-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
          {agent.version && <span>v{agent.version}</span>}
          {agent.last_ip_address && <span>{agent.last_ip_address}</span>}
          <span>Key: {agent.api_key_prefix}...</span>
          <span>Last seen: {formatLastSeen(agent.last_seen_at)}</span>
        </div>

        {/* Expanded segments */}
        {isExpanded && (
          <SegmentManager
            agentId={agent.id}
            segments={segments}
            onSegmentAdded={onSegmentAdded}
            onSegmentDeleted={onSegmentDeleted}
            onSegmentUpdated={onSegmentUpdated}
          />
        )}
      </CardContent>

      {/* Setup dialog for never-connected agents */}
      <AgentSetupDialog
        agent={agent}
        open={showSetup}
        onOpenChange={setShowSetup}
      />
    </Card>
  )
}
