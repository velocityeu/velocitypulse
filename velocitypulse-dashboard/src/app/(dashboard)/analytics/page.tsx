'use client'

import { useState, useEffect, useCallback } from 'react'
import { authFetch } from '@/lib/auth-fetch'
import { Loader2, BarChart3, Clock, Activity, Wifi } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useOrganization } from '@/lib/contexts/OrganizationContext'
import type { AnalyticsTimeRange, AnalyticsResponse, DeviceUptimeStats, DeviceStatusHistoryRecord } from '@/types'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts'

const TIME_RANGES: { value: AnalyticsTimeRange; label: string }[] = [
  { value: '24h', label: '24 Hours' },
  { value: '7d', label: '7 Days' },
  { value: '30d', label: '30 Days' },
]

// Colors for different devices on charts
const DEVICE_COLORS = [
  '#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6',
  '#06B6D4', '#EC4899', '#F97316', '#14B8A6', '#6366F1',
]

export default function AnalyticsPage() {
  const { organization } = useOrganization()
  const [range, setRange] = useState<AnalyticsTimeRange>('24h')
  const [deviceId, setDeviceId] = useState<string>('')
  const [data, setData] = useState<AnalyticsResponse | null>(null)
  const [devices, setDevices] = useState<{ id: string; name: string }[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Fetch devices list
  useEffect(() => {
    if (!organization) return

    async function fetchDevices() {
      try {
        const response = await authFetch('/api/dashboard/analytics?range=24h')
        if (response.ok) {
          const result: AnalyticsResponse = await response.json()
          const deviceList = result.uptime.map(u => ({
            id: u.device_id,
            name: u.device_name,
          }))
          setDevices(deviceList)
        }
      } catch {
        // Non-fatal
      }
    }

    fetchDevices()
  }, [organization])

  // Fetch analytics data
  const fetchAnalytics = useCallback(async () => {
    if (!organization) return

    setLoading(true)
    setError(null)

    try {
      const params = new URLSearchParams({ range })
      if (deviceId) params.set('deviceId', deviceId)

      const response = await authFetch(`/api/dashboard/analytics?${params}`)

      if (!response.ok) {
        const result = await response.json()
        throw new Error(result.error || 'Failed to fetch analytics')
      }

      const result: AnalyticsResponse = await response.json()
      setData(result)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load analytics')
    } finally {
      setLoading(false)
    }
  }, [organization, range, deviceId])

  useEffect(() => {
    fetchAnalytics()
  }, [fetchAnalytics])

  // Prepare chart data: group by time buckets
  const chartData = prepareChartData(data?.history || [], range)

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <BarChart3 className="h-6 w-6" />
            Analytics
          </h1>
          <p className="text-muted-foreground">
            Device performance and uptime metrics
          </p>
        </div>

        <div className="flex gap-2 flex-wrap">
          {/* Time range selector */}
          {TIME_RANGES.map(tr => (
            <Button
              key={tr.value}
              variant={range === tr.value ? 'default' : 'outline'}
              size="sm"
              onClick={() => setRange(tr.value)}
            >
              {tr.label}
            </Button>
          ))}
        </div>
      </div>

      {/* Device selector */}
      <div className="flex items-center gap-3">
        <label className="text-sm font-medium">Device:</label>
        <select
          value={deviceId}
          onChange={e => setDeviceId(e.target.value)}
          className="rounded-md border border-input bg-background px-3 py-1.5 text-sm"
        >
          <option value="">All Devices</option>
          {devices.map(d => (
            <option key={d.id} value={d.id}>{d.name}</option>
          ))}
        </select>
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="p-4 rounded-md bg-destructive/10 border border-destructive/20 text-destructive">
          {error}
        </div>
      )}

      {/* Content */}
      {!loading && !error && data && (
        <>
          {/* Uptime cards */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {data.uptime.slice(0, 8).map((stat, i) => (
              <UptimeCard key={stat.device_id} stat={stat} color={DEVICE_COLORS[i % DEVICE_COLORS.length]} />
            ))}
          </div>

          {/* No data state */}
          {data.history.length === 0 && (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                <Activity className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium mb-2">No analytics data yet</h3>
                <p className="text-sm text-muted-foreground max-w-md">
                  Analytics data is collected automatically when your agents report device status.
                  Check back after your agents have been running for a while.
                </p>
              </CardContent>
            </Card>
          )}

          {/* Response time chart */}
          {data.history.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="h-5 w-5" />
                  Response Time
                </CardTitle>
                <CardDescription>Average response time in milliseconds over time</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis
                        dataKey="time"
                        className="text-xs"
                        tick={{ fontSize: 11 }}
                      />
                      <YAxis
                        className="text-xs"
                        tick={{ fontSize: 11 }}
                        label={{ value: 'ms', angle: -90, position: 'insideLeft', style: { fontSize: 11 } }}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: 'hsl(var(--card))',
                          border: '1px solid hsl(var(--border))',
                          borderRadius: '8px',
                          fontSize: 12,
                        }}
                      />
                      <Legend />
                      {getUniqueDeviceIds(data.history).slice(0, 10).map((id, i) => {
                        const name = data.uptime.find(u => u.device_id === id)?.device_name || id.slice(0, 8)
                        return (
                          <Line
                            key={id}
                            type="monotone"
                            dataKey={id}
                            name={name}
                            stroke={DEVICE_COLORS[i % DEVICE_COLORS.length]}
                            strokeWidth={2}
                            dot={false}
                            connectNulls
                          />
                        )
                      })}
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Status timeline */}
          {data.history.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Wifi className="h-5 w-5" />
                  Device Status Timeline
                </CardTitle>
                <CardDescription>Recent status changes across your devices</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 max-h-[400px] overflow-y-auto">
                  {data.history.slice(-50).reverse().map(record => {
                    const deviceName = data.uptime.find(u => u.device_id === record.device_id)?.device_name || record.device_id.slice(0, 8)
                    return (
                      <div key={record.id} className="flex items-center gap-3 py-1.5 text-sm border-b border-border/50 last:border-0">
                        <StatusDot status={record.status} />
                        <span className="font-medium min-w-[120px]">{deviceName}</span>
                        <span className="text-muted-foreground capitalize">{record.status}</span>
                        {record.response_time_ms != null && (
                          <span className="text-muted-foreground">{record.response_time_ms}ms</span>
                        )}
                        <span className="text-muted-foreground ml-auto text-xs">
                          {new Date(record.checked_at).toLocaleString()}
                        </span>
                      </div>
                    )
                  })}
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  )
}

// --- Helper Components ---

function UptimeCard({ stat, color }: { stat: DeviceUptimeStats; color: string }) {
  const uptimeColor = stat.uptime_percentage >= 99 ? 'text-green-600 dark:text-green-400'
    : stat.uptime_percentage >= 95 ? 'text-yellow-600 dark:text-yellow-400'
    : 'text-red-600 dark:text-red-400'

  return (
    <Card>
      <CardContent className="pt-4">
        <div className="flex items-center gap-2 mb-2">
          <div className="h-3 w-3 rounded-full" style={{ backgroundColor: color }} />
          <span className="text-sm font-medium truncate">{stat.device_name}</span>
        </div>
        <div className={`text-2xl font-bold ${uptimeColor}`}>
          {stat.uptime_percentage.toFixed(1)}%
        </div>
        <div className="text-xs text-muted-foreground mt-1">
          {stat.avg_response_time_ms != null ? `${stat.avg_response_time_ms}ms avg` : 'No response data'}
          {' · '}
          {stat.total_checks} checks
        </div>
      </CardContent>
    </Card>
  )
}

function StatusDot({ status }: { status: string }) {
  const color = status === 'online' ? 'bg-green-500'
    : status === 'degraded' ? 'bg-yellow-500'
    : status === 'offline' ? 'bg-red-500'
    : 'bg-gray-400'

  return <div className={`h-2 w-2 rounded-full ${color}`} />
}

// --- Data Helpers ---

function getUniqueDeviceIds(history: DeviceStatusHistoryRecord[]): string[] {
  return [...new Set(history.map(r => r.device_id))]
}

function prepareChartData(
  history: DeviceStatusHistoryRecord[],
  range: AnalyticsTimeRange
): Record<string, string | number | null>[] {
  if (history.length === 0) return []

  // Determine bucket size based on range
  const bucketMs = range === '24h' ? 30 * 60 * 1000 // 30 min
    : range === '7d' ? 4 * 60 * 60 * 1000 // 4 hours
    : 24 * 60 * 60 * 1000 // 1 day

  const buckets = new Map<number, Map<string, number[]>>()

  for (const record of history) {
    const time = new Date(record.checked_at).getTime()
    const bucketKey = Math.floor(time / bucketMs) * bucketMs

    if (!buckets.has(bucketKey)) {
      buckets.set(bucketKey, new Map())
    }

    const bucket = buckets.get(bucketKey)!
    if (!bucket.has(record.device_id)) {
      bucket.set(record.device_id, [])
    }

    if (record.response_time_ms != null) {
      bucket.get(record.device_id)!.push(record.response_time_ms)
    }
  }

  // Convert to chart data
  const sortedBuckets = [...buckets.entries()].sort(([a], [b]) => a - b)

  return sortedBuckets.map(([timestamp, deviceMap]) => {
    const point: Record<string, string | number | null> = {
      time: formatTimestamp(timestamp, range),
    }

    for (const [deviceId, values] of deviceMap) {
      if (values.length > 0) {
        point[deviceId] = Math.round(values.reduce((a, b) => a + b, 0) / values.length)
      }
    }

    return point
  })
}

function formatTimestamp(ts: number, range: AnalyticsTimeRange): string {
  const date = new Date(ts)
  if (range === '24h') {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }
  if (range === '7d') {
    return date.toLocaleDateString([], { weekday: 'short', hour: '2-digit' })
  }
  return date.toLocaleDateString([], { month: 'short', day: 'numeric' })
}
