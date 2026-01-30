'use client'

import { useMemo, useState } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { DeviceCard } from './DeviceCard'
import { DeviceCardCompact } from './DeviceCardCompact'
import { DeviceListRow } from './DeviceListRow'
import { DeviceDetailModal } from './DeviceDetailModal'
import { Button } from '@/components/ui/button'
import type { Device, Category, NetworkSegment, ViewMode, DeviceSegmentGroup } from '@/types'

interface DeviceGridProps {
  devices: Device[]
  categories: Category[]
  segments: NetworkSegment[]
  isLoading?: boolean
  viewMode?: ViewMode
  groupBySegment?: boolean
  onDeviceClick?: (device: Device) => void
}

export function DeviceGrid({
  devices,
  categories,
  segments,
  isLoading = false,
  viewMode = 'grid',
  groupBySegment = false,
  onDeviceClick,
}: DeviceGridProps) {
  const [selectedDevice, setSelectedDevice] = useState<Device | null>(null)
  const [collapsedSegments, setCollapsedSegments] = useState<Set<string>>(new Set())

  // Create category lookup map
  const categoryMap = useMemo(() => {
    const map = new Map<string, Category>()
    categories.forEach(cat => map.set(cat.id, cat))
    return map
  }, [categories])

  // Group devices by segment if enabled
  const deviceGroups: DeviceSegmentGroup[] = useMemo(() => {
    if (!groupBySegment || segments.length === 0) {
      return [{ segment: null, devices }]
    }

    const segmentMap = new Map<string, NetworkSegment>()
    segments.forEach(seg => segmentMap.set(seg.id, seg))

    const groups = new Map<string | null, Device[]>()
    groups.set(null, []) // Ungrouped devices

    segments.forEach(seg => groups.set(seg.id, []))

    devices.forEach(device => {
      const segmentId = device.network_segment_id || null
      const group = groups.get(segmentId) || groups.get(null)!
      group.push(device)
    })

    return Array.from(groups.entries())
      .filter(([, devs]) => devs.length > 0)
      .map(([segmentId, devs]) => ({
        segment: segmentId ? segmentMap.get(segmentId) || null : null,
        devices: devs,
      }))
  }, [devices, segments, groupBySegment])

  const handleDeviceClick = (device: Device) => {
    setSelectedDevice(device)
    onDeviceClick?.(device)
  }

  const toggleSegmentCollapse = (segmentId: string | null) => {
    const key = segmentId || 'ungrouped'
    setCollapsedSegments(prev => {
      const newSet = new Set(prev)
      if (newSet.has(key)) {
        newSet.delete(key)
      } else {
        newSet.add(key)
      }
      return newSet
    })
  }

  // Loading skeleton
  if (isLoading) {
    return (
      <div className={viewMode === 'grid' ? 'grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4' : 'space-y-2'}>
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className={viewMode === 'grid' ? 'h-48 rounded-lg bg-muted animate-pulse' : 'h-16 rounded-lg bg-muted animate-pulse'} />
        ))}
      </div>
    )
  }

  // Empty state
  if (devices.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <div className="rounded-full bg-muted p-4 mb-4">
          <svg
            className="h-8 w-8 text-muted-foreground"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
        </div>
        <h3 className="text-lg font-medium text-foreground">No devices found</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Install an agent to start discovering devices on your network.
        </p>
      </div>
    )
  }

  // Grid class based on view mode
  const getGridClass = () => {
    switch (viewMode) {
      case 'grid':
        return 'grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4'
      case 'compact':
        return 'grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4'
      case 'list':
        return 'space-y-2'
      default:
        return 'grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4'
    }
  }

  // Render device based on view mode
  const renderDevice = (device: Device) => {
    const category = device.category_id ? categoryMap.get(device.category_id) : undefined

    switch (viewMode) {
      case 'compact':
        return (
          <DeviceCardCompact
            key={device.id}
            device={device}
            category={category}
            onClick={() => handleDeviceClick(device)}
          />
        )
      case 'list':
        return (
          <DeviceListRow
            key={device.id}
            device={device}
            category={category}
            onClick={() => handleDeviceClick(device)}
          />
        )
      case 'grid':
      default:
        return (
          <DeviceCard
            key={device.id}
            device={device}
            category={category}
            onClick={() => handleDeviceClick(device)}
          />
        )
    }
  }

  // Render device groups
  return (
    <>
      <div className="space-y-8">
        {deviceGroups.map((group, groupIndex) => {
          const segmentKey = group.segment?.id || 'ungrouped'
          const isCollapsed = collapsedSegments.has(segmentKey)

          return (
            <div key={group.segment?.id || `ungrouped-${groupIndex}`}>
              {/* Segment header */}
              {groupBySegment && (
                <div className="mb-4">
                  <Button
                    variant="ghost"
                    className="gap-2 p-0 h-auto hover:bg-transparent"
                    onClick={() => toggleSegmentCollapse(group.segment?.id || null)}
                  >
                    {isCollapsed ? (
                      <ChevronRight className="h-5 w-5 text-muted-foreground" />
                    ) : (
                      <ChevronDown className="h-5 w-5 text-muted-foreground" />
                    )}
                    <h2 className="text-lg font-semibold text-foreground">
                      {group.segment?.name || 'Ungrouped Devices'}
                    </h2>
                    <span className="text-sm text-muted-foreground">
                      ({group.devices.length})
                    </span>
                  </Button>
                  {group.segment?.cidr && !isCollapsed && (
                    <p className="text-sm text-muted-foreground font-mono ml-7">
                      {group.segment.cidr}
                    </p>
                  )}
                </div>
              )}

              {/* Device grid */}
              {!isCollapsed && (
                <div className={getGridClass()}>
                  {group.devices.map(device => renderDevice(device))}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Device Detail Modal */}
      {selectedDevice && (
        <DeviceDetailModal
          device={selectedDevice}
          category={selectedDevice.category_id ? categoryMap.get(selectedDevice.category_id) : undefined}
          isOpen={!!selectedDevice}
          onClose={() => setSelectedDevice(null)}
        />
      )}
    </>
  )
}
