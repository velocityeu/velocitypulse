import crypto from 'crypto'

/**
 * Generates a new API key for an agent
 * Returns the full key (only shown once) and the hash/prefix for storage
 */
export function generateApiKey(): {
  apiKey: string
  apiKeyHash: string
  apiKeyPrefix: string
} {
  // Generate a 32-character random string
  const randomBytes = crypto.randomBytes(24)
  const randomPart = randomBytes.toString('base64url').slice(0, 32)
  const apiKey = `vp_${randomPart}`

  // Hash for storage (SHA256)
  const apiKeyHash = crypto.createHash('sha256').update(apiKey).digest('hex')

  // Prefix for identification (first 10 chars including 'vp_')
  const apiKeyPrefix = apiKey.slice(0, 10)

  return {
    apiKey,
    apiKeyHash,
    apiKeyPrefix,
  }
}

/**
 * Hashes an API key using SHA256
 * Used for verifying incoming API keys against stored hashes
 */
export function hashApiKey(apiKey: string): string {
  return crypto.createHash('sha256').update(apiKey).digest('hex')
}

/**
 * Extracts the prefix from an API key for fast database lookup
 */
export function getApiKeyPrefix(apiKey: string): string {
  return apiKey.slice(0, 10)
}
