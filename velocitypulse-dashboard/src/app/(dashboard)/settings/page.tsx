'use client'

import { useState, useEffect, useCallback } from 'react'
import { useTheme } from 'next-themes'
import { UserProfile } from '@clerk/nextjs'
import {
  Sun, Moon, Monitor, Plus, Trash2, Settings as SettingsIcon,
  Copy, Check, Eye, EyeOff, Server, Network, Loader2, AlertCircle
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import type { Agent, NetworkSegment } from '@/types'

type TabType = 'agents' | 'segments' | 'appearance' | 'account'

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<TabType>('agents')
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  // Agents state
  const [agents, setAgents] = useState<Agent[]>([])
  const [agentsLoading, setAgentsLoading] = useState(true)
  const [agentsError, setAgentsError] = useState<string | null>(null)

  // Segments state
  const [segments, setSegments] = useState<NetworkSegment[]>([])
  const [segmentsLoading, setSegmentsLoading] = useState(true)

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

  useEffect(() => {
    setMounted(true)
  }, [])

  // Load agents
  const loadAgents = useCallback(async () => {
    setAgentsLoading(true)
    setAgentsError(null)
    try {
      const res = await fetch('/api/dashboard/agents')
      if (!res.ok) throw new Error('Failed to load agents')
      const data = await res.json()
      setAgents(data.agents || [])
    } catch (err) {
      setAgentsError(err instanceof Error ? err.message : 'Failed to load agents')
    } finally {
      setAgentsLoading(false)
    }
  }, [])

  // Load segments
  const loadSegments = useCallback(async () => {
    setSegmentsLoading(true)
    try {
      const res = await fetch('/api/dashboard/segments')
      if (!res.ok) throw new Error('Failed to load segments')
      const data = await res.json()
      setSegments(data.segments || [])
    } catch (err) {
      console.error('Failed to load segments:', err)
    } finally {
      setSegmentsLoading(false)
    }
  }, [])

  useEffect(() => {
    loadAgents()
    loadSegments()
  }, [loadAgents, loadSegments])

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
      setAgentsError(err instanceof Error ? err.message : 'Failed to create agent')
    } finally {
      setCreatingAgent(false)
    }
  }

  // Delete agent
  const handleDeleteAgent = async () => {
    if (!agentToDelete) return
    setDeletingAgent(true)
    try {
      const res = await fetch(`/api/agents/${agentToDelete.id}`, { method: 'DELETE' })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to delete agent')
      }
      setAgents(prev => prev.filter(a => a.id !== agentToDelete.id))
      setAgentToDelete(null)
    } catch (err) {
      setAgentsError(err instanceof Error ? err.message : 'Failed to delete agent')
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

  const tabs = [
    { id: 'agents' as TabType, label: 'Agents', icon: Server },
    { id: 'segments' as TabType, label: 'Network Segments', icon: Network },
    { id: 'appearance' as TabType, label: 'Appearance', icon: Sun },
    { id: 'account' as TabType, label: 'Account', icon: SettingsIcon },
  ]

  const themeOptions = [
    { value: 'light', label: 'Light', icon: Sun },
    { value: 'dark', label: 'Dark', icon: Moon },
    { value: 'system', label: 'System', icon: Monitor },
  ]

  if (!mounted) {
    return (
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-8">Settings</h1>
        <div className="h-64 bg-muted animate-pulse rounded-lg" />
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-8">Settings</h1>

      {/* Tabs */}
      <div className="flex gap-2 border-b mb-6 overflow-x-auto">
        {tabs.map(tab => {
          const Icon = tab.icon
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                activeTab === tab.id
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              <Icon className="h-4 w-4" />
              {tab.label}
            </button>
          )
        })}
      </div>

      {agentsError && (
        <div className="mb-6 p-4 bg-destructive/10 border border-destructive/20 rounded-lg flex items-center gap-3 text-destructive">
          <AlertCircle className="h-5 w-5 shrink-0" />
          <p className="text-sm">{agentsError}</p>
          <Button variant="ghost" size="sm" onClick={() => setAgentsError(null)} className="ml-auto">
            Dismiss
          </Button>
        </div>
      )}

      {/* Agents Tab */}
      {activeTab === 'agents' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold">Agents</h2>
              <p className="text-sm text-muted-foreground">
                Manage the agents that monitor your network
              </p>
            </div>
            <Button onClick={() => setShowCreateAgent(true)} className="gap-2">
              <Plus className="h-4 w-4" />
              Add Agent
            </Button>
          </div>

          {agentsLoading ? (
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
            <div className="space-y-4">
              {agents.map(agent => (
                <Card key={agent.id}>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className={`w-3 h-3 rounded-full ${agent.is_online ? 'bg-status-online' : 'bg-status-offline'}`} />
                        <div>
                          <h3 className="font-medium">{agent.name}</h3>
                          <p className="text-sm text-muted-foreground">
                            {agent.description || 'No description'}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-right text-sm">
                          <p className="text-muted-foreground">API Key: {agent.api_key_prefix}...</p>
                          {agent.last_seen_at && (
                            <p className="text-muted-foreground">
                              Last seen: {new Date(agent.last_seen_at).toLocaleString()}
                            </p>
                          )}
                        </div>
                        <Badge variant={agent.is_enabled ? 'success' : 'secondary'}>
                          {agent.is_enabled ? 'Enabled' : 'Disabled'}
                        </Badge>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setAgentToDelete(agent)}
                          className="text-destructive hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Segments Tab */}
      {activeTab === 'segments' && (
        <div className="space-y-6">
          <div>
            <h2 className="text-xl font-semibold">Network Segments</h2>
            <p className="text-sm text-muted-foreground">
              Network segments are automatically created by agents when they scan your network
            </p>
          </div>

          {segmentsLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : segments.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Network className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium mb-2">No network segments</h3>
                <p className="text-sm text-muted-foreground">
                  Segments will appear here once an agent starts scanning your network
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {segments.map(segment => (
                <Card key={segment.id}>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="font-medium">{segment.name}</h3>
                        <p className="text-sm font-mono text-muted-foreground">{segment.cidr}</p>
                      </div>
                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <span>{segment.last_scan_device_count} devices</span>
                        <Badge variant={segment.is_enabled ? 'success' : 'secondary'}>
                          {segment.is_enabled ? 'Active' : 'Disabled'}
                        </Badge>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Appearance Tab */}
      {activeTab === 'appearance' && (
        <div className="space-y-6 max-w-2xl">
          <Card>
            <CardHeader>
              <CardTitle>Theme</CardTitle>
              <CardDescription>Choose your preferred color scheme</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex gap-2">
                {themeOptions.map(option => {
                  const Icon = option.icon
                  const isActive = theme === option.value
                  return (
                    <Button
                      key={option.value}
                      variant={isActive ? 'default' : 'outline'}
                      onClick={() => setTheme(option.value)}
                      className="flex-1 gap-2"
                    >
                      <Icon className="h-4 w-4" />
                      {option.label}
                    </Button>
                  )
                })}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Account Tab */}
      {activeTab === 'account' && (
        <div className="max-w-2xl">
          <UserProfile
            appearance={{
              elements: {
                rootBox: 'w-full',
                card: 'shadow-none border rounded-lg',
              },
            }}
          />
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
                    {showApiKey ? createdApiKey : '•'.repeat(40)}
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
