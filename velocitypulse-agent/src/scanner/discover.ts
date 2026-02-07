import { isLocalNetwork, isInCidr } from '../utils/ip-utils.js'
import { arpScan, populateArpCache, type DiscoveredDevice } from './arp.js'
import { pingSweep } from './ping-sweep.js'
import { mdnsScan } from './mdns.js'
import { ssdpScan } from './ssdp.js'
import type { Logger } from '../utils/logger.js'

export type { DiscoveredDevice }

/**
 * Merge discovered devices from multiple sources, deduplicating by IP.
 * Prioritizes richer data: MAC from ARP, hostname from mDNS, UPnP info from SSDP.
 */
function mergeDiscoveredDevices(...deviceArrays: DiscoveredDevice[][]): DiscoveredDevice[] {
  const merged = new Map<string, DiscoveredDevice>()

  for (const devices of deviceArrays) {
    for (const device of devices) {
      const existing = merged.get(device.ip_address)
      if (!existing) {
        merged.set(device.ip_address, { ...device })
      } else {
        // Merge fields, preferring non-empty values
        if (device.mac_address && !existing.mac_address) existing.mac_address = device.mac_address
        if (device.hostname && !existing.hostname) existing.hostname = device.hostname
        if (device.manufacturer && !existing.manufacturer) existing.manufacturer = device.manufacturer
        if (device.upnp_info && !existing.upnp_info) existing.upnp_info = device.upnp_info
        if (device.netbios_name && !existing.netbios_name) existing.netbios_name = device.netbios_name
        if (device.snmp_info && !existing.snmp_info) existing.snmp_info = device.snmp_info

        // Merge arrays
        if (device.os_hints?.length) {
          existing.os_hints = [...new Set([...(existing.os_hints || []), ...device.os_hints])]
        }
        if (device.open_ports?.length) {
          existing.open_ports = [...new Set([...(existing.open_ports || []), ...device.open_ports])]
        }
        if (device.services?.length) {
          existing.services = [...new Set([...(existing.services || []), ...device.services])]
        }
      }
    }
  }

  return Array.from(merged.values())
}

/**
 * Unified device discovery function that selects the appropriate method
 * based on whether the target network is local or remote.
 *
 * For local networks (directly connected):
 * - Uses ARP scanning + mDNS + SSDP in parallel (fast, provides MAC, hostname, UPnP info)
 *
 * For remote networks (across routers):
 * - Uses ICMP ping sweep only (mDNS/SSDP are link-local protocols)
 *
 * @param cidr - The CIDR range to scan (e.g., "192.168.1.0/24")
 * @param logger - Logger instance for output
 * @param pingConcurrency - Concurrency for ping sweep (default 50)
 * @returns Array of discovered devices
 */
export async function discoverDevices(
  cidr: string,
  logger: Logger,
  pingConcurrency = 50
): Promise<DiscoveredDevice[]> {
  const isLocal = isLocalNetwork(cidr)

  if (isLocal) {
    logger.info(`Segment ${cidr} is LOCAL - using ARP + mDNS + SSDP discovery`)

    // Populate ARP cache first
    await populateArpCache(cidr, logger)

    // Small delay for ARP cache to populate
    await new Promise(resolve => setTimeout(resolve, 2000))

    // Run ARP + mDNS + SSDP in parallel
    const [arpDevices, mdnsDevices, ssdpDevices] = await Promise.all([
      arpScan(cidr, logger),
      mdnsScan(logger),
      ssdpScan(logger),
    ])

    logger.info(`Discovery results - ARP: ${arpDevices.length}, mDNS: ${mdnsDevices.length}, SSDP: ${ssdpDevices.length}`)

    // Filter mDNS/SSDP results to only include IPs within the target CIDR
    const filteredMdns = mdnsDevices.filter(d => isInCidr(d.ip_address, cidr))
    const filteredSsdp = ssdpDevices.filter(d => isInCidr(d.ip_address, cidr))

    if (filteredMdns.length !== mdnsDevices.length || filteredSsdp.length !== ssdpDevices.length) {
      logger.info(`After CIDR filter - mDNS: ${filteredMdns.length}, SSDP: ${filteredSsdp.length}`)
    }

    return mergeDiscoveredDevices(arpDevices, filteredMdns, filteredSsdp)
  } else {
    logger.info(`Segment ${cidr} is REMOTE - using ping sweep`)
    logger.info(`Note: MAC address and manufacturer info not available for remote networks`)

    return pingSweep(cidr, logger, pingConcurrency)
  }
}
