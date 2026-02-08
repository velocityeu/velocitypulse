'use client'

import { useEffect, useState } from 'react'
import { authFetch } from '@/lib/auth-fetch'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import Link from 'next/link'

interface UsageData {
  usage: {
    devices: { current: number; limit: number }
    agents: { current: number; limit: number }
    members: { current: number; limit: number }
  }
  plan: string
  recentActivity: Array<{ action: string; created_at: string }>
}

function UsageBar({ label, current, limit }: { label: string; current: number; limit: number }) {
  const percentage = limit > 0 ? Math.min((current / limit) * 100, 100) : 0
  const isWarning = percentage > 80
  const isDanger = percentage > 95

  return (
    <div className="space-y-2">
      <div className="flex justify-between text-sm">
        <span className="font-medium">{label}</span>
        <span className="text-muted-foreground">{current} / {limit}</span>
      </div>
      <div className="h-2 rounded-full bg-muted overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${
            isDanger ? 'bg-red-500' : isWarning ? 'bg-yellow-500' : 'bg-primary'
          }`}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  )
}

export default function UsagePage() {
  const [data, setData] = useState<UsageData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    authFetch('/api/dashboard/usage')
      .then(res => res.json())
      .then(setData)
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-bold mb-6">Usage</h1>
        <div className="animate-pulse space-y-4">
          <div className="h-32 bg-muted rounded-lg" />
          <div className="h-32 bg-muted rounded-lg" />
        </div>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-bold mb-6">Usage</h1>
        <p className="text-muted-foreground">Failed to load usage data.</p>
      </div>
    )
  }

  const showUpgrade = data.plan === 'trial' || data.plan === 'starter'

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Usage</h1>
        <Badge variant="outline" className="capitalize">{data.plan} Plan</Badge>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Resource Usage</CardTitle>
            <CardDescription>Current usage across your organization</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <UsageBar label="Devices" current={data.usage.devices.current} limit={data.usage.devices.limit} />
            <UsageBar label="Agents" current={data.usage.agents.current} limit={data.usage.agents.limit} />
            <UsageBar label="Members" current={data.usage.members.current} limit={data.usage.members.limit} />
          </CardContent>
        </Card>

        <Card className="md:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Recent Activity</CardTitle>
            <CardDescription>Latest actions in your organization</CardDescription>
          </CardHeader>
          <CardContent>
            {data.recentActivity.length === 0 ? (
              <p className="text-sm text-muted-foreground">No recent activity</p>
            ) : (
              <ul className="space-y-2 max-h-64 overflow-auto">
                {data.recentActivity.slice(0, 20).map((activity, i) => (
                  <li key={i} className="flex items-center justify-between text-sm border-b pb-2 last:border-0">
                    <span className="font-mono text-xs">{activity.action}</span>
                    <span className="text-muted-foreground text-xs">
                      {new Date(activity.created_at).toLocaleString()}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      {showUpgrade && (
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="flex items-center justify-between py-4">
            <div>
              <p className="font-medium">Need more resources?</p>
              <p className="text-sm text-muted-foreground">
                Upgrade your plan for higher limits and premium features.
              </p>
            </div>
            <Link href="/billing">
              <Button>Upgrade Plan</Button>
            </Link>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
