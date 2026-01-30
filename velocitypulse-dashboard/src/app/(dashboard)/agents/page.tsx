'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  Plus, Trash2, Copy, Check, Eye, EyeOff, Server, Network,
  Loader2, AlertCircle, ChevronDown, ChevronRight, RefreshCw
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import type { Agent, NetworkSegment } from '@/types'

interface AgentWithSegments extends Agent {
  network_segments?: NetworkSegment[]
}

export default function AgentsPage() {
  // Agents state
  const [agents, setAgents] = useState<AgentWithSegments[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Expanded agents
  const [expandedAgents, setExpandedAgents] = useState<Set<string>>(new Set())

  // Create agent dialog
  const [showCreateAgent, setShowCreateAgent] = useState(false)
  const [newAgentName, setNewAgentName] = useState('')
  const [newAgentDescription, setNewAgentDescription] = useState('')
  const [creatingAgent, setCreatingAgent] = useState(false)
  const [createdApiKey, setCreatedApiKey] = useState<string | null>(null)
  const [showApiKey, setShowApiKey] = useState(false)
  const [copiedKey, setCopiedKey] = useState(false)

  // Delete agent dialog
  const [agentToDelete, setAgentToDelete] = useState<Agent | null>(null)
  const [deletingAgent, setDeletingAgent] = useState(false)

  // Load agents
  const loadAgents = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/dashboard/agents')
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
      const res = await fetch('/api/dashboard/agents', {
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
      const res = await fetch(`/api/dashboard/agents/${agentToDelete.id}`, { method: 'DELETE' })
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

  // Copy API key
  const copyApiKey = async () => {
    if (!createdApiKey) return
    await navigator.clipboard.writeText(createdApiKey)
    setCopiedKey(true)
    setTimeout(() => setCopiedKey(false), 2000)
  }

  // Close create dialog
  const closeCreateDialog = () => {
    setShowCreateAgent(false)
    setCreatedApiKey(null)
    setShowApiKey(false)
    setNewAgentName('')
    setNewAgentDescription('')
  }

  // Toggle agent expansion
  const toggleAgentExpanded = (agentId: string) => {
    setExpandedAgents(prev => {
      const next = new Set(prev)
      if (next.has(agentId)) {
        next.delete(agentId)
      } else {
        next.add(agentId)
      }
      return next
    })
  }

  // Format last seen time
  const formatLastSeen = (lastSeenAt?: string) => {
    if (!lastSeenAt) return 'Never'
    const date = new Date(lastSeenAt)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)

    if (diffMins < 1) return 'Just now'
    if (diffMins < 60) return `${diffMins}m ago`
    const diffHours = Math.floor(diffMins / 60)
    if (diffHours < 24) return `${diffHours}h ago`
    const diffDays = Math.floor(diffHours / 24)
    return `${diffDays}d ago`
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

      {/* Loading state */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : agents.length === 0 ? (
        /* Empty state */
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
        /* Agent list */
        <div className="grid gap-4">
          {agents.map(agent => {
            const isExpanded = expandedAgents.has(agent.id)
            const segments = agent.network_segments || []

            return (
              <Card key={agent.id}>
                <CardContent className="p-0">
                  {/* Agent header */}
                  <div className="p-4 flex items-center gap-4">
                    {/* Status indicator */}
                    <div className={`w-3 h-3 rounded-full shrink-0 ${agent.is_online ? 'bg-status-online' : 'bg-status-offline'}`} />

                    {/* Agent info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="font-medium truncate">{agent.name}</h3>
                        <Badge variant={agent.is_enabled ? 'success' : 'secondary'} className="shrink-0">
                          {agent.is_enabled ? 'Enabled' : 'Disabled'}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground truncate">
                        {agent.description || 'No description'}
                      </p>
                    </div>

                    {/* Agent metadata */}
                    <div className="hidden md:flex items-center gap-6 text-sm text-muted-foreground">
                      {agent.version && (
                        <div>
                          <span className="text-xs uppercase tracking-wide">Version</span>
                          <p className="font-mono">{agent.version}</p>
                        </div>
                      )}
                      {agent.last_ip_address && (
                        <div>
                          <span className="text-xs uppercase tracking-wide">IP Address</span>
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

                    {/* Actions */}
                    <div className="flex items-center gap-2">
                      {segments.length > 0 && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => toggleAgentExpanded(agent.id)}
                          className="gap-1"
                        >
                          {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                          <span className="hidden sm:inline">{segments.length} segment{segments.length !== 1 ? 's' : ''}</span>
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setAgentToDelete(agent)}
                        className="text-destructive hover:text-destructive hover:bg-destructive/10"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  {/* Mobile metadata */}
                  <div className="md:hidden px-4 pb-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                    {agent.version && <span>v{agent.version}</span>}
                    {agent.last_ip_address && <span>{agent.last_ip_address}</span>}
                    <span>Key: {agent.api_key_prefix}...</span>
                    <span>Last seen: {formatLastSeen(agent.last_seen_at)}</span>
                  </div>

                  {/* Expanded segments */}
                  {isExpanded && segments.length > 0 && (
                    <div className="border-t bg-muted/50 p-4">
                      <div className="flex items-center gap-2 mb-3">
                        <Network className="h-4 w-4 text-muted-foreground" />
                        <h4 className="text-sm font-medium">Network Segments</h4>
                      </div>
                      <div className="grid gap-2">
                        {segments.map(segment => (
                          <div
                            key={segment.id}
                            className="flex items-center justify-between p-3 bg-background rounded-lg border"
                          >
                            <div>
                              <p className="font-medium text-sm">{segment.name}</p>
                              <p className="text-xs font-mono text-muted-foreground">{segment.cidr}</p>
                            </div>
                            <div className="flex items-center gap-3 text-sm">
                              <span className="text-muted-foreground">
                                {segment.last_scan_device_count} devices
                              </span>
                              <Badge variant={segment.is_enabled ? 'success' : 'secondary'}>
                                {segment.is_enabled ? 'Active' : 'Disabled'}
                              </Badge>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {/* Create Agent Dialog */}
      <Dialog open={showCreateAgent} onOpenChange={closeCreateDialog}>
        <DialogContent>
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
