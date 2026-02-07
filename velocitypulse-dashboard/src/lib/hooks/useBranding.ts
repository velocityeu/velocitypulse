import { useOrganization } from '@/lib/contexts/OrganizationContext'
import { PLAN_LIMITS, DEFAULT_BRANDING } from '@/lib/constants'
import type { Organization, OrganizationPlan } from '@/types'

export interface ResolvedBranding {
  displayName: string
  logoUrl: string
  primaryColor?: string
}

/**
 * Resolve branding from an organization object.
 * Returns custom branding if the org is on the unlimited plan and has configured it,
 * otherwise returns VelocityPulse defaults.
 */
export function resolveBranding(organization: Organization | null): ResolvedBranding {
  if (!organization) {
    return {
      displayName: DEFAULT_BRANDING.displayName,
      logoUrl: DEFAULT_BRANDING.logoUrl,
    }
  }

  const plan = organization.plan as OrganizationPlan
  const canWhiteLabel = PLAN_LIMITS[plan]?.whiteLabel ?? false

  if (!canWhiteLabel) {
    return {
      displayName: DEFAULT_BRANDING.displayName,
      logoUrl: DEFAULT_BRANDING.logoUrl,
    }
  }

  return {
    displayName: organization.branding_display_name || DEFAULT_BRANDING.displayName,
    logoUrl: organization.branding_logo_url || DEFAULT_BRANDING.logoUrl,
    primaryColor: organization.branding_primary_color || undefined,
  }
}

/**
 * Hook that returns resolved branding for the current organization.
 * Uses custom branding if on the unlimited plan and configured, else defaults.
 */
export function useBranding(): ResolvedBranding {
  const { organization } = useOrganization()
  return resolveBranding(organization)
}
