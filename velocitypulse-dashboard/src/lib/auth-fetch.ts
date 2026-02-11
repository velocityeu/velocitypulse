import { clearOrgCache } from '@/lib/contexts/OrganizationContext'
import { clearUserCache } from '@/lib/contexts/UserContext'

/**
 * Drop-in fetch() replacement that handles 401 session expiry.
 * On 401: clears the org + user caches and redirects to /sign-in.
 * On other non-ok responses: throws an Error with status + response text.
 */
export async function authFetch(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<Response> {
  const response = await fetch(input, init)

  if (response.status === 401) {
    clearOrgCache()
    clearUserCache()
    if (typeof window !== 'undefined') {
      window.location.href = '/sign-in'
    }
    throw new Error('Session expired')
  }

  return response
}
