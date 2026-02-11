'use client'

import { useState } from 'react'
import { RefreshCw, ArrowUpCircle, Settings } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { SonarPingButton } from '@/components/dashboard/SonarPingButton'
import { ConfigPushDialog } from '@/components/agents/ConfigPushDialog'
import { isNewerVersion } from '@/lib/version'
import { LATEST_AGENT_VERSION } from '@/lib/constants'
import type { Agent } from '@/types'
import type { PingResult } from '@/lib/hooks/useSonarPing'

interface AgentCommandBarProps {
  agent: Agent
  isPinging: boolean
  onPing: () => void
  onScanNow: () => void
  onUpgrade: () => void
  pingResult?: PingResult
}

export function AgentCommandBar({
  agent,
  isPinging,
  onPing,
  onScanNow,
  onUpgrade,
  pingResult,
}: AgentCommandBarProps) {
  const [showConfig, setShowConfig] = useState(false)
  const showUpgrade = agent.version ? isNewerVersion(agent.version, LATEST_AGENT_VERSION) : false

  return (
    <>
      <div className="flex items-center gap-1">
        <SonarPingButton
          isPinging={isPinging}
          onClick={onPing}
          disabled={!agent.is_online}
          result={pingResult}
        />
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={onScanNow}
          disabled={!agent.is_online}
          title="Scan Now"
        >
          <RefreshCw className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={() => setShowConfig(true)}
          disabled={!agent.is_online}
          title="Configure Agent"
        >
          <Settings className="h-4 w-4" />
        </Button>
        {showUpgrade && (
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-amber-600 hover:text-amber-700"
            onClick={onUpgrade}
            disabled={!agent.is_online}
            title="Upgrade Agent"
          >
            <ArrowUpCircle className="h-4 w-4" />
          </Button>
        )}
      </div>

      <ConfigPushDialog
        agent={agent}
        open={showConfig}
        onOpenChange={setShowConfig}
      />
    </>
  )
}
