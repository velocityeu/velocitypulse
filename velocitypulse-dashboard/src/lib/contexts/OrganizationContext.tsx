'use client'

import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react'
import { useRouter, usePathname } from 'next/navigation'
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
  const pathname = usePathname()

  const fetchOrganization = useCallback(async () => {
    try {
      setIsLoading(true)
      setError(null)

      const response = await fetch('/api/onboarding')

      if (!response.ok) {
        if (response.status === 401) {
          // Not authenticated - redirect to sign-in
          router.push('/sign-in')
          return
        }
        throw new Error('Failed to fetch organization')
      }

      const data = await response.json()

      if (!data.hasOrganization) {
        // No organization - redirect to onboarding (unless already there)
        if (!pathname?.startsWith('/onboarding')) {
          router.push('/onboarding')
        }
        return
      }

      setOrganization(data.organization)
      setRole(data.role)
      setPermissions(data.permissions)
    } catch (err) {
      console.error('Failed to fetch organization:', err)
      setError(err instanceof Error ? err : new Error('Failed to fetch organization'))
    } finally {
      setIsLoading(false)
    }
  }, [router, pathname])

  useEffect(() => {
    fetchOrganization()
  }, [fetchOrganization])

  const value: OrganizationContextValue = {
    organization,
    role,
    permissions,
    isLoading,
    error,
    refetch: fetchOrganization,
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
