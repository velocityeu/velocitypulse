/**
 * Thin wrapper around Clerk's Enterprise Connections API for SAML SSO.
 * Uses CLERK_SECRET_KEY from environment.
 */

const CLERK_API_BASE = 'https://api.clerk.com/v1'

function getClerkSecretKey(): string {
  const key = process.env.CLERK_SECRET_KEY
  if (!key) {
    throw new Error('CLERK_SECRET_KEY is not configured')
  }
  return key
}

interface SamlConnectionResponse {
  id: string
  name: string
  domain: string
  provider: string
  active: boolean
  acs_url?: string
  entity_id?: string
}

/**
 * Create a SAML connection in Clerk for the given domain.
 * Returns the connection details including ACS URL and Entity ID for IdP configuration.
 */
export async function createSamlConnection(params: {
  name: string
  domain: string
  provider: string
  idpMetadataUrl?: string
  idpEntityId?: string
  idpSsoUrl?: string
}): Promise<SamlConnectionResponse> {
  const response = await fetch(`${CLERK_API_BASE}/saml_connections`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${getClerkSecretKey()}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name: params.name,
      domain: params.domain,
      provider: params.provider || 'saml_custom',
      idp_metadata_url: params.idpMetadataUrl,
      idp_entity_id: params.idpEntityId,
      idp_sso_url: params.idpSsoUrl,
    }),
  })

  if (!response.ok) {
    const errorBody = await response.text()
    // Gracefully handle case where Clerk plan doesn't support SAML
    if (response.status === 403 || response.status === 402) {
      throw new Error('SAML/SSO requires a Clerk plan that supports Enterprise Connections')
    }
    throw new Error(`Clerk SAML API error: ${response.status} - ${errorBody}`)
  }

  return response.json()
}

/**
 * Delete a SAML connection from Clerk.
 */
export async function deleteSamlConnection(connectionId: string): Promise<void> {
  const response = await fetch(`${CLERK_API_BASE}/saml_connections/${connectionId}`, {
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${getClerkSecretKey()}`,
    },
  })

  if (!response.ok && response.status !== 404) {
    const errorBody = await response.text()
    throw new Error(`Clerk SAML delete error: ${response.status} - ${errorBody}`)
  }
}

/**
 * Get a SAML connection from Clerk by ID.
 */
export async function getSamlConnection(connectionId: string): Promise<SamlConnectionResponse | null> {
  const response = await fetch(`${CLERK_API_BASE}/saml_connections/${connectionId}`, {
    headers: {
      'Authorization': `Bearer ${getClerkSecretKey()}`,
    },
  })

  if (response.status === 404) {
    return null
  }

  if (!response.ok) {
    const errorBody = await response.text()
    throw new Error(`Clerk SAML API error: ${response.status} - ${errorBody}`)
  }

  return response.json()
}
