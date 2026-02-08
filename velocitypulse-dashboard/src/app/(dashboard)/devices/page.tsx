'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { authFetch } from '@/lib/auth-fetch'
import {
  Plus, Trash2, Pencil, Search, RefreshCw,
  Loader2, AlertCircle, CheckCircle2, XCircle, AlertTriangle, HelpCircle
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { DeviceEditDialog } from '@/components/devices/DeviceEditDialog'
import type { Device, Category, NetworkSegment } from '@/types'

export default function DevicesPage() {
  const [devices, setDevices] = useState<Device[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [segments, setSegments] = useState<NetworkSegment[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Search
  const [searchQuery, setSearchQuery] = useState('')

  // Edit dialog
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [editingDevice, setEditingDevice] = useState<Device | null>(null)

  // Delete dialog
  const [deviceToDelete, setDeviceToDelete] = useState<Device | null>(null)
  const [deletingDevice, setDeletingDevice] = useState(false)

  // Load data
  const loadData = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const [devicesRes, categoriesRes, segmentsRes] = await Promise.all([
        authFetch('/api/dashboard/devices'),
        authFetch('/api/dashboard/categories'),
        authFetch('/api/dashboard/segments'),
      ])

      if (devicesRes.ok) {
        const data = await devicesRes.json()
        setDevices(data.devices || [])
      }
      if (categoriesRes.ok) {
        const data = await categoriesRes.json()
        setCategories(data.categories || [])
      }
      if (segmentsRes.ok) {
        const data = await segmentsRes.json()
        setSegments(data.segments || [])
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data')
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    loadData()
  }, [loadData])

  // Filtered devices
  const filteredDevices = useMemo(() => {
    if (!searchQuery.trim()) return devices

    const query = searchQuery.toLowerCase()
    return devices.filter(d =>
      d.name.toLowerCase().includes(query) ||
      d.ip_address?.toLowerCase().includes(query) ||
      d.hostname?.toLowerCase().includes(query) ||
      d.mac_address?.toLowerCase().includes(query) ||
      d.manufacturer?.toLowerCase().includes(query)
    )
  }, [devices, searchQuery])

  // Save device (create or update)
  const handleSaveDevice = async (deviceData: Partial<Device>) => {
    if (editingDevice) {
      // Update
      const res = await authFetch(`/api/dashboard/devices/${editingDevice.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(deviceData),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to update device')
      setDevices(prev => prev.map(d => d.id === editingDevice.id ? data.device : d))
    } else {
      // Create
      const res = await authFetch('/api/dashboard/devices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(deviceData),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to create device')
      setDevices(prev => [...prev, data.device])
    }
  }

  // Delete device
  const handleDeleteDevice = async () => {
    if (!deviceToDelete) return
    setDeletingDevice(true)
    try {
      const res = await authFetch(`/api/dashboard/devices/${deviceToDelete.id}`, { method: 'DELETE' })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to delete device')
      }
      setDevices(prev => prev.filter(d => d.id !== deviceToDelete.id))
      setDeviceToDelete(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete device')
    } finally {
      setDeletingDevice(false)
    }
  }

  // Open add dialog
  const openAddDialog = () => {
    setEditingDevice(null)
    setEditDialogOpen(true)
  }

  // Open edit dialog
  const openEditDialog = (device: Device) => {
    setEditingDevice(device)
    setEditDialogOpen(true)
  }

  // Get status icon
  const getStatusIcon = (status: Device['status']) => {
    switch (status) {
      case 'online':
        return <CheckCircle2 className="h-4 w-4 text-status-online" />
      case 'offline':
        return <XCircle className="h-4 w-4 text-status-offline" />
      case 'degraded':
        return <AlertTriangle className="h-4 w-4 text-status-degraded" />
      default:
        return <HelpCircle className="h-4 w-4 text-muted-foreground" />
    }
  }

  // Get status badge variant
  const getStatusVariant = (status: Device['status']): 'success' | 'destructive' | 'warning' | 'secondary' => {
    switch (status) {
      case 'online':
        return 'success'
      case 'offline':
        return 'destructive'
      case 'degraded':
        return 'warning'
      default:
        return 'secondary'
    }
  }

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Devices</h1>
          <p className="text-muted-foreground">
            Manage and monitor your network devices
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={loadData} disabled={isLoading}>
            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
          </Button>
          <Button onClick={openAddDialog}>
            <Plus className="h-4 w-4 mr-2" />
            Add Device
          </Button>
        </div>
      </div>

      {/* Search */}
      <div className="relative w-full sm:w-80">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          placeholder="Search devices..."
          className="pl-9"
        />
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
      ) : filteredDevices.length === 0 ? (
        /* Empty state */
        <Card>
          <CardContent className="py-12 text-center">
            {devices.length === 0 ? (
              <>
                <div className="h-12 w-12 mx-auto text-muted-foreground mb-4 flex items-center justify-center">
                  <CheckCircle2 className="h-12 w-12" />
                </div>
                <h3 className="text-lg font-medium mb-2">No devices yet</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Add your first device to start monitoring
                </p>
                <Button onClick={openAddDialog}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add your first device
                </Button>
              </>
            ) : (
              <>
                <Search className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium mb-2">No devices found</h3>
                <p className="text-sm text-muted-foreground">
                  No devices match your search &quot;{searchQuery}&quot;
                </p>
              </>
            )}
          </CardContent>
        </Card>
      ) : (
        /* Device table */
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="text-left p-3 text-sm font-medium text-muted-foreground">Status</th>
                    <th className="text-left p-3 text-sm font-medium text-muted-foreground">Name</th>
                    <th className="text-left p-3 text-sm font-medium text-muted-foreground hidden sm:table-cell">IP Address</th>
                    <th className="text-left p-3 text-sm font-medium text-muted-foreground hidden md:table-cell">Manufacturer</th>
                    <th className="text-left p-3 text-sm font-medium text-muted-foreground hidden lg:table-cell">Category</th>
                    <th className="text-right p-3 text-sm font-medium text-muted-foreground">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredDevices.map(device => (
                    <tr
                      key={device.id}
                      className="border-b last:border-0 hover:bg-muted/50 transition-colors cursor-pointer"
                      onClick={() => openEditDialog(device)}
                    >
                      <td className="p-3">
                        <div className="flex items-center gap-2">
                          {getStatusIcon(device.status)}
                          <Badge variant={getStatusVariant(device.status)} className="capitalize hidden sm:inline-flex">
                            {device.status}
                          </Badge>
                        </div>
                      </td>
                      <td className="p-3">
                        <div>
                          <p className="font-medium">{device.name}</p>
                          {device.hostname && (
                            <p className="text-xs text-muted-foreground font-mono">{device.hostname}</p>
                          )}
                        </div>
                      </td>
                      <td className="p-3 font-mono text-sm hidden sm:table-cell">
                        {device.ip_address || '-'}
                      </td>
                      <td className="p-3 text-sm hidden md:table-cell">
                        {device.manufacturer || '-'}
                      </td>
                      <td className="p-3 hidden lg:table-cell">
                        {device.category ? (
                          <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-xs">
                            {device.category.icon && <span className="mr-1">{device.category.icon}</span>}
                            {device.category.name}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </td>
                      <td className="p-3">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={e => {
                              e.stopPropagation()
                              openEditDialog(device)
                            }}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                            onClick={e => {
                              e.stopPropagation()
                              setDeviceToDelete(device)
                            }}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Device count */}
      {!isLoading && filteredDevices.length > 0 && (
        <p className="text-sm text-muted-foreground">
          Showing {filteredDevices.length} of {devices.length} device{devices.length !== 1 ? 's' : ''}
        </p>
      )}

      {/* Edit/Add Dialog */}
      <DeviceEditDialog
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        device={editingDevice}
        categories={categories}
        segments={segments}
        onSave={handleSaveDevice}
      />

      {/* Delete Dialog */}
      <Dialog open={!!deviceToDelete} onOpenChange={() => setDeviceToDelete(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-destructive">Delete Device</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete &quot;{deviceToDelete?.name}&quot;?
            </DialogDescription>
          </DialogHeader>

          <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-lg text-sm">
            <p className="text-muted-foreground">
              This will permanently delete this device and all its monitoring history.
            </p>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDeviceToDelete(null)} disabled={deletingDevice}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDeleteDevice} disabled={deletingDevice}>
              {deletingDevice ? 'Deleting...' : 'Delete Device'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
