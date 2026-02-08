/**
 * Compare two semver version strings.
 * Returns: 1 if a > b, -1 if a < b, 0 if equal.
 */
export function compareVersions(a: string, b: string): number {
  const partsA = a.replace(/^v/, '').split('.').map(Number)
  const partsB = b.replace(/^v/, '').split('.').map(Number)
  for (let i = 0; i < 3; i++) {
    const va = partsA[i] || 0
    const vb = partsB[i] || 0
    if (va > vb) return 1
    if (va < vb) return -1
  }
  return 0
}

/**
 * Check if a newer version is available.
 */
export function isNewerVersion(current: string, latest: string): boolean {
  return compareVersions(latest, current) > 0
}
