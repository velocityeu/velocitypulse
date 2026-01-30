import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'
import type { OrganizationPlan, Organization } from '@/types'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Format response time for display
 */
export function formatResponseTime(ms: number | null | undefined): string {
  if (ms == null) return '-'
  if (ms < 1) return '<1ms'
  if (ms < 1000) return `${Math.round(ms)}ms`
  return `${(ms / 1000).toFixed(1)}s`
}

/**
 * Format last check time as relative time
 */
export function formatLastCheck(timestamp: string | null | undefined): string {
  if (!timestamp) return 'Never'

  const date = new Date(timestamp)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffSeconds = Math.floor(diffMs / 1000)
  const diffMinutes = Math.floor(diffSeconds / 60)
  const diffHours = Math.floor(diffMinutes / 60)
  const diffDays = Math.floor(diffHours / 24)

  if (diffSeconds < 5) return 'Just now'
  if (diffSeconds < 60) return `${diffSeconds}s ago`
  if (diffMinutes < 60) return `${diffMinutes}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays < 7) return `${diffDays}d ago`

  return date.toLocaleDateString()
}

/**
 * Generate a customer number in VEU-XXXXX format
 */
export function generateCustomerNumber(): string {
  const chars = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ'
  let suffix = ''
  for (let i = 0; i < 5; i++) {
    suffix += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return `VEU-${suffix}`
}

/**
 * Generate organization slug from name
 */
export function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 50)
}

/**
 * Generate a unique organization slug from name with random suffix
 */
export function generateUniqueSlug(name: string): string {
  const baseSlug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 50)
  const randomSuffix = Math.random().toString(36).substring(2, 6)
  return `${baseSlug}-${randomSuffix}`
}

/**
 * Format currency in GBP
 */
export function formatCurrency(amountCents: number): string {
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'GBP',
  }).format(amountCents / 100)
}

/**
 * Format date for display
 */
export function formatDate(date: string | Date): string {
  const d = new Date(date)
  return d.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

/**
 * Format date with time
 */
export function formatDateTime(date: string | Date): string {
  const d = new Date(date)
  return d.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

/**
 * Check if trial has expired
 */
export function isTrialExpired(trialEndsAt: string | null | undefined): boolean {
  if (!trialEndsAt) return false
  return new Date(trialEndsAt) < new Date()
}

/**
 * Get days until trial expires
 */
export function getDaysUntilTrialExpires(trialEndsAt: string | null | undefined): number {
  if (!trialEndsAt) return 0
  const now = new Date()
  const expiry = new Date(trialEndsAt)
  const diffMs = expiry.getTime() - now.getTime()
  return Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)))
}

/**
 * Truncate string with ellipsis
 */
export function truncate(str: string, length: number): string {
  if (str.length <= length) return str
  return str.slice(0, length - 3) + '...'
}

// ==============================================
// Plan/Tier Helper Functions
// ==============================================

/**
 * Get display name for a plan
 */
export function getPlanDisplayName(plan: OrganizationPlan): string {
  switch (plan) {
    case 'trial':
      return 'Trial'
    case 'starter':
      return 'Starter'
    case 'unlimited':
      return 'Unlimited'
    default:
      return 'Unknown'
  }
}

/**
 * Get trial days remaining (null if not on trial or expired)
 */
export function getTrialDaysRemaining(trialEndsAt: string | null | undefined): number | null {
  if (!trialEndsAt) return null
  const now = new Date()
  const expiry = new Date(trialEndsAt)
  if (expiry < now) return 0
  return Math.ceil((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
}

/**
 * Format trial/plan status for display
 */
export function formatTrialStatus(org: Pick<Organization, 'plan' | 'trial_ends_at' | 'status'>): string {
  if (org.plan === 'trial') {
    const daysLeft = getTrialDaysRemaining(org.trial_ends_at)
    if (daysLeft === null) return 'Trial'
    if (daysLeft === 0) return 'Trial Expired'
    return `Trial (${daysLeft} day${daysLeft === 1 ? '' : 's'} left)`
  }

  if (org.status === 'past_due') {
    return `${getPlanDisplayName(org.plan)} (Payment Due)`
  }

  if (org.status === 'suspended') {
    return `${getPlanDisplayName(org.plan)} (Suspended)`
  }

  return getPlanDisplayName(org.plan)
}

/**
 * Get badge color class based on plan/status
 */
export function getPlanBadgeColor(org: Pick<Organization, 'plan' | 'trial_ends_at' | 'status'>): string {
  if (org.status === 'suspended' || org.status === 'past_due') {
    return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
  }

  if (org.plan === 'trial') {
    const daysLeft = getTrialDaysRemaining(org.trial_ends_at)
    if (daysLeft !== null && daysLeft <= 7) {
      return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400'
    }
    return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400'
  }

  if (org.plan === 'unlimited') {
    return 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400'
  }

  // starter
  return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
}
