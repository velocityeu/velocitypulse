'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import {
  Building2,
  Users,
  CreditCard,
  TrendingUp,
  Clock,
  CheckCircle,
  XCircle,
} from 'lucide-react'
import { formatCurrency } from '@/lib/utils'

interface DashboardMetrics {
  totalOrganizations: number
  activeOrganizations: number
  trialOrganizations: number
  suspendedOrganizations: number
  totalUsers: number
  mrr: number
  arr: number
  trialConversionRate: number
  expiringTrials: number
  recentSignups: number
  churnedThisMonth: number
}

export default function InternalDashboardPage() {
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    loadMetrics()
  }, [])

  async function loadMetrics() {
    setIsLoading(true)
    try {
      const response = await fetch('/api/internal/metrics')
      if (response.ok) {
        const data = await response.json()
        // Map the nested API response to the flat DashboardMetrics interface
        setMetrics({
          totalOrganizations: data.organizations?.total ?? 0,
          activeOrganizations: data.organizations?.active ?? 0,
          trialOrganizations: data.organizations?.trial ?? 0,
          suspendedOrganizations: data.organizations?.suspended ?? 0,
          totalUsers: data.usage?.total_users ?? 0,
          mrr: data.revenue?.mrr ?? 0,
          arr: data.revenue?.arr ?? 0,
          trialConversionRate: data.organizations?.trial > 0
            ? ((data.conversions?.trial_to_paid_30d ?? 0) / data.organizations.trial) * 100
            : 0,
          expiringTrials: 0, // Calculated client-side from trials endpoint
          recentSignups: 0,
          churnedThisMonth: data.organizations?.cancelled ?? 0,
        })
      }
    } catch (error) {
      console.error('Failed to load metrics:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const data = metrics

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Admin Dashboard</h1>
          <p className="text-muted-foreground">
            Overview of VelocityPulse platform metrics
          </p>
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-32 rounded-lg bg-muted animate-pulse" />
          ))}
        </div>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Admin Dashboard</h1>
          <p className="text-muted-foreground">
            Overview of VelocityPulse platform metrics
          </p>
        </div>
        <Card>
          <CardContent className="p-8 text-center text-muted-foreground">
            Failed to load metrics. Please try again later.
          </CardContent>
        </Card>
      </div>
    )
  }

  const statCards = [
    {
      title: 'Total Organizations',
      value: data.totalOrganizations,
      icon: Building2,
      description: `${data.activeOrganizations} active, ${data.trialOrganizations} trial`,
      color: 'text-blue-500',
      bgColor: 'bg-blue-500/10',
    },
    {
      title: 'Monthly Recurring Revenue',
      value: formatCurrency(data.mrr),
      icon: CreditCard,
      description: `${formatCurrency(data.arr)} ARR`,
      color: 'text-green-500',
      bgColor: 'bg-green-500/10',
    },
    {
      title: 'Total Users',
      value: data.totalUsers,
      icon: Users,
      description: `${(data.totalUsers / data.totalOrganizations).toFixed(1)} avg per org`,
      color: 'text-purple-500',
      bgColor: 'bg-purple-500/10',
    },
    {
      title: 'Trial Conversion',
      value: `${data.trialConversionRate}%`,
      icon: TrendingUp,
      description: `${data.expiringTrials} expiring soon`,
      color: 'text-orange-500',
      bgColor: 'bg-orange-500/10',
    },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Admin Dashboard</h1>
        <p className="text-muted-foreground">
          Overview of VelocityPulse platform metrics
        </p>
      </div>

      {/* Main Stats */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {statCards.map((stat) => (
          <Card key={stat.title}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{stat.title}</CardTitle>
              <div className={`rounded-lg p-2 ${stat.bgColor}`}>
                <stat.icon className={`h-4 w-4 ${stat.color}`} />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stat.value}</div>
              <p className="text-xs text-muted-foreground">{stat.description}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Secondary Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Clock className="h-4 w-4 text-orange-500" />
              Expiring Trials
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-orange-500">{data.expiringTrials}</div>
            <p className="text-xs text-muted-foreground">In the next 3 days</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-green-500" />
              Recent Signups
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-green-500">{data.recentSignups}</div>
            <p className="text-xs text-muted-foreground">This week</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <XCircle className="h-4 w-4 text-red-500" />
              Churned
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-red-500">{data.churnedThisMonth}</div>
            <p className="text-xs text-muted-foreground">This month</p>
          </CardContent>
        </Card>
      </div>

      {/* Organization Status Breakdown */}
      <Card>
        <CardHeader>
          <CardTitle>Organization Status</CardTitle>
          <CardDescription>Breakdown by subscription status</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center">
              <div className="w-32 text-sm text-muted-foreground">Active</div>
              <div className="flex-1">
                <div className="h-4 rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full bg-green-500 rounded-full"
                    style={{ width: `${(data.activeOrganizations / data.totalOrganizations) * 100}%` }}
                  />
                </div>
              </div>
              <div className="w-16 text-right text-sm font-medium">{data.activeOrganizations}</div>
            </div>
            <div className="flex items-center">
              <div className="w-32 text-sm text-muted-foreground">Trial</div>
              <div className="flex-1">
                <div className="h-4 rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full bg-blue-500 rounded-full"
                    style={{ width: `${(data.trialOrganizations / data.totalOrganizations) * 100}%` }}
                  />
                </div>
              </div>
              <div className="w-16 text-right text-sm font-medium">{data.trialOrganizations}</div>
            </div>
            <div className="flex items-center">
              <div className="w-32 text-sm text-muted-foreground">Suspended</div>
              <div className="flex-1">
                <div className="h-4 rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full bg-red-500 rounded-full"
                    style={{ width: `${(data.suspendedOrganizations / data.totalOrganizations) * 100}%` }}
                  />
                </div>
              </div>
              <div className="w-16 text-right text-sm font-medium">{data.suspendedOrganizations}</div>
            </div>
          </div>
        </CardContent>
      </Card>

    </div>
  )
}
