'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Search,
  Filter,
  Building2,
  Users,
  Monitor,
  ChevronRight,
  ExternalLink,
} from 'lucide-react'
import { formatDate, formatCurrency } from '@/lib/utils'
import type { Organization, OrganizationStatus, OrganizationPlan } from '@/types'

// Extended org type for admin view
interface AdminOrganization extends Organization {
  member_count?: number
  device_count?: number
  agent_count?: number
}

const statusColors: Record<OrganizationStatus, { badge: string; dot: string }> = {
  trial: { badge: 'bg-blue-500/10 text-blue-500', dot: 'bg-blue-500' },
  active: { badge: 'bg-green-500/10 text-green-500', dot: 'bg-green-500' },
  past_due: { badge: 'bg-orange-500/10 text-orange-500', dot: 'bg-orange-500' },
  suspended: { badge: 'bg-red-500/10 text-red-500', dot: 'bg-red-500' },
  cancelled: { badge: 'bg-gray-500/10 text-gray-500', dot: 'bg-gray-500' },
}

const planLabels: Record<OrganizationPlan, string> = {
  trial: 'Trial',
  starter: 'Starter',
  unlimited: 'Unlimited',
}

export default function OrganizationsPage() {
  const [organizations, setOrganizations] = useState<AdminOrganization[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<OrganizationStatus | 'all'>('all')
  const [planFilter, setPlanFilter] = useState<OrganizationPlan | 'all'>('all')

  useEffect(() => {
    loadOrganizations()
  }, [])

  async function loadOrganizations() {
    setIsLoading(true)
    try {
      const response = await fetch('/api/internal/organizations')
      if (response.ok) {
        const data = await response.json()
        setOrganizations(data.organizations)
      }
    } catch (error) {
      console.error('Failed to load organizations:', error)
    } finally {
      setIsLoading(false)
    }
  }

  // Demo data
  const demoOrganizations: AdminOrganization[] = [
    {
      id: '1',
      name: 'Acme Corporation',
      slug: 'acme-corp',
      customer_number: 'VEU-A1B2C',
      plan: 'unlimited',
      status: 'active',
      device_limit: 5000,
      agent_limit: 100,
      user_limit: 50,
      member_count: 12,
      device_count: 245,
      agent_count: 8,
      created_at: '2024-06-15T10:00:00Z',
      updated_at: '2025-01-20T14:30:00Z',
    },
    {
      id: '2',
      name: 'TechStart Ltd',
      slug: 'techstart',
      customer_number: 'VEU-D3E4F',
      plan: 'starter',
      status: 'active',
      device_limit: 100,
      agent_limit: 10,
      user_limit: 10,
      member_count: 3,
      device_count: 45,
      agent_count: 2,
      created_at: '2024-09-20T08:00:00Z',
      updated_at: '2025-01-18T09:15:00Z',
    },
    {
      id: '3',
      name: 'NewCo Industries',
      slug: 'newco',
      customer_number: 'VEU-G5H6I',
      plan: 'trial',
      status: 'trial',
      device_limit: 100,
      agent_limit: 10,
      user_limit: 5,
      trial_ends_at: '2025-02-10T00:00:00Z',
      member_count: 2,
      device_count: 18,
      agent_count: 1,
      created_at: '2025-01-27T12:00:00Z',
      updated_at: '2025-01-28T16:45:00Z',
    },
    {
      id: '4',
      name: 'Legacy Systems',
      slug: 'legacy',
      customer_number: 'VEU-J7K8L',
      plan: 'starter',
      status: 'past_due',
      device_limit: 100,
      agent_limit: 10,
      user_limit: 10,
      member_count: 4,
      device_count: 67,
      agent_count: 3,
      created_at: '2024-03-10T14:00:00Z',
      updated_at: '2025-01-25T11:20:00Z',
    },
    {
      id: '5',
      name: 'Defunct Corp',
      slug: 'defunct',
      customer_number: 'VEU-M9N0P',
      plan: 'starter',
      status: 'cancelled',
      device_limit: 100,
      agent_limit: 10,
      user_limit: 10,
      cancelled_at: '2025-01-15T00:00:00Z',
      member_count: 0,
      device_count: 0,
      agent_count: 0,
      created_at: '2024-01-05T09:00:00Z',
      updated_at: '2025-01-15T00:00:00Z',
    },
  ]

  const data = organizations.length > 0 ? organizations : demoOrganizations

  // Filter organizations
  const filteredOrgs = data.filter((org) => {
    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      const matchesSearch =
        org.name.toLowerCase().includes(query) ||
        org.customer_number.toLowerCase().includes(query) ||
        org.slug.toLowerCase().includes(query)
      if (!matchesSearch) return false
    }

    // Status filter
    if (statusFilter !== 'all' && org.status !== statusFilter) {
      return false
    }

    // Plan filter
    if (planFilter !== 'all' && org.plan !== planFilter) {
      return false
    }

    return true
  })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Organizations</h1>
          <p className="text-muted-foreground">
            Manage all tenant organizations
          </p>
        </div>
        <div className="text-sm text-muted-foreground">
          {filteredOrgs.length} of {data.length} organizations
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap gap-4">
            {/* Search */}
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search by name, customer number, or slug..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 rounded-md border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>

            {/* Status Filter */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as OrganizationStatus | 'all')}
              className="px-3 py-2 rounded-md border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="all">All Statuses</option>
              <option value="trial">Trial</option>
              <option value="active">Active</option>
              <option value="past_due">Past Due</option>
              <option value="suspended">Suspended</option>
              <option value="cancelled">Cancelled</option>
            </select>

            {/* Plan Filter */}
            <select
              value={planFilter}
              onChange={(e) => setPlanFilter(e.target.value as OrganizationPlan | 'all')}
              className="px-3 py-2 rounded-md border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="all">All Plans</option>
              <option value="trial">Trial</option>
              <option value="starter">Starter</option>
              <option value="unlimited">Unlimited</option>
            </select>
          </div>
        </CardContent>
      </Card>

      {/* Organizations List */}
      <div className="space-y-3">
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-24 rounded-lg bg-muted animate-pulse" />
            ))}
          </div>
        ) : filteredOrgs.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center text-muted-foreground">
              No organizations found matching your filters.
            </CardContent>
          </Card>
        ) : (
          filteredOrgs.map((org) => (
            <Link key={org.id} href={`/internal/organizations/${org.id}`}>
              <Card className="hover:bg-muted/50 transition-colors cursor-pointer">
                <CardContent className="p-4">
                  <div className="flex items-center gap-4">
                    {/* Icon */}
                    <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
                      <Building2 className="h-6 w-6 text-primary" />
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold truncate">{org.name}</h3>
                        <Badge className={statusColors[org.status].badge}>
                          <span className={`mr-1.5 h-1.5 w-1.5 rounded-full ${statusColors[org.status].dot}`} />
                          {org.status.charAt(0).toUpperCase() + org.status.slice(1).replace('_', ' ')}
                        </Badge>
                        <Badge variant="outline">{planLabels[org.plan]}</Badge>
                      </div>
                      <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground">
                        <span className="font-mono">{org.customer_number}</span>
                        <span>Created {formatDate(org.created_at)}</span>
                        {org.trial_ends_at && (
                          <span className="text-orange-500">
                            Trial ends {formatDate(org.trial_ends_at)}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Stats */}
                    <div className="hidden md:flex items-center gap-6 text-sm">
                      <div className="text-center">
                        <div className="font-semibold">{org.member_count || 0}</div>
                        <div className="text-muted-foreground flex items-center gap-1">
                          <Users className="h-3 w-3" />
                          Users
                        </div>
                      </div>
                      <div className="text-center">
                        <div className="font-semibold">{org.device_count || 0}</div>
                        <div className="text-muted-foreground flex items-center gap-1">
                          <Monitor className="h-3 w-3" />
                          Devices
                        </div>
                      </div>
                    </div>

                    {/* Arrow */}
                    <ChevronRight className="h-5 w-5 text-muted-foreground" />
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))
        )}
      </div>

      {organizations.length === 0 && (
        <div className="rounded-lg border border-orange-200 bg-orange-50 p-4 text-sm text-orange-800 dark:border-orange-900 dark:bg-orange-950 dark:text-orange-200">
          Showing demo data. Connect to database to see real organizations.
        </div>
      )}
    </div>
  )
}
