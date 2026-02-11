import { NextRequest, NextResponse } from 'next/server'

interface GithubAsset {
  id: number
  name: string
  browser_download_url?: string
}

interface GithubRelease {
  tag_name?: string
  assets?: GithubAsset[]
}

const DEFAULT_REPO = 'velocityeu/velocitypulse'
const USER_AGENT = 'VelocityPulse-Agent-Download'

function getGithubToken(): string | null {
  const token =
    process.env.AGENT_RELEASE_GITHUB_TOKEN ||
    process.env.GITHUB_TOKEN ||
    process.env.GH_TOKEN ||
    ''
  const trimmed = token.trim()
  return trimmed.length > 0 ? trimmed : null
}

function normalizeFormat(value: string | null): 'tar.gz' | 'zip' {
  if (value === 'zip') return 'zip'
  return 'tar.gz'
}

function jsonError(message: string, status: number): NextResponse {
  return NextResponse.json({ error: message }, { status })
}

export async function GET(request: NextRequest) {
  const format = normalizeFormat(request.nextUrl.searchParams.get('format'))
  const expectedSuffix = format === 'zip' ? '.zip' : '.tar.gz'
  const repo = (process.env.AGENT_RELEASE_REPO || DEFAULT_REPO).trim()
  const token = getGithubToken()

  const releaseHeaders: Record<string, string> = {
    'User-Agent': USER_AGENT,
    Accept: 'application/vnd.github+json',
  }
  if (token) {
    releaseHeaders.Authorization = `token ${token}`
  }

  const releasesUrl = `https://api.github.com/repos/${repo}/releases?per_page=30`
  const releasesResponse = await fetch(releasesUrl, {
    headers: releaseHeaders,
    cache: 'no-store',
  })

  if (!releasesResponse.ok) {
    if (releasesResponse.status === 404) {
      return jsonError('Agent release source not accessible', 503)
    }
    return jsonError(`Failed to fetch releases (${releasesResponse.status})`, 502)
  }

  const releases = await releasesResponse.json() as GithubRelease[]
  if (!Array.isArray(releases)) {
    return jsonError('Unexpected releases response', 502)
  }

  const release = releases.find((r) => typeof r.tag_name === 'string' && r.tag_name.startsWith('agent-v'))
  if (!release) {
    return jsonError('No agent releases available', 404)
  }

  const asset = (release.assets || []).find((a) => typeof a.name === 'string' && a.name.endsWith(expectedSuffix))
  if (!asset) {
    return jsonError(`No ${format} asset found for ${release.tag_name || 'latest release'}`, 404)
  }

  if (!token && asset.browser_download_url) {
    return NextResponse.redirect(asset.browser_download_url, { status: 302 })
  }

  if (!token) {
    return jsonError('Agent release token is not configured on server', 503)
  }

  const assetResponse = await fetch(`https://api.github.com/repos/${repo}/releases/assets/${asset.id}`, {
    headers: {
      'User-Agent': USER_AGENT,
      Authorization: `token ${token}`,
      Accept: 'application/octet-stream',
    },
    cache: 'no-store',
  })

  if (!assetResponse.ok || !assetResponse.body) {
    return jsonError(`Failed to fetch release asset (${assetResponse.status})`, 502)
  }

  const contentType = assetResponse.headers.get('content-type') || 'application/octet-stream'
  const releaseTag = release.tag_name || 'unknown'

  return new NextResponse(assetResponse.body, {
    status: 200,
    headers: {
      'Content-Type': contentType,
      'Content-Disposition': `attachment; filename="${asset.name}"`,
      'Cache-Control': 'public, max-age=300, s-maxage=300',
      'X-Agent-Release-Tag': releaseTag,
    },
  })
}
