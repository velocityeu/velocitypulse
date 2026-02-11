export type AgentRuntimePlatform = 'linux' | 'darwin' | 'win32'

const DEFAULT_AGENT_RELEASE_TEMPLATE =
  'https://github.com/velocityeu/velocitypulse/releases/download/agent-v{version}/velocitypulse-agent-{version}.{ext}'

const SUPPORTED_URL_SUFFIX = /\.(?:tar\.gz|zip|json)(?:[?#].*)?$/i

export function normalizeAgentPlatform(value?: string | null): AgentRuntimePlatform {
  if (value === 'win32' || value === 'darwin' || value === 'linux') {
    return value
  }

  return 'linux'
}

function extensionForPlatform(platform: AgentRuntimePlatform): 'zip' | 'tar.gz' {
  return platform === 'win32' ? 'zip' : 'tar.gz'
}

function replaceTemplateTokens(
  template: string,
  version: string,
  platform: AgentRuntimePlatform
): string {
  const ext = extensionForPlatform(platform)
  return template
    .replaceAll('{version}', version)
    .replaceAll('{platform}', platform)
    .replaceAll('{ext}', ext)
}

export function isSupportedUpgradeUrl(url: string): boolean {
  return SUPPORTED_URL_SUFFIX.test(url.trim())
}

export function isSupportedUpgradeUrlOrTemplate(url: string): boolean {
  const trimmed = url.trim()
  if (!trimmed) return false
  if (isSupportedUpgradeUrl(trimmed)) return true

  if (trimmed.includes('{version}') || trimmed.includes('{platform}') || trimmed.includes('{ext}')) {
    return /(?:\.tar\.gz|\.zip|\.json|\{ext\})/i.test(trimmed)
  }

  if (trimmed.includes('/releases/latest')) {
    return true
  }

  return false
}

export function resolveAgentDownloadUrl(opts: {
  latestVersion: string
  platform?: string | null
  override?: string | null
}): string {
  const platform = normalizeAgentPlatform(opts.platform)
  const version = opts.latestVersion
  const rawTemplate = (opts.override || '').trim()

  const fallback = replaceTemplateTokens(DEFAULT_AGENT_RELEASE_TEMPLATE, version, platform)
  if (!rawTemplate) return fallback

  if (rawTemplate.includes('/releases/latest')) {
    return fallback
  }

  const resolved = replaceTemplateTokens(rawTemplate, version, platform)
  return isSupportedUpgradeUrl(resolved) ? resolved : fallback
}

