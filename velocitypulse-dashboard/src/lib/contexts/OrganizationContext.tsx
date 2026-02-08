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

export function OrganizationProvider({ children }: OrganizationProviderProps) {
  const [organization, setOrganization] = useState<Organization | null>(null)
  const [role, setRole] = useState<MemberRole | null>(null)
  const [permissions, setPermissions] = useState<MemberPermissions | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  const router = useRouter()
  const routerRef = useRef(router)
  routerRef.current = router

  const abortControllerRef = useRef<AbortController | null>(null)
  const hasFetchedRef = useRef(false)

  const fetchOrganization = useCallback(async () => {
    // Skip refetch if we already have org data
    if (hasFetchedRef.current) return

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

      setOrganization(data.organization)
      setRole(data.role)
      setPermissions(data.permissions)
      hasFetchedRef.current = true
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return
      console.error('Failed to fetch organization:', err)
      setError(err instanceof Error ? err : new Error('Failed to fetch organization'))
    } finally {
      setIsLoading(false)
    }
  }, [])

  // Explicit refetch that clears the hasFetched guard
  const refetch = useCallback(async () => {
    hasFetchedRef.current = false
    await fetchOrganization()
  }, [fetchOrganization])

  useEffect(() => {
    fetchOrganization()
    return () => { abortControllerRef.current?.abort() }
  }, [fetchOrganization])

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
