import crypto from 'crypto'

/**
 * Generate a cryptographically secure invitation token (64-char hex).
 */
export function generateInvitationToken(): string {
  return crypto.randomBytes(32).toString('hex')
}

/**
 * Calculate invitation expiry (7 days from now).
 */
export function getInvitationExpiry(): Date {
  const date = new Date()
  date.setDate(date.getDate() + 7)
  return date
}

/**
 * Check if an invitation has expired.
 */
export function isInvitationExpired(expiresAt: string | Date): boolean {
  return new Date(expiresAt) < new Date()
}
