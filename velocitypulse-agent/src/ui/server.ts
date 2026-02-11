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

    this.setupRoutes()
    this.setupSocketIO()
    this.startHealthUpdates()
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

  private extractBearerToken(headerValue?: string): string | null {
    if (!headerValue) return null
    const [scheme, token] = headerValue.split(' ')
    if (scheme?.toLowerCase() !== 'bearer' || !token) return null
    return token.trim()
  }

  private getRequestToken(req: express.Request): string | null {
    const queryToken = typeof req.query.token === 'string' ? req.query.token.trim() : ''
    if (queryToken) return queryToken

    const headerToken = req.headers['x-agent-ui-token']
    if (typeof headerToken === 'string' && headerToken.trim()) {
      return headerToken.trim()
    }

    const bearerToken = this.extractBearerToken(req.headers.authorization)
    if (bearerToken) return bearerToken

    const cookies = this.parseCookies(req.headers.cookie)
    if (cookies.vp_ui_token) return cookies.vp_ui_token

    return null
  }

  private getSocketToken(handshake: { headers: Record<string, unknown>; auth?: Record<string, unknown> }): string | null {
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

    const cookieHeader = handshake.headers.cookie
    if (typeof cookieHeader === 'string') {
      const cookies = this.parseCookies(cookieHeader)
      if (cookies.vp_ui_token) return cookies.vp_ui_token
    }

    return null
  }

  private isTokenValid(token: string | null): boolean {
    return !!token && token === this.authToken
  }

  private enforceRequestAuth(req: express.Request, res: express.Response, next: express.NextFunction): void {
    const token = this.getRequestToken(req)
    if (!this.isTokenValid(token)) {
      if (req.path.startsWith('/api/')) {
        res.status(401).json({ error: 'Unauthorized' })
      } else {
        res.status(401).send('Unauthorized. Open this UI with ?token=<AGENT_UI_AUTH_TOKEN> once to establish a session.')
      }
      return
    }

    // Persist a strict local-only cookie so users do not need token query params repeatedly.
    if (typeof req.query.token === 'string' && req.query.token.trim()) {
      res.setHeader('Set-Cookie', `vp_ui_token=${encodeURIComponent(this.authToken)}; HttpOnly; SameSite=Strict; Path=/`)
    }

    next()
  }

  private setupRoutes(): void {
    this.app.disable('x-powered-by')

    this.app.use((req, res, next) => this.enforceRequestAuth(req, res, next))

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
      const token = this.getSocketToken(socket.handshake as unknown as { headers: Record<string, unknown>; auth?: Record<string, unknown> })
      if (!this.isTokenValid(token)) {
        next(new Error('unauthorized'))
        return
      }
      next()
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
}
