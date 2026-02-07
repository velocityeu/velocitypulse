'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  CreditCard,
  TrendingUp,
  Building2,
  ExternalLink,
  Search,
  Download,
  ArrowUpRight,
  ArrowDownRight,
} from 'lucide-react'
import { formatCurrency, formatDate } from '@/lib/utils'

interface SubscriptionSummary {
  id: string
  organization_id: string
  organization_name: string
  stripe_subscription_id: string
  plan: 'starter' | 'unlimited'
  status: 'active' | 'past_due' | 'cancelled' | 'incomplete'
  amount_cents: number
  current_period_start: string
  current_period_end: string
  created_at: string
}

interface SubscriptionMetrics {
  mrr: number
  arr: number
  activeCount: number
  pastDueCount: number
  cancelledCount: number
  churnRate: number
  mrrGrowth: number
}

const statusColors: Record<string, string> = {
  active: 'bg-green-500/10 text-green-500',
  past_due: 'bg-orange-500/10 text-orange-500',
  cancelled: 'bg-gray-500/10 text-gray-500',
  incomplete: 'bg-yellow-500/10 text-yellow-500',
}

const planColors: Record<string, string> = {
  starter: 'bg-blue-500/10 text-blue-500',
  unlimited: 'bg-purple-500/10 text-purple-500',
}

export default function SubscriptionsPage() {
  const [subscriptions, setSubscriptions] = useState<SubscriptionSummary[]>([])
  const [metrics, setMetrics] = useState<SubscriptionMetrics | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'active' | 'past_due' | 'cancelled'>('all')
  const [search, setSearch] = useState('')

  useEffect(() => {
    loadSubscriptions()
  }, [])

  async function loadSubscriptions() {
    setIsLoading(true)
    try {
      const response = await fetch('/api/internal/subscriptions')
      if (!response.ok) throw new Error('API error')

      const data = await response.json()
      setSubscriptions(data.subscriptions ?? [])

      if (data.metrics) {
        setMetrics({
          mrr: data.metrics.mrr ?? 0,
          arr: data.metrics.arr ?? 0,
          activeCount: data.metrics.active_count ?? 0,
          pastDueCount: data.metrics.past_due_count ?? 0,
          cancelledCount: data.metrics.cancelled_count ?? 0,
          churnRate: data.metrics.churn_rate ?? 0,
          mrrGrowth: 0,
        })
      }
    } catch (error) {
      console.error('Failed to load subscriptions:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const filteredSubscriptions = subscriptions.filter(sub => {
    if (filter !== 'all' && sub.status !== filter) return false
    if (search && !sub.organization_name.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  async function exportToCSV() {
    const headers = ['Organization', 'Plan', 'Status', 'Amount', 'Period Start', 'Period End', 'Created']
    const rows = filteredSubscriptions.map(sub => [
      sub.organization_name,
      sub.plan,
      sub.status,
      formatCurrency(sub.amount_cents),
      formatDate(sub.current_period_start),
      formatDate(sub.current_period_end),
      formatDate(sub.created_at),
    ])

    const csv = [headers, ...rows].map(row => row.join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `subscriptions-${new Date().toISOString().split('T')[0]}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-48 bg-muted animate-pulse rounded" />
        <div className="grid gap-4 md:grid-cols-4">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="h-32 bg-muted animate-pulse rounded-lg" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Subscriptions</h1>
          <p className="text-muted-foreground">Manage subscriptions and view revenue metrics</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={exportToCSV}>
            <Download className="h-4 w-4 mr-2" />
            Export CSV
          </Button>
          <Button asChild>
            <a
              href="https://dashboard.stripe.com/subscriptions"
              target="_blank"
              rel="noopener noreferrer"
            >
              <CreditCard className="h-4 w-4 mr-2" />
              Stripe Dashboard
              <ExternalLink className="h-3 w-3 ml-2" />
            </a>
          </Button>
        </div>
      </div>

      {/* Metrics */}
      {metrics && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">MRR</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(metrics.mrr)}</div>
              <div className="flex items-center text-xs text-muted-foreground">
                {metrics.mrrGrowth >= 0 ? (
                  <ArrowUpRight className="h-3 w-3 text-green-500 mr-1" />
                ) : (
                  <ArrowDownRight className="h-3 w-3 text-red-500 mr-1" />
                )}
                <span className={metrics.mrrGrowth >= 0 ? 'text-green-500' : 'text-red-500'}>
                  {Math.abs(metrics.mrrGrowth).toFixed(1)}%
                </span>
                <span className="ml-1">from last month</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">ARR</CardTitle>
              <CreditCard className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(metrics.arr)}</div>
              <p className="text-xs text-muted-foreground">Annual recurring revenue</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Subscriptions</CardTitle>
              <Building2 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{metrics.activeCount}</div>
              <p className="text-xs text-muted-foreground">
                {metrics.pastDueCount > 0 && (
                  <span className="text-orange-500">{metrics.pastDueCount} past due</span>
                )}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Churn Rate</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{metrics.churnRate.toFixed(1)}%</div>
              <p className="text-xs text-muted-foreground">{metrics.cancelledCount} cancelled</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Filters */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search organizations..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full h-10 pl-10 pr-4 rounded-md border border-input bg-background text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>
        <div className="flex gap-2">
          {(['all', 'active', 'past_due', 'cancelled'] as const).map((status) => (
            <Button
              key={status}
              variant={filter === status ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilter(status)}
            >
              {status === 'all' ? 'All' : status.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase())}
            </Button>
          ))}
        </div>
      </div>

      {/* Subscriptions Table */}
      <Card>
        <CardHeader>
          <CardTitle>Subscriptions</CardTitle>
          <CardDescription>
            {filteredSubscriptions.length} subscription{filteredSubscriptions.length !== 1 ? 's' : ''} found
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b text-left text-sm text-muted-foreground">
                  <th className="pb-3 font-medium">Organization</th>
                  <th className="pb-3 font-medium">Plan</th>
                  <th className="pb-3 font-medium">Status</th>
                  <th className="pb-3 font-medium">Amount</th>
                  <th className="pb-3 font-medium">Period</th>
                  <th className="pb-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredSubscriptions.map((sub) => (
                  <tr key={sub.id} className="border-b last:border-0">
                    <td className="py-3">
                      <Link
                        href={`/internal/organizations/${sub.organization_id}`}
                        className="font-medium hover:underline"
                      >
                        {sub.organization_name}
                      </Link>
                    </td>
                    <td className="py-3">
                      <Badge className={planColors[sub.plan]}>
                        {sub.plan.charAt(0).toUpperCase() + sub.plan.slice(1)}
                      </Badge>
                    </td>
                    <td className="py-3">
                      <Badge className={statusColors[sub.status]}>
                        {sub.status.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase())}
                      </Badge>
                    </td>
                    <td className="py-3">{formatCurrency(sub.amount_cents)}/yr</td>
                    <td className="py-3 text-sm text-muted-foreground">
                      {formatDate(sub.current_period_start)} - {formatDate(sub.current_period_end)}
                    </td>
                    <td className="py-3">
                      <Button variant="ghost" size="sm" asChild>
                        <a
                          href={`https://dashboard.stripe.com/subscriptions/${sub.stripe_subscription_id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <ExternalLink className="h-4 w-4" />
                        </a>
                      </Button>
                    </td>
                  </tr>
                ))}
                {filteredSubscriptions.length === 0 && (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-muted-foreground">
                      No subscriptions found
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

    </div>
  )
}
