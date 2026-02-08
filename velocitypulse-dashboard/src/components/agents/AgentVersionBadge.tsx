'use client'

import { Badge } from '@/components/ui/badge'
import { isNewerVersion } from '@/lib/version'
import { LATEST_AGENT_VERSION } from '@/lib/constants'

interface AgentVersionBadgeProps {
  version?: string
}

export function AgentVersionBadge({ version }: AgentVersionBadgeProps) {
  if (!version) {
    return (
      <Badge variant="secondary" className="font-mono text-xs">
        Unknown
      </Badge>
    )
  }

  const updateAvailable = isNewerVersion(version, LATEST_AGENT_VERSION)

  if (updateAvailable) {
    return (
      <Badge variant="outline" className="font-mono text-xs text-amber-600 border-amber-300 bg-amber-50 dark:bg-amber-950/30">
        v{version} &rarr; v{LATEST_AGENT_VERSION}
      </Badge>
    )
  }

  return (
    <Badge variant="outline" className="font-mono text-xs text-green-600 border-green-300 bg-green-50 dark:bg-green-950/30">
      v{version}
    </Badge>
  )
}
