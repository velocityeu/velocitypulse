'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Clock,
  AlertTriangle,
  Calendar,
  Building2,
  ChevronRight,
  CheckCircle,
} from 'lucide-react'
import { formatDate, getDaysUntilTrialExpires } from '@/lib/utils'
import type { Organization } from '@/types'

interface TrialOrganization extends Organization {
  member_count?: number
  device_count?: number
}

export default function TrialsPage() {
  const [trials, setTrials] = useState<TrialOrganization[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  useEffect(() => {
    loadTrials()
  }, [])

  async function loadTrials() {
    setIsLoading(true)
    try {
      const response = await fetch('/api/internal/trials')
      if (response.ok) {
        const data = await response.json()
        setTrials(data.trials)
      }
    } catch (error) {
      console.error('Failed to load trials:', error)
    } finally {
      setIsLoading(false)
    }
  }

  async function extendTrial(orgId: string, days: number) {
    setActionLoading(orgId)
    try {
      const response = await fetch(`/api/internal/organizations/${orgId}/actions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'extend_trial', days }),
      })
      if (response.ok) {
        await loadTrials()
      }
    } catch (error) {
      console.error('Failed to extend trial:', error)
    } finally {
      setActionLoading(null)
    }
  }

  const data = trials

  // Categorize trials
  const expiringTrials = data.filter(t => {
    const days = getDaysUntilTrialExpires(t.trial_ends_at)
    return t.status === 'trial' && days >= 0 && days <= 3
  })

  const activeTrials = data.filter(t => {
    const days = getDaysUntilTrialExpires(t.trial_ends_at)
    return t.status === 'trial' && days > 3
  })

  const expiredTrials = data.filter(t => {
    const days = getDaysUntilTrialExpires(t.trial_ends_at)
    return days < 0 || t.status === 'suspended'
  })

  function TrialCard({ org, showUrgent = false }: { org: TrialOrganization; showUrgent?: boolean }) {
    const daysLeft = getDaysUntilTrialExpires(org.trial_ends_at)
    const isExpired = daysLeft < 0

    return (
      <Card className={showUrgent ? 'border-orange-500' : ''}>
        <CardContent className="p-4">
          <div className="flex items-center gap-4">
            <div className={`flex h-12 w-12 items-center justify-center rounded-lg ${
              isExpired ? 'bg-red-500/10' : showUrgent ? 'bg-orange-500/10' : 'bg-blue-500/10'
            }`}>
              {isExpired ? (
                <AlertTriangle className="h-6 w-6 text-red-500" />
              ) : (
                <Clock className={`h-6 w-6 ${showUrgent ? 'text-orange-500' : 'text-blue-500'}`} />
              )}
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="font-semibold truncate">{org.name}</h3>
                {isExpired ? (
                  <Badge variant="destructive">Expired</Badge>
                ) : showUrgent ? (
                  <Badge className="bg-orange-500/10 text-orange-500">
                    {daysLeft} day{daysLeft !== 1 ? 's' : ''} left
                  </Badge>
                ) : (
                  <Badge className="bg-blue-500/10 text-blue-500">
                    {daysLeft} days left
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground">
                <span className="font-mono">{org.customer_number}</span>
                <span>Started {formatDate(org.created_at)}</span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => extendTrial(org.id, 7)}
                disabled={actionLoading === org.id}
              >
                <Calendar className="h-3 w-3 mr-1" />
                +7 days
              </Button>
              <Link href={`/internal/organizations/${org.id}`}>
                <Button variant="ghost" size="icon">
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </Link>
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Trial Management</h1>
        <p className="text-muted-foreground">
          Monitor and manage trial organizations
        </p>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-orange-500" />
              Expiring Soon
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-orange-500">{expiringTrials.length}</div>
            <p className="text-xs text-muted-foreground">Within 3 days</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Clock className="h-4 w-4 text-blue-500" />
              Active Trials
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-blue-500">{activeTrials.length}</div>
            <p className="text-xs text-muted-foreground">More than 3 days left</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-red-500" />
              Expired
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-red-500">{expiredTrials.length}</div>
            <p className="text-xs text-muted-foreground">Needs attention</p>
          </CardContent>
        </Card>
      </div>

      {/* Expiring Soon */}
      {expiringTrials.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-orange-500" />
            Expiring Soon
          </h2>
          {expiringTrials.map((org) => (
            <TrialCard key={org.id} org={org} showUrgent />
          ))}
        </div>
      )}

      {/* Active Trials */}
      {activeTrials.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Clock className="h-5 w-5 text-blue-500" />
            Active Trials
          </h2>
          {activeTrials.map((org) => (
            <TrialCard key={org.id} org={org} />
          ))}
        </div>
      )}

      {/* Expired Trials */}
      {expiredTrials.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-red-500" />
            Expired Trials
          </h2>
          {expiredTrials.map((org) => (
            <TrialCard key={org.id} org={org} />
          ))}
        </div>
      )}

      {data.length === 0 && (
        <Card>
          <CardContent className="p-8 text-center">
            <CheckCircle className="h-12 w-12 mx-auto text-green-500 mb-4" />
            <h3 className="font-semibold">No active trials</h3>
            <p className="text-muted-foreground">All trials have been converted or expired</p>
          </CardContent>
        </Card>
      )}

    </div>
  )
}
