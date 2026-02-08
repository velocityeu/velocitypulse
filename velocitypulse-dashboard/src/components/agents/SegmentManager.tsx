'use client'

import { useState } from 'react'
import { authFetch } from '@/lib/auth-fetch'
import { Plus, Trash2, Loader2, Network, Calculator } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { SubnetCalculator } from '@/components/agents/SubnetCalculator'
import type { NetworkSegment } from '@/types'

interface SegmentManagerProps {
  agentId: string
  segments: NetworkSegment[]
  onSegmentAdded: (segment: NetworkSegment) => void
  onSegmentDeleted: (segmentId: string) => void
  onSegmentUpdated: (segment: NetworkSegment) => void
}

export function SegmentManager({
  agentId,
  segments,
  onSegmentAdded,
  onSegmentDeleted,
  onSegmentUpdated,
}: SegmentManagerProps) {
  // Add segment form
  const [showAddForm, setShowAddForm] = useState(false)
  const [newName, setNewName] = useState('')
  const [newCidr, setNewCidr] = useState('')
  const [adding, setAdding] = useState(false)
  const [addError, setAddError] = useState<string | null>(null)

  // Delete dialog
  const [segmentToDelete, setSegmentToDelete] = useState<NetworkSegment | null>(null)
  const [deleting, setDeleting] = useState(false)

  // Subnet calculator
  const [showCalculator, setShowCalculator] = useState(false)

  // Edit state
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [editCidr, setEditCidr] = useState('')

  const handleAdd = async () => {
    setAdding(true)
    setAddError(null)
    try {
      const res = await authFetch(`/api/dashboard/agents/${agentId}/segments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName, cidr: newCidr }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to add segment')
      onSegmentAdded(data.segment)
      setNewName('')
      setNewCidr('')
      setShowAddForm(false)
    } catch (err) {
      setAddError(err instanceof Error ? err.message : 'Failed to add segment')
    } finally {
      setAdding(false)
    }
  }

  const handleDelete = async () => {
    if (!segmentToDelete) return
    setDeleting(true)
    try {
      const res = await authFetch(`/api/segments/${segmentToDelete.id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Failed to delete segment')
      onSegmentDeleted(segmentToDelete.id)
      setSegmentToDelete(null)
    } catch {
      // Error handling
    } finally {
      setDeleting(false)
    }
  }

  const handleToggleEnabled = async (segment: NetworkSegment) => {
    try {
      const res = await authFetch(`/api/segments/${segment.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_enabled: !segment.is_enabled }),
      })
      if (!res.ok) return
      const data = await res.json()
      onSegmentUpdated(data.segment || { ...segment, is_enabled: !segment.is_enabled })
    } catch {
      // Silently fail
    }
  }

  const handleSaveEdit = async (segment: NetworkSegment) => {
    try {
      const res = await authFetch(`/api/segments/${segment.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: editName, cidr: editCidr }),
      })
      if (!res.ok) return
      const data = await res.json()
      onSegmentUpdated(data.segment || { ...segment, name: editName, cidr: editCidr })
      setEditingId(null)
    } catch {
      // Silently fail
    }
  }

  const startEdit = (segment: NetworkSegment) => {
    setEditingId(segment.id)
    setEditName(segment.name)
    setEditCidr(segment.cidr)
  }

  const formatLastScan = (dateStr?: string) => {
    if (!dateStr) return 'Never'
    const diff = Date.now() - new Date(dateStr).getTime()
    const mins = Math.floor(diff / 60000)
    if (mins < 1) return 'Just now'
    if (mins < 60) return `${mins}m ago`
    const hours = Math.floor(mins / 60)
    if (hours < 24) return `${hours}h ago`
    return `${Math.floor(hours / 24)}d ago`
  }

  return (
    <div className="border-t">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 bg-muted/30">
        <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
          <Network className="h-4 w-4" />
          Network Segments ({segments.length})
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => setShowCalculator(true)}
            title="Subnet Calculator"
          >
            <Calculator className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs"
            onClick={() => setShowAddForm(true)}
          >
            <Plus className="h-3.5 w-3.5 mr-1" />
            Add
          </Button>
        </div>
      </div>

      {/* Segment list */}
      <div className="divide-y">
        {segments.map(segment => (
          <div key={segment.id} className="px-4 py-2 flex items-center gap-3 text-sm hover:bg-muted/30 transition-colors">
            {editingId === segment.id ? (
              // Edit mode
              <div className="flex-1 flex items-center gap-2">
                <Input
                  value={editName}
                  onChange={e => setEditName(e.target.value)}
                  className="h-7 text-sm w-36"
                  placeholder="Name"
                />
                <Input
                  value={editCidr}
                  onChange={e => setEditCidr(e.target.value)}
                  className="h-7 text-sm w-40 font-mono"
                  placeholder="CIDR"
                />
                <Button size="sm" className="h-7 text-xs" onClick={() => handleSaveEdit(segment)}>
                  Save
                </Button>
                <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setEditingId(null)}>
                  Cancel
                </Button>
              </div>
            ) : (
              // View mode
              <>
                <button
                  className="h-4 w-8 rounded-full relative cursor-pointer transition-colors"
                  style={{ backgroundColor: segment.is_enabled ? 'hsl(var(--status-online))' : 'hsl(var(--muted))' }}
                  onClick={() => handleToggleEnabled(segment)}
                  title={segment.is_enabled ? 'Disable' : 'Enable'}
                >
                  <span
                    className="absolute top-0.5 h-3 w-3 rounded-full bg-white transition-transform"
                    style={{ transform: segment.is_enabled ? 'translateX(16px)' : 'translateX(2px)' }}
                  />
                </button>
                <span
                  className="font-medium cursor-pointer hover:underline"
                  onClick={() => startEdit(segment)}
                  title="Click to edit"
                >
                  {segment.name}
                </span>
                <span className="font-mono text-muted-foreground">{segment.cidr}</span>
                <span className="text-muted-foreground text-xs hidden md:inline">
                  Last scan: {formatLastScan(segment.last_scan_at)}
                </span>
                {segment.last_scan_device_count > 0 && (
                  <Badge variant="secondary" className="text-xs">
                    {segment.last_scan_device_count} devices
                  </Badge>
                )}
                <div className="ml-auto">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 text-destructive hover:text-destructive"
                    onClick={() => setSegmentToDelete(segment)}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </>
            )}
          </div>
        ))}

        {segments.length === 0 && !showAddForm && (
          <div className="px-4 py-4 text-sm text-muted-foreground text-center">
            No segments configured. Add a segment to start scanning.
          </div>
        )}
      </div>

      {/* Add segment inline form */}
      {showAddForm && (
        <div className="px-4 py-3 border-t bg-muted/20">
          <div className="flex items-center gap-2">
            <Input
              placeholder="Segment name"
              value={newName}
              onChange={e => setNewName(e.target.value)}
              className="h-8 text-sm w-40"
            />
            <Input
              placeholder="192.168.1.0/24"
              value={newCidr}
              onChange={e => setNewCidr(e.target.value)}
              className="h-8 text-sm w-44 font-mono"
            />
            <Button
              size="sm"
              className="h-8"
              onClick={handleAdd}
              disabled={adding || !newName.trim() || !newCidr.trim()}
            >
              {adding ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Add'}
            </Button>
            <Button variant="ghost" size="sm" className="h-8" onClick={() => { setShowAddForm(false); setAddError(null) }}>
              Cancel
            </Button>
          </div>
          {addError && (
            <p className="text-xs text-destructive mt-1">{addError}</p>
          )}
        </div>
      )}

      {/* Delete dialog */}
      <Dialog open={!!segmentToDelete} onOpenChange={() => setSegmentToDelete(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-destructive">Delete Segment</DialogTitle>
            <DialogDescription>
              Delete &ldquo;{segmentToDelete?.name}&rdquo; ({segmentToDelete?.cidr})?
              Devices in this segment will not be deleted.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSegmentToDelete(null)} disabled={deleting}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
              {deleting ? 'Deleting...' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Subnet Calculator */}
      <SubnetCalculator open={showCalculator} onOpenChange={setShowCalculator} />
    </div>
  )
}
