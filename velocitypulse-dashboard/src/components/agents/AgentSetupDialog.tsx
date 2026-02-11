'use client'

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Info } from 'lucide-react'
import { AgentInstallInstructions } from '@/components/agents/AgentInstallInstructions'
import type { Agent } from '@/types'

interface AgentSetupDialogProps {
  agent: Agent
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function AgentSetupDialog({ agent, open, onOpenChange }: AgentSetupDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Install Agent: {agent.name}</DialogTitle>
          <DialogDescription>
            Follow the instructions below to install and connect this agent.
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-start gap-2 rounded-lg border bg-muted/50 p-3">
          <Info className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
          <p className="text-sm text-muted-foreground">
            You&apos;ll need the API key from when this agent was created. The installer will prompt you if not provided in the command.
          </p>
        </div>

        <AgentInstallInstructions agentName={agent.name} />

        <DialogFooter>
          <Button onClick={() => onOpenChange(false)}>Done</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
