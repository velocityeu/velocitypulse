'use client'

import { useState } from 'react'
import { Monitor, Terminal, Laptop, CheckCircle2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { CopyBlock } from '@/components/agents/CopyBlock'
import {
  AGENT_INSTALL_URL_WINDOWS,
  AGENT_INSTALL_URL_LINUX,
  DASHBOARD_URL,
} from '@/lib/constants'

type Platform = 'windows' | 'linux' | 'macos'

interface AgentInstallInstructionsProps {
  apiKey?: string | null
  agentName: string
}

export function AgentInstallInstructions({ apiKey, agentName }: AgentInstallInstructionsProps) {
  const [platform, setPlatform] = useState<Platform>('windows')

  const safeName = agentName.replace(/'/g, "''")

  const windowsInstallCommand = apiKey
    ? `irm ${AGENT_INSTALL_URL_WINDOWS} -OutFile $env:TEMP\\vp-install.ps1\n& $env:TEMP\\vp-install.ps1 -ApiKey '${apiKey}' -AgentName '${safeName}'`
    : `irm ${AGENT_INSTALL_URL_WINDOWS} | iex`

  const linuxInstallCommand = apiKey
    ? `export VP_API_KEY='${apiKey}'\nexport VELOCITYPULSE_URL='${DASHBOARD_URL}'\ncurl -sSL ${AGENT_INSTALL_URL_LINUX} | sudo -E bash`
    : `curl -sSL ${AGENT_INSTALL_URL_LINUX} | sudo bash`

  // macOS uses the same shell script as Linux (auto-detects OS)
  const macosInstallCommand = apiKey
    ? `export VP_API_KEY='${apiKey}'\nexport VELOCITYPULSE_URL='${DASHBOARD_URL}'\ncurl -sSL ${AGENT_INSTALL_URL_LINUX} | sudo -E bash`
    : `curl -sSL ${AGENT_INSTALL_URL_LINUX} | sudo bash`

  return (
    <div className="space-y-4">
      {/* Platform tabs */}
      <div className="flex rounded-lg bg-muted p-1 gap-1">
        <Button
          variant={platform === 'windows' ? 'default' : 'ghost'}
          size="sm"
          className="flex-1 gap-2"
          onClick={() => setPlatform('windows')}
        >
          <Monitor className="h-4 w-4" />
          Windows
        </Button>
        <Button
          variant={platform === 'linux' ? 'default' : 'ghost'}
          size="sm"
          className="flex-1 gap-2"
          onClick={() => setPlatform('linux')}
        >
          <Terminal className="h-4 w-4" />
          Linux
        </Button>
        <Button
          variant={platform === 'macos' ? 'default' : 'ghost'}
          size="sm"
          className="flex-1 gap-2"
          onClick={() => setPlatform('macos')}
        >
          <Laptop className="h-4 w-4" />
          macOS
        </Button>
      </div>

      {platform === 'windows' && (
        <div className="space-y-4">
          {/* Prerequisites */}
          <div>
            <h4 className="text-sm font-medium mb-1">Prerequisites</h4>
            <p className="text-sm text-muted-foreground">
              Run PowerShell as Administrator. The installer will automatically install Node.js if needed.
            </p>
          </div>

          {/* Install command */}
          <div>
            <h4 className="text-sm font-medium mb-2">Install command</h4>
            <CopyBlock code={windowsInstallCommand} language="PowerShell" />
          </div>

          {/* Verify */}
          <div>
            <h4 className="text-sm font-medium mb-2">Verify installation</h4>
            <CopyBlock code="Get-Service VelocityPulseAgent" language="PowerShell" />
            <p className="text-xs text-muted-foreground mt-2">
              View logs: <code className="bg-muted px-1 py-0.5 rounded">Get-Content &quot;C:\ProgramData\VelocityPulse\logs\service.log&quot; -Tail 50</code>
            </p>
          </div>
        </div>
      )}

      {platform === 'linux' && (
        <div className="space-y-4">
          {/* Prerequisites */}
          <div>
            <h4 className="text-sm font-medium mb-1">Prerequisites</h4>
            <p className="text-sm text-muted-foreground">
              Run as root (sudo). The installer will automatically install Node.js if not found.
            </p>
          </div>

          {/* Install command */}
          <div>
            <h4 className="text-sm font-medium mb-2">Install command</h4>
            <CopyBlock code={linuxInstallCommand} language="Bash" />
          </div>

          {/* Verify */}
          <div>
            <h4 className="text-sm font-medium mb-2">Verify installation</h4>
            <CopyBlock code="sudo systemctl status velocitypulse-agent" language="Bash" />
            <p className="text-xs text-muted-foreground mt-2">
              View logs: <code className="bg-muted px-1 py-0.5 rounded">journalctl -u velocitypulse-agent -f</code>
            </p>
          </div>
        </div>
      )}

      {platform === 'macos' && (
        <div className="space-y-4">
          {/* Prerequisites */}
          <div>
            <h4 className="text-sm font-medium mb-1">Prerequisites</h4>
            <p className="text-sm text-muted-foreground">
              Run in Terminal with sudo. The installer will automatically install Node.js via Homebrew or the official pkg installer.
            </p>
          </div>

          {/* Install command */}
          <div>
            <h4 className="text-sm font-medium mb-2">Install command</h4>
            <CopyBlock code={macosInstallCommand} language="Bash" />
          </div>

          {/* Verify */}
          <div>
            <h4 className="text-sm font-medium mb-2">Verify installation</h4>
            <CopyBlock code="sudo launchctl list | grep velocitypulse" language="Bash" />
            <p className="text-xs text-muted-foreground mt-2">
              View logs: <code className="bg-muted px-1 py-0.5 rounded">tail -f /opt/velocitypulse-agent/logs/service.log</code>
            </p>
          </div>
        </div>
      )}

      {/* Success callout */}
      <div className="flex items-start gap-2 rounded-lg border border-green-500/20 bg-green-500/5 p-3">
        <CheckCircle2 className="h-4 w-4 text-green-600 mt-0.5 shrink-0" />
        <p className="text-sm text-muted-foreground">
          Your agent will appear as <span className="font-medium text-foreground">Online</span> in the dashboard within 60 seconds.
        </p>
      </div>

      {/* UI access callout */}
      <div className="rounded-lg border border-border bg-muted/20 p-3 text-sm text-muted-foreground space-y-2">
        <p className="font-medium text-foreground">Access the local Agent UI</p>
        <p>1. Open <code className="bg-muted px-1 py-0.5 rounded">http://localhost:3001</code> on the machine running the agent.</p>
        <p>2. Enter the one-time setup code from agent logs (printed at startup).</p>
        <p>3. Optional: if your organization enables dashboard SSO, use “Sign in with dashboard”.</p>
      </div>
    </div>
  )
}
