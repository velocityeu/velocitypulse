import express from 'express'
import os from 'os'
import { createServer } from 'http'
import { Server as SocketIOServer } from 'socket.io'
import path from 'path'
import { fileURLToPath } from 'url'
import { randomBytes } from 'crypto'
import type { Logger } from '../utils/logger.js'
import { BUILD_ID } from '../utils/version.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const SESSION_COOKIE_NAME = 'vp_ui_session'
const CSRF_COOKIE_NAME = 'vp_ui_csrf'

export interface HealthStats {
  uptime: number // seconds
  memoryUsedMB: number
  memoryTotalMB: number
  cpuUsage: number // percentage (0-100)
  startedAt: string
}

export interface VersionInfo {
  current: string
  latest: string | null
  updateAvailable: boolean
}

export interface AgentConfig {
  scanIntervals: Record<string, number> // segmentId -> seconds
  enabledSegments: string[] // segment IDs
  pingTimeoutMs: number
  discoveryMethods: string[] // arp, ping, mdns, ssdp
}

export interface AgentUIOptions {
  enabled?: boolean
  host?: string
  authToken?: string
  setupCode?: string
  setupCodeTtlMinutes?: number
  sessionTtlMinutes?: number
  ssoEnabled?: boolean
  dashboardUrl?: string
  agentApiKey?: string
}

export interface AgentUIState {
  agentId: string | null
  agentName: string
  organizationId: string | null
  dashboardUrl: string
  version: string
  buildId: string
  connected: boolean
  lastHeartbeat: string | null
  segments: SegmentInfo[]
  devices: DeviceInfo[]
  logs: LogEntry[]
  scanning: boolean
  health: HealthStats
  versionInfo: VersionInfo
  config: AgentConfig
}

export interface SegmentInfo {
  id: string
  name: string
  cidr: string
  lastScan: string | null
  deviceCount: number
  scanning: boolean
}

export interface DeviceInfo {
  id: string
  name: string
  ip: string
  mac?: string
  status: 'online' | 'offline' | 'degraded' | 'unknown'
  responseTime?: number
  lastCheck?: string
}

export interface LogEntry {
  timestamp: string
  level: 'debug' | 'info' | 'warn' | 'error'
  message: string
}

type AuthMethod = 'local' | 'sso' | 'token_fallback'

interface UISession {
  id: string
  method: AuthMethod
  csrfToken: string
  expiresAt: number
  lastSeenAt: number
}

interface AuthResult {
  ok: boolean
  session?: UISession
  viaTokenFallback?: boolean
}

interface SetupCodePayload {
  setup_code: string
  expires_at: string
  expires_in_seconds: number
}

export class AgentUIServer {
  private app: express.Application
  private httpServer: ReturnType<typeof createServer>
  private io: SocketIOServer
  private logger: Logger
  private state: AgentUIState
  private port: number
  private host: string
  private enabled: boolean
  private authToken: string
  private healthInterval: ReturnType<typeof setInterval> | null = null
  private startedAt: string
  private setupCode: string
  private setupCodeExpiresAt: number
  private setupCodeUsed: boolean
  private setupCodeTtlMs: number
  private sessionTtlMs: number
  private sessions: Map<string, UISession>
  private pendingSsoStates: Map<string, number>
  private ssoEnabled: boolean
  private dashboardUrl?: string
  private agentApiKey?: string

  constructor(
    port: number,
    logger: Logger,
    initialState: Partial<AgentUIState> = {},
    options: AgentUIOptions = {}
  ) {
    this.port = port
    this.host = options.host || '127.0.0.1'
    this.enabled = options.enabled !== false
    this.authToken = options.authToken?.trim() || randomBytes(24).toString('hex')
    this.logger = logger
    this.startedAt = new Date().toISOString()
    const setupCodeTtlMinutes = Number.isFinite(options.setupCodeTtlMinutes)
      ? Number(options.setupCodeTtlMinutes)
      : 10
    const sessionTtlMinutes = Number.isFinite(options.sessionTtlMinutes)
      ? Number(options.sessionTtlMinutes)
      : 480
    this.setupCodeTtlMs = Math.max(1, setupCodeTtlMinutes) * 60 * 1000
    this.sessionTtlMs = Math.max(15, sessionTtlMinutes) * 60 * 1000
    this.setupCode = this.normalizeSetupCode(options.setupCode) || this.generateSetupCode()
    this.setupCodeExpiresAt = Date.now() + this.setupCodeTtlMs
    this.setupCodeUsed = false
    this.sessions = new Map<string, UISession>()
    this.pendingSsoStates = new Map<string, number>()
    this.ssoEnabled = options.ssoEnabled === true
    this.dashboardUrl = options.dashboardUrl?.replace(/\/$/, '')
    this.agentApiKey = options.agentApiKey?.trim()

    this.app = express()
    this.httpServer = createServer(this.app)
    this.io = new SocketIOServer(this.httpServer, {
      cors: {
        origin: [`http://${this.host}:${this.port}`, `http://localhost:${this.port}`, `http://127.0.0.1:${this.port}`],
        methods: ['GET', 'POST'],
      },
    })

    const mem = process.memoryUsage()
    this.state = {
      agentId: null,
      agentName: 'VelocityPulse Agent',
      organizationId: null,
      dashboardUrl: '',
      version: '1.0.0',
      buildId: BUILD_ID,
      connected: false,
      lastHeartbeat: null,
      segments: [],
      devices: [],
      logs: [],
      scanning: false,
      health: {
        uptime: process.uptime(),
        memoryUsedMB: Math.round(mem.rss / 1024 / 1024),
        memoryTotalMB: Math.round(os.totalmem() / 1024 / 1024),
        cpuUsage: 0,
        startedAt: this.startedAt,
      },
      versionInfo: {
        current: initialState.version || '1.0.0',
        latest: null,
        updateAvailable: false,
      },
      config: {
        scanIntervals: {},
        enabledSegments: [],
        pingTimeoutMs: 2000,
        discoveryMethods: ['arp', 'ping'],
      },
      ...initialState,
    }

    if (!this.dashboardUrl && this.state.dashboardUrl) {
      this.dashboardUrl = this.state.dashboardUrl.replace(/\/$/, '')
    }

    this.setupRoutes()
    this.setupSocketIO()
    this.startHealthUpdates()
  }

  private normalizeSetupCode(value?: string): string {
    if (!value) return ''
    const compact = value.toUpperCase().replace(/[^A-Z0-9]/g, '')
    if (compact.length < 8) return ''
    const normalized = compact.slice(0, 8)
    return `${normalized.slice(0, 4)}-${normalized.slice(4, 8)}`
  }

  private generateSetupCode(): string {
    const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
    let code = ''
    for (let i = 0; i < 8; i++) {
      code += alphabet[Math.floor(Math.random() * alphabet.length)]
    }
    return `${code.slice(0, 4)}-${code.slice(4, 8)}`
  }

  private rotateSetupCode(reason: 'expired' | 'used' | 'manual' = 'manual'): string {
    this.setupCode = this.generateSetupCode()
    this.setupCodeExpiresAt = Date.now() + this.setupCodeTtlMs
    this.setupCodeUsed = false
    this.logger.info(`Agent UI setup code regenerated (${reason})`)
    return this.setupCode
  }

  private cleanupExpiredAuthState(): void {
    const now = Date.now()

    if (now > this.setupCodeExpiresAt && !this.setupCodeUsed) {
      this.rotateSetupCode('expired')
    }

    for (const [id, session] of this.sessions.entries()) {
      if (session.expiresAt <= now) {
        this.sessions.delete(id)
      }
    }

    for (const [state, expiresAt] of this.pendingSsoStates.entries()) {
      if (expiresAt <= now) {
        this.pendingSsoStates.delete(state)
      }
    }
  }

  private parseCookies(cookieHeader?: string): Record<string, string> {
    if (!cookieHeader) return {}

    return cookieHeader
      .split(';')
      .map((entry) => entry.trim())
      .filter(Boolean)
      .reduce<Record<string, string>>((acc, entry) => {
        const index = entry.indexOf('=')
        if (index <= 0) return acc
        const key = entry.slice(0, index).trim()
        const value = entry.slice(index + 1).trim()
        acc[key] = decodeURIComponent(value)
        return acc
      }, {})
  }

  private isLoopbackAddress(address?: string | null): boolean {
    if (!address) return false
    if (address === '::1' || address === '127.0.0.1') return true
    if (address.startsWith('::ffff:')) {
      return address.slice('::ffff:'.length) === '127.0.0.1'
    }
    return false
  }

  private isLoopbackRequest(req: express.Request): boolean {
    const remoteAddress = req.socket?.remoteAddress
    return this.isLoopbackAddress(remoteAddress)
  }

  private getSetupCodePayload(): SetupCodePayload {
    const expiresInMs = Math.max(0, this.setupCodeExpiresAt - Date.now())
    return {
      setup_code: this.setupCode,
      expires_at: new Date(this.setupCodeExpiresAt).toISOString(),
      expires_in_seconds: Math.floor(expiresInMs / 1000),
    }
  }

  private extractBearerToken(headerValue?: string): string | null {
    if (!headerValue) return null
    const [scheme, token] = headerValue.split(' ')
    if (scheme?.toLowerCase() !== 'bearer' || !token) return null
    return token.trim()
  }

  private getLegacyRequestToken(req: express.Request): string | null {
    const queryToken = typeof req.query.token === 'string' ? req.query.token.trim() : ''
    if (queryToken) return queryToken

    const headerToken = req.headers['x-agent-ui-token']
    if (typeof headerToken === 'string' && headerToken.trim()) {
      return headerToken.trim()
    }

    const bearerToken = this.extractBearerToken(req.headers.authorization)
    if (bearerToken) return bearerToken

    return null
  }

  private getLegacySocketToken(handshake: { headers: Record<string, unknown>; auth?: Record<string, unknown> }): string | null {
    const authToken = typeof handshake.auth?.token === 'string' ? handshake.auth.token.trim() : ''
    if (authToken) return authToken

    const headerToken = handshake.headers['x-agent-ui-token']
    if (typeof headerToken === 'string' && headerToken.trim()) {
      return headerToken.trim()
    }

    const authorization = handshake.headers.authorization
    if (typeof authorization === 'string') {
      const bearer = this.extractBearerToken(authorization)
      if (bearer) return bearer
    }

    return null
  }

  private isLegacyTokenValid(token: string | null): boolean {
    return !!token && token === this.authToken
  }

  private createSession(method: AuthMethod): UISession {
    const now = Date.now()
    const session: UISession = {
      id: randomBytes(24).toString('hex'),
      method,
      csrfToken: randomBytes(20).toString('hex'),
      expiresAt: now + this.sessionTtlMs,
      lastSeenAt: now,
    }

    this.sessions.set(session.id, session)
    return session
  }

  private getSessionById(sessionId: string | null): UISession | null {
    if (!sessionId) return null

    this.cleanupExpiredAuthState()
    const session = this.sessions.get(sessionId)
    if (!session) return null

    if (session.expiresAt <= Date.now()) {
      this.sessions.delete(sessionId)
      return null
    }

    session.lastSeenAt = Date.now()
    session.expiresAt = session.lastSeenAt + this.sessionTtlMs
    this.sessions.set(session.id, session)
    return session
  }

  private getSessionFromRequest(req: express.Request): UISession | null {
    const cookies = this.parseCookies(req.headers.cookie)
    const sessionId = cookies[SESSION_COOKIE_NAME]
    return this.getSessionById(sessionId || null)
  }

  private getSessionFromSocket(handshake: { headers: Record<string, unknown>; auth?: Record<string, unknown> }): UISession | null {
    const cookieHeader = handshake.headers.cookie
    if (typeof cookieHeader === 'string') {
      const cookies = this.parseCookies(cookieHeader)
      const fromCookie = this.getSessionById(cookies[SESSION_COOKIE_NAME] || null)
      if (fromCookie) return fromCookie
    }

    const authSession = typeof handshake.auth?.session === 'string' ? handshake.auth.session.trim() : ''
    if (authSession) {
      return this.getSessionById(authSession)
    }

    return null
  }

  private setSessionCookies(res: express.Response, session: UISession): void {
    const maxAgeSeconds = Math.floor(this.sessionTtlMs / 1000)
    res.setHeader('Set-Cookie', [
      `${SESSION_COOKIE_NAME}=${encodeURIComponent(session.id)}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${maxAgeSeconds}`,
      `${CSRF_COOKIE_NAME}=${encodeURIComponent(session.csrfToken)}; SameSite=Strict; Path=/; Max-Age=${maxAgeSeconds}`,
    ])
  }

  private clearSessionCookies(res: express.Response): void {
    res.setHeader('Set-Cookie', [
      `${SESSION_COOKIE_NAME}=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0`,
      `${CSRF_COOKIE_NAME}=; SameSite=Strict; Path=/; Max-Age=0`,
      `vp_ui_token=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0`,
    ])
  }

  private validateCsrf(req: express.Request, session: UISession): boolean {
    const method = req.method.toUpperCase()
    if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
      return true
    }

    if (req.path.startsWith('/auth/')) {
      return true
    }

    const headerToken = req.headers['x-csrf-token']
    const csrfToken = typeof headerToken === 'string' ? headerToken.trim() : ''
    return csrfToken.length > 0 && csrfToken === session.csrfToken
  }

  private resolveAuthFromRequest(req: express.Request, res?: express.Response): AuthResult {
    const existingSession = this.getSessionFromRequest(req)
    if (existingSession) {
      return { ok: true, session: existingSession }
    }

    const legacyToken = this.getLegacyRequestToken(req)
    if (this.isLegacyTokenValid(legacyToken) && res) {
      const session = this.createSession('token_fallback')
      this.setSessionCookies(res, session)
      return { ok: true, session, viaTokenFallback: true }
    }

    return { ok: false }
  }

  private async verifySsoGrant(
    grantId: string,
    state: string
  ): Promise<{ ok: boolean; organizationId?: string; error?: string }> {
    const dashboardUrl = this.dashboardUrl || this.state.dashboardUrl
    if (!dashboardUrl) {
      return { ok: false, error: 'dashboard_url_unset' }
    }

    if (!this.agentApiKey) {
      return { ok: false, error: 'agent_api_key_unset' }
    }

    if (!this.state.agentId) {
      return { ok: false, error: 'agent_id_unset' }
    }

    try {
      const response = await fetch(`${dashboardUrl.replace(/\/$/, '')}/api/agent-ui/sso/verify`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.agentApiKey}`,
        },
        body: JSON.stringify({
          grant_id: grantId,
          state,
          agent_id: this.state.agentId,
        }),
      })

      if (!response.ok) {
        const payload = await response.text()
        return { ok: false, error: `verify_failed_${response.status}_${payload.slice(0, 80)}` }
      }

      const payload = await response.json() as { ok?: boolean; organization_id?: string; error?: string }
      if (!payload.ok || !payload.organization_id) {
        return { ok: false, error: payload.error || 'invalid_verify_payload' }
      }

      if (this.state.organizationId && payload.organization_id !== this.state.organizationId) {
        return { ok: false, error: 'organization_mismatch' }
      }

      return { ok: true, organizationId: payload.organization_id }
    } catch (error) {
      return { ok: false, error: error instanceof Error ? error.message : 'verify_exception' }
    }
  }

  private buildSsoAuthorizeUrl(state: string): string | null {
    const dashboardUrl = (this.dashboardUrl || this.state.dashboardUrl || '').replace(/\/$/, '')
    if (!dashboardUrl || !this.state.agentId) {
      return null
    }

    const callback = `${this.getAccessUrl()}/api/auth/sso/callback`
    const url = new URL(`${dashboardUrl}/api/agent-ui/sso/authorize`)
    url.searchParams.set('agent_id', this.state.agentId)
    url.searchParams.set('state', state)
    url.searchParams.set('redirect_uri', callback)
    return url.toString()
  }

  private setupRoutes(): void {
    this.app.disable('x-powered-by')
    this.app.use(express.json({ limit: '64kb' }))

    // Public auth discovery for login UI
    this.app.get('/api/auth/methods', (_req, res) => {
      const dashboardUrl = (this.dashboardUrl || this.state.dashboardUrl || '').replace(/\/$/, '')
      const ssoAvailable = this.ssoEnabled && !!dashboardUrl && !!this.state.agentId

      res.json({
        local_enabled: true,
        sso_enabled: ssoAvailable,
        sso_url: ssoAvailable ? '/api/auth/sso/start' : null,
        session_ttl_minutes: Math.floor(this.sessionTtlMs / 60000),
      })
    })

    this.app.get('/api/auth/local/setup-code', (req, res) => {
      this.cleanupExpiredAuthState()

      if (!this.isLoopbackRequest(req)) {
        res.status(403).json({ error: 'loopback_only' })
        return
      }

      res.json(this.getSetupCodePayload())
    })

    this.app.get('/api/auth/session', (req, res) => {
      const authResult = this.resolveAuthFromRequest(req, res)
      if (!authResult.ok || !authResult.session) {
        res.status(401).json({ authenticated: false })
        return
      }

      res.json({
        authenticated: true,
        method: authResult.session.method,
        expires_at: new Date(authResult.session.expiresAt).toISOString(),
      })
    })

    this.app.post('/api/auth/local/login', (req, res) => {
      this.cleanupExpiredAuthState()

      const provided = this.normalizeSetupCode(req.body?.setup_code)
      if (!provided) {
        res.status(400).json({ error: 'setup_code_required' })
        return
      }

      if (this.setupCodeUsed) {
        res.status(401).json({ error: 'setup_code_used' })
        return
      }

      if (Date.now() > this.setupCodeExpiresAt) {
        this.rotateSetupCode('expired')
        res.status(401).json({ error: 'setup_code_expired' })
        return
      }

      if (provided !== this.setupCode) {
        res.status(401).json({ error: 'invalid_setup_code' })
        return
      }

      this.setupCodeUsed = true
      const session = this.createSession('local')
      this.setSessionCookies(res, session)

      // Immediately rotate for next break-glass use.
      const nextCode = this.rotateSetupCode('used')
      this.logger.info(`Agent UI local login succeeded. New setup code issued for next recovery: ${nextCode}`)

      res.json({ ok: true, method: 'local' })
    })

    this.app.get('/api/auth/sso/start', (req, res) => {
      if (!this.ssoEnabled) {
        res.status(404).json({ error: 'sso_disabled' })
        return
      }

      const state = randomBytes(20).toString('hex')
      const ssoUrl = this.buildSsoAuthorizeUrl(state)
      if (!ssoUrl) {
        res.status(400).json({ error: 'sso_not_ready', reason: 'agent_not_registered_or_dashboard_missing' })
        return
      }

      this.pendingSsoStates.set(state, Date.now() + 10 * 60 * 1000)

      const nextUrl = typeof req.query.next === 'string' ? req.query.next : '/'
      const redirect = new URL(ssoUrl)
      redirect.searchParams.set('next', nextUrl)
      res.redirect(302, redirect.toString())
    })

    this.app.get('/api/auth/sso/callback', async (req, res) => {
      if (!this.ssoEnabled) {
        res.redirect(302, '/?auth_error=sso_disabled')
        return
      }

      const grantId = typeof req.query.grant_id === 'string' ? req.query.grant_id.trim() : ''
      const state = typeof req.query.state === 'string' ? req.query.state.trim() : ''
      const next = typeof req.query.next === 'string' && req.query.next.startsWith('/')
        ? req.query.next
        : '/'

      if (!grantId || !state) {
        res.redirect(302, '/?auth_error=missing_sso_params')
        return
      }

      this.cleanupExpiredAuthState()
      const expiresAt = this.pendingSsoStates.get(state)
      if (!expiresAt || expiresAt <= Date.now()) {
        this.pendingSsoStates.delete(state)
        res.redirect(302, '/?auth_error=invalid_or_expired_state')
        return
      }
      this.pendingSsoStates.delete(state)

      const verify = await this.verifySsoGrant(grantId, state)
      if (!verify.ok) {
        this.logger.warn(`Agent UI SSO verify failed: ${verify.error || 'unknown'}`)
        res.redirect(302, '/?auth_error=sso_verify_failed')
        return
      }

      const session = this.createSession('sso')
      this.setSessionCookies(res, session)
      res.redirect(302, next)
    })

    this.app.post('/api/auth/logout', (req, res) => {
      const session = this.getSessionFromRequest(req)
      if (session) {
        this.sessions.delete(session.id)
      }
      this.clearSessionCookies(res)
      res.json({ ok: true })
    })

    // All non-auth API routes require authenticated session.
    this.app.use('/api', (req, res, next) => {
      if (req.path.startsWith('/auth/')) {
        next()
        return
      }

      const authResult = this.resolveAuthFromRequest(req, res)
      if (!authResult.ok || !authResult.session) {
        res.status(401).json({ error: 'Unauthorized' })
        return
      }

      if (!this.validateCsrf(req, authResult.session)) {
        res.status(403).json({ error: 'Invalid CSRF token' })
        return
      }

      next()
    })

    // Serve static files from public directory
    const publicPath = path.join(__dirname, 'public')
    this.app.use(express.static(publicPath))

    // API endpoints
    this.app.get('/api/status', (_req, res) => {
      res.json(this.state)
    })

    // Trigger manual scan
    this.app.post('/api/scan', (_req, res) => {
      this.io.emit('command', { type: 'scan_now' })
      res.json({ success: true, message: 'Scan triggered' })
    })

    // Trigger ping to dashboard
    this.app.post('/api/ping', (_req, res) => {
      this.io.emit('command', { type: 'ping' })
      res.json({ success: true, message: 'Ping sent' })
    })

    // Fallback to index.html for SPA routing
    this.app.get('/{*path}', (_req, res) => {
      res.sendFile(path.join(publicPath, 'index.html'))
    })
  }

  private setupSocketIO(): void {
    this.io.use((socket, next) => {
      const session = this.getSessionFromSocket(socket.handshake as unknown as { headers: Record<string, unknown>; auth?: Record<string, unknown> })
      if (session) {
        next()
        return
      }

      const token = this.getLegacySocketToken(socket.handshake as unknown as { headers: Record<string, unknown>; auth?: Record<string, unknown> })
      if (this.isLegacyTokenValid(token)) {
        next()
        return
      }

      next(new Error('unauthorized'))
    })

    this.io.on('connection', (socket) => {
      this.logger.debug(`UI client connected: ${socket.id}`)

      // Send current state on connect
      socket.emit('state', this.state)

      socket.on('disconnect', () => {
        this.logger.debug(`UI client disconnected: ${socket.id}`)
      })

      // Handle command requests from UI
      socket.on('command', (cmd: { type: string; payload?: unknown }) => {
        this.logger.info(`UI command: ${cmd.type}`)
        // Emit to all clients so the main agent loop can pick it up
        this.io.emit('command', cmd)
      })
    })
  }

  // Update methods called from the main agent loop

  updateConnection(connected: boolean, agentId?: string, organizationId?: string): void {
    this.state.connected = connected
    if (agentId) this.state.agentId = agentId
    if (organizationId) this.state.organizationId = organizationId
    this.state.lastHeartbeat = new Date().toISOString()
    this.io.emit('connection', {
      connected,
      agentId: this.state.agentId,
      organizationId: this.state.organizationId,
      lastHeartbeat: this.state.lastHeartbeat,
    })
  }

  updateSegments(segments: SegmentInfo[]): void {
    this.state.segments = segments
    this.io.emit('segments', segments)
  }

  updateSegmentScanning(segmentId: string, scanning: boolean): void {
    const segment = this.state.segments.find(s => s.id === segmentId)
    if (segment) {
      segment.scanning = scanning
      if (!scanning) {
        segment.lastScan = new Date().toISOString()
      }
    }
    this.state.scanning = this.state.segments.some(s => s.scanning)
    this.io.emit('segments', this.state.segments)
    this.io.emit('scanning', this.state.scanning)
  }

  updateDevices(devices: DeviceInfo[]): void {
    this.state.devices = devices
    this.io.emit('devices', devices)
  }

  addDevice(device: DeviceInfo): void {
    const existing = this.state.devices.findIndex(d => d.id === device.id)
    if (existing >= 0) {
      this.state.devices[existing] = device
    } else {
      this.state.devices.push(device)
    }
    this.io.emit('devices', this.state.devices)
  }

  updateDeviceStatus(deviceId: string, status: DeviceInfo['status'], responseTime?: number): void {
    const device = this.state.devices.find(d => d.id === deviceId)
    if (device) {
      device.status = status
      device.responseTime = responseTime
      device.lastCheck = new Date().toISOString()
      this.io.emit('device_status', { id: deviceId, status, responseTime })
    }
  }

  updateVersionInfo(latest: string | null, updateAvailable: boolean): void {
    this.state.versionInfo = {
      current: this.state.version,
      latest,
      updateAvailable,
    }
    this.io.emit('version_info', this.state.versionInfo)
  }

  updateConfig(config: Partial<AgentConfig>): void {
    this.state.config = { ...this.state.config, ...config }
    this.io.emit('config_update', this.state.config)
  }

  private startHealthUpdates(): void {
    if (!this.enabled) return

    // Update health stats every 5 seconds
    this.healthInterval = setInterval(() => {
      const mem = process.memoryUsage()
      this.state.health = {
        uptime: process.uptime(),
        memoryUsedMB: Math.round(mem.rss / 1024 / 1024),
        memoryTotalMB: Math.round(os.totalmem() / 1024 / 1024),
        cpuUsage: Math.round(os.loadavg()[0] * 100) / 100,
        startedAt: this.startedAt,
      }
      this.cleanupExpiredAuthState()
      this.io.emit('health', this.state.health)
    }, 5000)
  }

  addLog(level: LogEntry['level'], message: string): void {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
    }

    // Keep last 100 logs
    this.state.logs.unshift(entry)
    if (this.state.logs.length > 100) {
      this.state.logs = this.state.logs.slice(0, 100)
    }

    this.io.emit('log', entry)
  }

  // Start the server
  async start(): Promise<void> {
    if (!this.enabled) {
      this.logger.info('Agent UI disabled (AGENT_UI_ENABLED=false)')
      return
    }

    return new Promise((resolve) => {
      this.httpServer.listen(this.port, this.host, () => {
        this.logger.info(`Agent UI available at http://${this.host}:${this.port}`)
        resolve()
      })
    })
  }

  // Stop the server
  async stop(): Promise<void> {
    if (this.healthInterval) {
      clearInterval(this.healthInterval)
      this.healthInterval = null
    }
    return new Promise((resolve, reject) => {
      this.io.close()
      this.httpServer.close((err) => {
        if (err) reject(err)
        else resolve()
      })
    })
  }

  // Get Socket.IO instance for external event handling
  getIO(): SocketIOServer {
    return this.io
  }

  isEnabled(): boolean {
    return this.enabled
  }

  getAuthToken(): string {
    return this.authToken
  }

  getAccessUrl(): string {
    return `http://${this.host}:${this.port}`
  }

  getCurrentSetupCode(): string {
    this.cleanupExpiredAuthState()
    return this.setupCode
  }

  regenerateSetupCode(): string {
    return this.rotateSetupCode('manual')
  }
}
