import os from 'os'
import { loadConfig } from './config.js'
import { createLogger } from './utils/logger.js'
import { VERSION, PRODUCT_NAME } from './utils/version.js'
import { DashboardClient, type NetworkSegment, type DeviceToMonitor, type StatusReport } from './api/client.js'
import { discoverDevices } from './scanner/discover.js'
import { pingHost } from './scanner/ping.js'
import { checkTcpPort } from './scanner/tcp.js'
import { checkHttp } from './scanner/http.js'
import { getPrimaryLocalNetwork, generateAutoSegmentName } from './utils/network-detect.js'

interface SegmentState {
  segment: NetworkSegment
  lastScan: number
  scanning: boolean
}

// Track consecutive failures for status hysteresis
const deviceFailureCounts = new Map<string, number>()
const lastKnownStatus = new Map<string, 'online' | 'offline' | 'degraded' | 'unknown'>()

/**
 * Prune device tracking maps to only active devices
 * This prevents memory leaks without resetting all hysteresis state
 */
function pruneDeviceTracking(activeKeys: Set<string>, logger: ReturnType<typeof createLogger>): void {
  let removedCount = 0
  for (const key of deviceFailureCounts.keys()) {
    if (!activeKeys.has(key)) {
      deviceFailureCounts.delete(key)
      lastKnownStatus.delete(key)
      removedCount++
    }
  }

  if (removedCount > 0) {
    logger.debug(`Pruned ${removedCount} device tracking entries`)
  }
}

async function main() {
  console.log(`
+============================================+
|     ${PRODUCT_NAME} v${VERSION}             |
|     Network Discovery & Monitoring         |
+============================================+
`)

  // Load configuration
  const config = loadConfig()
  const logger = createLogger(config.logLevel, config.logDir)

  logger.info(`Starting ${PRODUCT_NAME} v${VERSION}`)
  logger.info(`Agent name: ${config.agentName}`)
  logger.info(`Dashboard URL: ${config.dashboardUrl}`)

  // Create dashboard client
  const client = new DashboardClient(config.dashboardUrl, config.apiKey, logger)

  // Track segment scan states
  const segmentStates = new Map<string, SegmentState>()

  // Agent state
  let agentId: string | null = null
  let organizationId: string | null = null
  let isRunning = true

  // Graceful shutdown
  const shutdown = () => {
    logger.info('Shutting down...')
    isRunning = false
    process.exit(0)
  }

  process.on('SIGINT', shutdown)
  process.on('SIGTERM', shutdown)

  /**
   * Heartbeat loop - maintains connection with dashboard
   */
  async function heartbeatLoop() {
    const hostname = os.hostname()
    let retryDelay = 2000

    while (isRunning) {
      try {
        const response = await client.heartbeat(VERSION, hostname)
        agentId = response.agent_id
        organizationId = response.organization_id

        logger.debug(`Heartbeat OK - Agent: ${agentId}, Org: ${organizationId}`)

        // Update segments
        const currentSegmentIds = new Set(response.segments.map(s => s.id))

        // Remove old segments
        for (const [id] of segmentStates) {
          if (!currentSegmentIds.has(id)) {
            logger.info(`Segment removed: ${id}`)
            segmentStates.delete(id)
          }
        }

        // Add/update segments
        for (const segment of response.segments) {
          if (!segmentStates.has(segment.id)) {
            logger.info(`Segment added: ${segment.name} (${segment.cidr})`)
            segmentStates.set(segment.id, {
              segment,
              lastScan: 0,
              scanning: false,
            })
          } else {
            const state = segmentStates.get(segment.id)!
            state.segment = segment
          }
        }

        // Check for upgrade
        if (response.upgrade_available && response.latest_agent_version) {
          logger.info(`Upgrade available: ${VERSION} -> ${response.latest_agent_version}`)
        }

        // Reset retry delay on success
        retryDelay = 2000

      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Unknown error'
        logger.warn(`Heartbeat failed: ${errorMsg}`)

        // Exponential backoff
        retryDelay = Math.min(retryDelay * 2, 60000)
      }

      // Wait before next heartbeat (max 60 seconds, configurable)
      await new Promise(resolve => setTimeout(resolve, Math.min(config.heartbeatInterval, 60000)))
    }
  }

  /**
   * Scan loop - discovers devices on network segments
   */
  async function scanLoop() {
    while (isRunning) {
      const now = Date.now()

      for (const [id, state] of segmentStates) {
        const { segment, lastScan, scanning } = state
        const scanInterval = segment.scan_interval_seconds * 1000

        // Skip if already scanning or not due yet
        if (scanning || (now - lastScan) < scanInterval) {
          continue
        }

        // Mark as scanning
        state.scanning = true
        state.lastScan = now

        logger.info(`Scanning segment: ${segment.name} (${segment.cidr})`)

        try {
          const devices = await discoverDevices(segment.cidr, logger)
          logger.info(`Discovered ${devices.length} devices in ${segment.name}`)

          if (devices.length > 0) {
            const response = await client.uploadDiscoveredDevices(segment.id, devices)
            logger.debug(`Upload result: ${response.created} created, ${response.updated} updated`)
          }
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : 'Unknown error'
          logger.error(`Scan failed for ${segment.name}: ${errorMsg}`)
        } finally {
          state.scanning = false
        }
      }

      // Short sleep between scan checks
      await new Promise(resolve => setTimeout(resolve, 5000))
    }
  }

  /**
   * Status check loop - monitors device health
   */
  async function statusCheckLoop() {
    while (isRunning) {
      try {
        const devices = await client.getDevicesToMonitor()
        const monitoredDevices = devices.filter(d => d.is_monitored)

        if (monitoredDevices.length === 0) {
          logger.debug('No devices to monitor')
          await new Promise(resolve => setTimeout(resolve, config.statusCheckInterval))
          continue
        }

        logger.debug(`Checking status of ${monitoredDevices.length} devices`)

        const reports: StatusReport[] = []
        const activeKeys = new Set<string>()

        for (const device of monitoredDevices) {
          const deviceKey = `${device.id}-${device.ip_address}`
          activeKeys.add(deviceKey)

          let status: 'online' | 'offline' | 'degraded' | 'unknown' = 'unknown'
          let responseTime: number | null = null
          let error: string | undefined

          try {
            if (device.check_type === 'ping' && device.ip_address) {
              const result = await pingHost(device.ip_address, logger)
              status = result.status
              responseTime = result.response_time_ms
              error = result.error
            } else if (device.check_type === 'tcp' && device.ip_address && device.port) {
              const result = await checkTcpPort(device.ip_address, device.port, logger)
              status = result.status
              responseTime = result.response_time_ms
              error = result.error
            } else if (device.check_type === 'http' && device.url) {
              const result = await checkHttp(device.url, logger)
              status = result.status
              responseTime = result.response_time_ms
              error = result.error
            }
          } catch (err) {
            status = 'unknown'
            error = err instanceof Error ? err.message : 'Check failed'
          }

          // Apply hysteresis for status changes
          const previousStatus = lastKnownStatus.get(deviceKey)
          const failureCount = deviceFailureCounts.get(deviceKey) || 0

          if (status === 'offline' && previousStatus === 'online') {
            // Don't immediately report offline, wait for threshold
            if (failureCount < config.statusFailureThreshold) {
              deviceFailureCounts.set(deviceKey, failureCount + 1)
              status = 'online' // Keep reporting as online until threshold reached
            }
          } else if (status === 'online') {
            // Reset failure count on success
            deviceFailureCounts.set(deviceKey, 0)
          }

          lastKnownStatus.set(deviceKey, status)

          reports.push({
            device_id: device.id,
            ip_address: device.ip_address || '',
            status,
            response_time_ms: responseTime,
            check_type: device.check_type,
            checked_at: new Date().toISOString(),
            error,
          })
        }

        // Prune old device tracking entries
        pruneDeviceTracking(activeKeys, logger)

        // Upload status reports
        if (reports.length > 0) {
          const response = await client.uploadStatusReports(reports)
          logger.debug(`Status upload: ${response.processed} processed`)
        }

      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Unknown error'
        logger.error(`Status check failed: ${errorMsg}`)
      }

      await new Promise(resolve => setTimeout(resolve, config.statusCheckInterval))
    }
  }

  /**
   * Auto-scan - detect and register local network if no segments assigned
   */
  async function autoScanCheck() {
    // Wait for first heartbeat
    await new Promise(resolve => setTimeout(resolve, 5000))

    if (!config.enableAutoScan) {
      return
    }

    // Check if we have any segments
    if (segmentStates.size === 0) {
      logger.info('No segments assigned - attempting auto-detection')

      const localNetwork = getPrimaryLocalNetwork()
      if (localNetwork) {
        const segmentName = generateAutoSegmentName(localNetwork)
        logger.info(`Detected local network: ${segmentName}`)

        try {
          const segment = await client.registerAutoSegment({
            cidr: localNetwork.cidr,
            name: segmentName,
            interface_name: localNetwork.interfaceName,
          })

          logger.info(`Auto-registered segment: ${segment.name}`)
          segmentStates.set(segment.id, {
            segment,
            lastScan: 0,
            scanning: false,
          })
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : 'Unknown error'
          logger.warn(`Failed to register auto-segment: ${errorMsg}`)
        }
      } else {
        logger.warn('Could not detect local network for auto-scan')
      }
    }
  }

  // Start all loops
  logger.info('Starting agent loops...')

  // Run autoScanCheck once
  autoScanCheck()

  // Start concurrent loops
  Promise.all([
    heartbeatLoop(),
    scanLoop(),
    statusCheckLoop(),
  ]).catch(error => {
    logger.error(`Fatal error: ${error instanceof Error ? error.message : 'Unknown error'}`)
    process.exit(1)
  })
}

// Start the agent
main().catch(error => {
  console.error('Failed to start agent:', error)
  process.exit(1)
})
