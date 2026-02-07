'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Search,
  Building2,
  Users,
  Monitor,
  ChevronRight,
  AlertCircle,
  CheckCircle,
} from 'lucide-react'
import { formatDate } from '@/lib/utils'
import type { Organization, OrganizationStatus } from '@/types'

const statusColors: Record<OrganizationStatus, { badge: string; dot: string }> = {
  trial: { badge: 'bg-blue-500/10 text-blue-500', dot: 'bg-blue-500' },
  active: { badge: 'bg-green-500/10 text-green-500', dot: 'bg-green-500' },
  past_due: { badge: 'bg-orange-500/10 text-orange-500', dot: 'bg-orange-500' },
  suspended: { badge: 'bg-red-500/10 text-red-500', dot: 'bg-red-500' },
  cancelled: { badge: 'bg-gray-500/10 text-gray-500', dot: 'bg-gray-500' },
}

interface SearchResult extends Organization {
  member_count?: number
  device_count?: number
  agent_count?: number
}

export default function SupportPage() {
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<SearchResult[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [hasSearched, setHasSearched] = useState(false)

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault()
    if (!searchQuery.trim()) return

    setIsSearching(true)
    setHasSearched(true)

    try {
      const response = await fetch(`/api/internal/support/search?q=${encodeURIComponent(searchQuery)}`)
      if (response.ok) {
        const data = await response.json()
        setSearchResults(data.results)
      } else {
        setSearchResults([])
      }
    } catch (error) {
      console.error('Search failed:', error)
      setSearchResults([])
    } finally {
      setIsSearching(false)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Support Lookup</h1>
        <p className="text-muted-foreground">
          Find customer organizations by name, customer number, or slug
        </p>
      </div>

      {/* Search Form */}
      <Card>
        <CardHeader>
          <CardTitle>Customer Search</CardTitle>
          <CardDescription>
            Enter a customer number (VEU-XXXXX), organization name, or slug
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSearch} className="flex gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="e.g., VEU-A1B2C or Acme Corporation"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 rounded-md border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <Button type="submit" disabled={isSearching || !searchQuery.trim()}>
              {isSearching ? 'Searching...' : 'Search'}
            </Button>
          </form>

          {/* Quick Links */}
          <div className="mt-4 pt-4 border-t">
            <h4 className="text-sm font-medium mb-2">Quick Links</h4>
            <div className="flex flex-wrap gap-2">
              <Link href="/internal/organizations">
                <Button variant="outline" size="sm">
                  <Building2 className="h-3 w-3 mr-1" />
                  All Organizations
                </Button>
              </Link>
              <Link href="/internal/trials">
                <Button variant="outline" size="sm">
                  <AlertCircle className="h-3 w-3 mr-1" />
                  Active Trials
                </Button>
              </Link>
              <Link href="/internal/security">
                <Button variant="outline" size="sm">
                  <CheckCircle className="h-3 w-3 mr-1" />
                  Audit Logs
                </Button>
              </Link>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Search Results */}
      {hasSearched && (
        <Card>
          <CardHeader>
            <CardTitle>
              Search Results
              <Badge variant="secondary" className="ml-2">
                {searchResults.length} found
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {searchResults.length === 0 ? (
              <div className="text-center py-8">
                <AlertCircle className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="font-semibold">No results found</h3>
                <p className="text-muted-foreground">
                  Try a different search term or check the customer number format
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {searchResults.map((org) => (
                  <Link key={org.id} href={`/internal/organizations/${org.id}`}>
                    <div className="flex items-center gap-4 p-4 rounded-lg border hover:bg-muted/50 transition-colors cursor-pointer">
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
                        </div>
                        <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground">
                          <span className="font-mono font-medium">{org.customer_number}</span>
                          <span>/{org.slug}</span>
                          <span>Created {formatDate(org.created_at)}</span>
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
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Instructions */}
      {!hasSearched && (
        <Card>
          <CardHeader>
            <CardTitle>How to use Support Lookup</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="p-4 rounded-lg bg-muted/50">
                <h4 className="font-medium mb-2">Search by Customer Number</h4>
                <p className="text-sm text-muted-foreground">
                  Enter the full customer number (e.g., VEU-A1B2C) for exact match.
                  This is the quickest way to find a specific customer.
                </p>
              </div>
              <div className="p-4 rounded-lg bg-muted/50">
                <h4 className="font-medium mb-2">Search by Name or Slug</h4>
                <p className="text-sm text-muted-foreground">
                  Enter part of the organization name or slug to find matching customers.
                  Partial matches are supported.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
