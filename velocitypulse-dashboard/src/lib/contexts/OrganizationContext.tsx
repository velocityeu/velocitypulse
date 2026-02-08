'use client'

import { createContext, useContext, useEffect, useState, useCallback, useRef, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import type { Organization, MemberRole, MemberPermissions } from '@/types'

interface OrganizationContextValue {
  organization: Organization | null
  role: MemberRole | null
  permissions: MemberPermissions | null
  isLoading: boolean
  error: Error | null
  refetch: () => Promise<void>
}

const OrganizationContext = createContext<OrganizationContextValue | null>(null)

interface OrganizationProviderProps {
  children: ReactNode
}

// Module-level cache — survives component remounts so navigations never flicker
let cachedOrg: {
  organization: Organization
  role: MemberRole | null
  permissions: MemberPermissions | null
} | null = null

/** Clear the module-level org cache. Called by authFetch on 401. */
export function clearOrgCache(): void {
  cachedOrg = null
}

export function OrganizationProvider({ children }: OrganizationProviderProps) {
  const [organization, setOrganization] = useState<Organization | null>(cachedOrg?.organization ?? null)
  const [role, setRole] = useState<MemberRole | null>(cachedOrg?.role ?? null)
  const [permissions, setPermissions] = useState<MemberPermissions | null>(cachedOrg?.permissions ?? null)
  const [isLoading, setIsLoading] = useState(cachedOrg === null)
  const [error, setError] = useState<Error | null>(null)

  const router = useRouter()
  const routerRef = useRef(router)
  routerRef.current = router

  const abortControllerRef = useRef<AbortController | null>(null)

  const fetchOrganization = useCallback(async () => {
    // Skip if we already have cached data
    if (cachedOrg) return

    // Cancel any in-flight request
    abortControllerRef.current?.abort()
    const controller = new AbortController()
    abortControllerRef.current = controller

    try {
      setError(null)
      setIsLoading(true)

      const response = await fetch('/api/onboarding', { signal: controller.signal })

      if (!response.ok) {
        if (response.status === 401) {
          routerRef.current.push('/sign-in')
          return
        }
        throw new Error('Failed to fetch organization')
      }

      const data = await response.json()

      if (!data.hasOrganization) {
        if (!window.location.pathname.startsWith('/onboarding')) {
          routerRef.current.push('/onboarding')
        }
        return
      }

      cachedOrg = {
        organization: data.organization,
        role: data.role,
        permissions: data.permissions,
      }
      setOrganization(data.organization)
      setRole(data.role)
      setPermissions(data.permissions)
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return
      console.error('Failed to fetch organization:', err)
      setError(err instanceof Error ? err : new Error('Failed to fetch organization'))
    } finally {
      setIsLoading(false)
    }
  }, [])

  // Explicit refetch — clears the module cache and re-fetches
  const refetch = useCallback(async () => {
    cachedOrg = null
    await fetchOrganization()
  }, [fetchOrganization])

  useEffect(() => {
    fetchOrganization()
    return () => { abortControllerRef.current?.abort() }
  }, [fetchOrganization])

  // Proactively re-check auth when returning to a stale tab (5+ min idle)
  useEffect(() => {
    let lastVisible = Date.now()

    const handleVisibility = async () => {
      if (document.visibilityState !== 'visible') {
        lastVisible = Date.now()
        return
      }

      const idleMs = Date.now() - lastVisible
      if (idleMs < 5 * 60 * 1000) return // less than 5 min idle

      try {
        const res = await fetch('/api/onboarding', { method: 'GET' })
        if (res.status === 401) {
          cachedOrg = null
          window.location.href = '/sign-in'
        }
      } catch {
        // Network error — ignore, user will hit 401 on next action
      }
    }

    document.addEventListener('visibilitychange', handleVisibility)
    return () => document.removeEventListener('visibilitychange', handleVisibility)
  }, [])

  const value: OrganizationContextValue = {
    organization,
    role,
    permissions,
    isLoading,
    error,
    refetch,
  }

  return (
    <OrganizationContext.Provider value={value}>
      {children}
    </OrganizationContext.Provider>
  )
}

export function useOrganization(): OrganizationContextValue {
  const context = useContext(OrganizationContext)
  if (!context) {
    throw new Error('useOrganization must be used within an OrganizationProvider')
  }
  return context
}

// Hook that requires organization to be loaded
export function useRequiredOrganization(): Omit<OrganizationContextValue, 'organization'> & { organization: Organization } {
  const context = useOrganization()
  if (!context.organization && !context.isLoading) {
    throw new Error('Organization is required but not available')
  }
  return context as Omit<OrganizationContextValue, 'organization'> & { organization: Organization }
}
