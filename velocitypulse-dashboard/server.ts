/**
 * Custom Next.js server with Socket.IO support
 *
 * Usage:
 * - Development: npm run dev:socket
 * - Production: npm run build && npm run start:socket
 *
 * For Vercel deployment, Socket.IO runs as a separate service.
 * This server is for local development and self-hosted deployments.
 */

import { createServer } from 'http'
import next from 'next'
import { initializeSocketServer } from './src/lib/socket/server'

const dev = process.env.NODE_ENV !== 'production'
const hostname = process.env.HOSTNAME || 'localhost'
const port = parseInt(process.env.PORT || '3000', 10)

async function main() {
  // Create Next.js app
  const app = next({ dev, hostname, port })
  const handle = app.getRequestHandler()

  await app.prepare()

  // Create HTTP server
  const httpServer = createServer((req, res) => {
    handle(req, res)
  })

  // Initialize Socket.IO
  initializeSocketServer(httpServer, {
    path: '/socket.io',
    cors: {
      origin: process.env.NEXT_PUBLIC_APP_URL || `http://${hostname}:${port}`,
      credentials: true,
    },
  })

  // Start server
  httpServer.listen(port, () => {
    console.log(`> Ready on http://${hostname}:${port}`)
    console.log(`> Socket.IO listening on ws://${hostname}:${port}/socket.io`)
    console.log(`> Agent namespace: /agent`)
  })
}

main().catch((err) => {
  console.error('Failed to start server:', err)
  process.exit(1)
})
