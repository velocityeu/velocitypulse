import { Server as SocketIOServer } from 'socket.io'
import type { Server as HTTPServer } from 'http'
import type {
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData,
} from './types'
import { handleAgentConnection } from './agent-handler'

let io: SocketIOServer<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData> | null = null

// Ping interval for health checks (30 seconds)
const PING_INTERVAL = 30000
// Ping timeout (90 seconds - agent marked offline if no pong received)
const PING_TIMEOUT = 90000

/**
 * Initialize Socket.IO server
 * Can be attached to an existing HTTP server or create its own
 */
export function initializeSocketServer(
  httpServer: HTTPServer,
  options?: {
    path?: string
    cors?: {
      origin: string | string[]
      credentials?: boolean
    }
  }
): SocketIOServer<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData> {
  if (io) {
    console.log('[Socket] Server already initialized')
    return io
  }

  io = new SocketIOServer(httpServer, {
    path: options?.path || '/socket.io',
    cors: options?.cors || {
      origin: process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
      credentials: true,
    },
    pingInterval: PING_INTERVAL,
    pingTimeout: PING_TIMEOUT,
    transports: ['websocket', 'polling'],
  })

  // Agent namespace - all agent connections go here
  const agentNamespace = io.of('/agent')

  agentNamespace.on('connection', (socket) => {
    handleAgentConnection(socket, io!)
  })

  console.log('[Socket] Server initialized')

  // Start ping interval for connected agents
  setInterval(() => {
    agentNamespace.emit('ping')
  }, PING_INTERVAL)

  return io
}

/**
 * Get the Socket.IO server instance
 */
export function getSocketServer(): SocketIOServer<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData> | null {
  return io
}

/**
 * Shutdown the Socket.IO server
 */
export async function shutdownSocketServer(): Promise<void> {
  if (io) {
    await io.close()
    io = null
    console.log('[Socket] Server shutdown')
  }
}
