/**
 * CIDR (Classless Inter-Domain Routing) utilities for IP range management
 */

/**
 * Parse a CIDR notation string into its components
 * @param cidr - CIDR string (e.g., "192.168.1.0/24")
 * @returns Object with network address and prefix length, or null if invalid
 */
export function parseCidr(cidr: string): {
  network: number
  prefix: number
  mask: number
} | null {
  const match = cidr.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})\/(\d{1,2})$/)
  if (!match) return null

  const octets = [
    parseInt(match[1], 10),
    parseInt(match[2], 10),
    parseInt(match[3], 10),
    parseInt(match[4], 10),
  ]
  const prefix = parseInt(match[5], 10)

  // Validate octets (0-255)
  if (octets.some(o => o < 0 || o > 255)) return null

  // Validate prefix (0-32)
  if (prefix < 0 || prefix > 32) return null

  // Convert to 32-bit integer
  const network = (octets[0] << 24) | (octets[1] << 16) | (octets[2] << 8) | octets[3]

  // Calculate mask (e.g., /24 -> 0xFFFFFF00)
  const mask = prefix === 0 ? 0 : ~((1 << (32 - prefix)) - 1) >>> 0

  return { network, prefix, mask }
}

/**
 * Check if a CIDR string is valid
 * @param cidr - CIDR string to validate
 */
export function isValidCidr(cidr: string): boolean {
  return parseCidr(cidr) !== null
}

/**
 * Get the start and end IP addresses (as integers) for a CIDR range
 */
export function getCidrRange(cidr: string): {
  start: number
  end: number
} | null {
  const parsed = parseCidr(cidr)
  if (!parsed) return null

  // Apply mask to get network address
  const start = (parsed.network & parsed.mask) >>> 0
  // Broadcast address (network | ~mask)
  const end = (start | (~parsed.mask >>> 0)) >>> 0

  return { start, end }
}

/**
 * Check if two CIDR ranges overlap
 * Two ranges overlap if one contains any address from the other
 *
 * @param cidr1 - First CIDR string
 * @param cidr2 - Second CIDR string
 * @returns true if ranges overlap, false otherwise
 */
export function cidrsOverlap(cidr1: string, cidr2: string): boolean {
  const range1 = getCidrRange(cidr1)
  const range2 = getCidrRange(cidr2)

  if (!range1 || !range2) {
    // Invalid CIDR - treat as non-overlapping (validation should catch this)
    return false
  }

  // Ranges overlap if one starts before the other ends
  // and the other starts before the first ends
  return range1.start <= range2.end && range2.start <= range1.end
}

/**
 * Check if cidr1 completely contains cidr2
 */
export function cidrContains(cidr1: string, cidr2: string): boolean {
  const range1 = getCidrRange(cidr1)
  const range2 = getCidrRange(cidr2)

  if (!range1 || !range2) return false

  return range1.start <= range2.start && range1.end >= range2.end
}

/**
 * Convert a 32-bit integer to IP string
 */
export function intToIp(int: number): string {
  return [
    (int >>> 24) & 255,
    (int >>> 16) & 255,
    (int >>> 8) & 255,
    int & 255,
  ].join('.')
}

/**
 * Get human-readable range for a CIDR
 * @param cidr - CIDR string
 * @returns Human-readable range string (e.g., "192.168.1.0 - 192.168.1.255")
 */
export function getCidrRangeString(cidr: string): string | null {
  const range = getCidrRange(cidr)
  if (!range) return null

  return `${intToIp(range.start)} - ${intToIp(range.end)}`
}

/**
 * Count the number of usable IP addresses in a CIDR range
 * (excludes network and broadcast addresses for /31 and smaller)
 */
export function getCidrAddressCount(cidr: string): number | null {
  const parsed = parseCidr(cidr)
  if (!parsed) return null

  const totalAddresses = Math.pow(2, 32 - parsed.prefix)

  // /31 and /32 are special cases (point-to-point links)
  if (parsed.prefix >= 31) {
    return totalAddresses
  }

  // Subtract network and broadcast addresses
  return totalAddresses - 2
}

export interface OverlapValidationResult {
  valid: boolean
  overlappingSegment?: {
    id: string
    name: string
    cidr: string
  }
  message?: string
}

/**
 * Validate that a CIDR doesn't overlap with existing segments in an organization
 * @param newCidr - The CIDR to validate
 * @param existingSegments - Array of existing segments to check against
 * @param excludeSegmentId - Optional segment ID to exclude (for updates)
 */
export function validateNoOverlap(
  newCidr: string,
  existingSegments: Array<{ id: string; name: string; cidr: string }>,
  excludeSegmentId?: string
): OverlapValidationResult {
  // First validate the CIDR format
  if (!isValidCidr(newCidr)) {
    return {
      valid: false,
      message: 'Invalid CIDR format. Expected format: x.x.x.x/nn (e.g., 192.168.1.0/24)',
    }
  }

  // Check against each existing segment
  for (const segment of existingSegments) {
    // Skip the segment being updated
    if (excludeSegmentId && segment.id === excludeSegmentId) {
      continue
    }

    if (cidrsOverlap(newCidr, segment.cidr)) {
      return {
        valid: false,
        overlappingSegment: segment,
        message: `CIDR ${newCidr} overlaps with existing segment "${segment.name}" (${segment.cidr})`,
      }
    }
  }

  return { valid: true }
}
