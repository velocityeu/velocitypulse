'use client'

import { useState, useEffect, useCallback } from 'react'
import { authFetch } from '@/lib/auth-fetch'
import {
  Plus, Copy, Check, Eye, EyeOff, Server,
  Loader2, AlertCircle, RefreshCw
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { SonarPingButton } from '@/components/dashboard/SonarPingButton'
import { AgentCard } from '@/components/agents/AgentCard'
import { AgentInstallInstructions } from '@/components/agents/AgentInstallInstructions'
import { useSonarPing } from '@/lib/hooks/useSonarPing'
import type { Agent, NetworkSegment } from '@/types'

interface AgentWithSegments extends Agent {
  network_segments?: NetworkSegment[]
}

export default function AgentsPage() {
  const [agents, setAgents] = useState<AgentWithSegments[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Create agent dialog
  const [showCreateAgent, setShowCreateAgent] = useState(false)
  const [newAgentName, setNewAgentName] = useState('')
  const [newAgentDescription, setNewAgentDescription] = useState('')
  const [creatingAgent, setCreatingAgent] = useState(false)
  const [createdApiKey, setCreatedApiKey] = useState<string | null>(null)
  const [createdAgentName, setCreatedAgentName] = useState('')
  const [showApiKey, setShowApiKey] = useState(false)
  const [copiedKey, setCopiedKey] = useState(false)

  // Sonar ping
  const { pingAgent, pingAgents: pingMultipleAgents, isPinging } = useSonarPing()

  // Delete agent dialog
  const [agentToDelete, setAgentToDelete] = useState<Agent | null>(null)
  const [deletingAgent, setDeletingAgent] = useState(false)

  // Load agents
  const loadAgents = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const res = await authFetch('/api/dashboard/agents')
      if (!res.ok) throw new Error('Failed to load agents')
      const data = await res.json()
      setAgents(data.agents || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load agents')
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    loadAgents()
  }, [loadAgents])

  // Create agent
  const handleCreateAgent = async () => {
    if (!newAgentName.trim()) return
    setCreatingAgent(true)
    try {
      const res = await authFetch('/api/dashboard/agents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newAgentName.trim(),
          description: newAgentDescription.trim() || undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to create agent')
      setCreatedApiKey(data.agent.api_key)
      setCreatedAgentName(newAgentName.trim())
      setAgents(prev => [...prev, data.agent])
      setNewAgentName('')
      setNewAgentDescription('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create agent')
    } finally {
      setCreatingAgent(false)
    }
  }

  // Delete agent
  const handleDeleteAgent = async () => {
    if (!agentToDelete) return
    setDeletingAgent(true)
    try {
      const res = await authFetch(`/api/dashboard/agents/${agentToDelete.id}`, { method: 'DELETE' })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to delete agent')
      }
      setAgents(prev => prev.filter(a => a.id !== agentToDelete.id))
      setAgentToDelete(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete agent')
    } finally {
      setDeletingAgent(false)
    }
  }

  // Toggle agent enabled
  const handleToggleEnabled = async (agentId: string, enabled: boolean) => {
    try {
      const res = await authFetch(`/api/dashboard/agents/${agentId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_enabled: enabled }),
      })
      if (!res.ok) {
        setError('Failed to toggle agent')
        return
      }
      const data = await res.json()
      setAgents(prev => prev.map(a => a.id === agentId ? { ...a, ...data.agent } : a))
    } catch {
      setError('Failed to toggle agent')
    }
  }

  // Send command to agent
  const handleSendCommand = async (agentId: string, commandType: string) => {
    try {
      await authFetch(`/api/dashboard/agents/${agentId}/commands`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command_type: commandType }),
      })
    } catch {
      setError('Failed to send command')
    }
  }

  // Segment callbacks
  const handleSegmentAdded = (agentId: string, segment: NetworkSegment) => {
    setAgents(prev => prev.map(a => {
      if (a.id !== agentId) return a
      return { ...a, network_segments: [...(a.network_segments || []), segment] }
    }))
  }

  const handleSegmentDeleted = (agentId: string, segmentId: string) => {
    setAgents(prev => prev.map(a => {
      if (a.id !== agentId) return a
      return { ...a, network_segments: (a.network_segments || []).filter(s => s.id !== segmentId) }
    }))
  }

  const handleSegmentUpdated = (agentId: string, segment: NetworkSegment) => {
    setAgents(prev => prev.map(a => {
      if (a.id !== agentId) return a
      return { ...a, network_segments: (a.network_segments || []).map(s => s.id === segment.id ? segment : s) }
    }))
  }

  // Copy API key
  const copyApiKey = async () => {
    if (!createdApiKey) return
    await navigator.clipboard.writeText(createdApiKey)
    setCopiedKey(true)
    setTimeout(() => setCopiedKey(false), 2000)
  }

  const closeCreateDialog = () => {
    setShowCreateAgent(false)
    setCreatedApiKey(null)
    setCreatedAgentName('')
    setShowApiKey(false)
    setNewAgentName('')
    setNewAgentDescription('')
  }

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Agents</h1>
          <p className="text-muted-foreground">
            Manage the agents that monitor your network infrastructure
          </p>
        </div>
        <div className="flex items-center gap-2">
          {agents.length > 0 && (
            <SonarPingButton
              isPinging={agents.some(a => isPinging(a.id))}
              onClick={() => pingMultipleAgents(agents.filter(a => a.is_online).map(a => a.id))}
              variant="text"
              label="Ping All"
              disabled={isLoading || agents.filter(a => a.is_online).length === 0}
            />
          )}
          <Button variant="outline" size="icon" onClick={loadAgents} disabled={isLoading}>
            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
          </Button>
          <Button onClick={() => setShowCreateAgent(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Add Agent
          </Button>
        </div>
      </div>

      {/* Error message */}
      {error && (
        <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-lg flex items-center gap-3 text-destructive">
          <AlertCircle className="h-5 w-5 shrink-0" />
          <p className="text-sm">{error}</p>
          <Button variant="ghost" size="sm" onClick={() => setError(null)} className="ml-auto">
            Dismiss
          </Button>
        </div>
      )}

      {/* Content */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : agents.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Server className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">No agents yet</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Create an agent to start monitoring your network devices
            </p>
            <Button onClick={() => setShowCreateAgent(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Create your first agent
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {agents.map(agent => (
            <AgentCard
              key={agent.id}
              agent={agent}
              isPinging={isPinging(agent.id)}
              onPing={() => pingAgent(agent.id)}
              onSendCommand={(cmd) => handleSendCommand(agent.id, cmd)}
              onDelete={() => setAgentToDelete(agent)}
              onToggleEnabled={(enabled) => handleToggleEnabled(agent.id, enabled)}
              onSegmentAdded={(seg) => handleSegmentAdded(agent.id, seg)}
              onSegmentDeleted={(segId) => handleSegmentDeleted(agent.id, segId)}
              onSegmentUpdated={(seg) => handleSegmentUpdated(agent.id, seg)}
            />
          ))}
        </div>
      )}

      {/* Create Agent Dialog */}
      <Dialog open={showCreateAgent} onOpenChange={closeCreateDialog}>
        <DialogContent className={createdApiKey ? 'max-w-2xl max-h-[85vh] overflow-y-auto' : undefined}>
          <DialogHeader>
            <DialogTitle>{createdApiKey ? 'Agent Created' : 'Create New Agent'}</DialogTitle>
            <DialogDescription>
              {createdApiKey
                ? 'Your agent has been created. Save the API key below - it will only be shown once.'
                : 'Create an agent to monitor devices on your network'}
            </DialogDescription>
          </DialogHeader>

          {createdApiKey ? (
            <div className="space-y-4">
              <div className="p-4 bg-muted rounded-lg">
                <p className="text-sm font-medium mb-2">API Key</p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 text-sm font-mono bg-background p-2 rounded border overflow-x-auto">
                    {showApiKey ? createdApiKey : '\u2022'.repeat(40)}
                  </code>
                  <Button variant="ghost" size="icon" onClick={() => setShowApiKey(!showApiKey)}>
                    {showApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                  <Button variant="ghost" size="icon" onClick={copyApiKey}>
                    {copiedKey ? <Check className="h-4 w-4 text-status-online" /> : <Copy className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
              <div className="p-4 bg-status-degraded/10 border border-status-degraded/20 rounded-lg text-sm">
                <p className="font-medium text-status-degraded">Important</p>
                <p className="text-muted-foreground">
                  Copy this API key now. You won&apos;t be able to see it again.
                </p>
              </div>

              {/* Installation instructions */}
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-background px-2 text-muted-foreground">Installation</span>
                </div>
              </div>

              <AgentInstallInstructions apiKey={createdApiKey} agentName={createdAgentName} />
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium">Name</label>
                <Input
                  value={newAgentName}
                  onChange={e => setNewAgentName(e.target.value)}
                  placeholder="e.g., Office Network Agent"
                  className="mt-1"
                />
              </div>
              <div>
                <label className="text-sm font-medium">Description (optional)</label>
                <Input
                  value={newAgentDescription}
                  onChange={e => setNewAgentDescription(e.target.value)}
                  placeholder="e.g., Monitors the main office network"
                  className="mt-1"
                />
              </div>
            </div>
          )}

          <DialogFooter>
            {createdApiKey ? (
              <Button onClick={closeCreateDialog}>Done</Button>
            ) : (
              <>
                <Button variant="outline" onClick={closeCreateDialog}>Cancel</Button>
                <Button onClick={handleCreateAgent} disabled={creatingAgent || !newAgentName.trim()}>
                  {creatingAgent ? 'Creating...' : 'Create Agent'}
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Agent Dialog */}
      <Dialog open={!!agentToDelete} onOpenChange={() => setAgentToDelete(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-destructive">Delete Agent</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete &quot;{agentToDelete?.name}&quot;?
            </DialogDescription>
          </DialogHeader>

          <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-lg text-sm">
            <p className="font-medium text-destructive">This will permanently delete:</p>
            <ul className="mt-2 list-inside list-disc text-muted-foreground">
              <li>The agent and all its configuration</li>
              <li>All network segments assigned to this agent</li>
              <li>All devices discovered by this agent</li>
            </ul>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setAgentToDelete(null)} disabled={deletingAgent}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDeleteAgent} disabled={deletingAgent}>
              {deletingAgent ? 'Deleting...' : 'Delete Agent'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
