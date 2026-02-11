# VelocityPulse Agent

> **v1.2.3** — Multi-adapter scanning + secure local Agent UI login

Network monitoring agent for the VelocityPulse SaaS platform. Discovers devices on your network and reports their status in real-time to your VelocityPulse dashboard.

## Features

- **Automatic Device Discovery**: Scans network segments using ARP (local) or ICMP ping sweep (remote)
- **Real-time Status Monitoring**: Continuously monitors devices using ping, TCP, or HTTP checks
- **Status Hysteresis**: Prevents flapping by requiring multiple consecutive failures before marking offline
- **Multi-Adapter Detection**: Detects all physical NICs, deduplicates by CIDR, and filters virtual/container interfaces (Docker, VMware, Hyper-V, WSL)
- **Cross-platform**: Runs on Windows, Linux, and macOS
- **Service Mode**: Installs as a system service for automatic startup

## Quick Start

### Windows (One-liner)

```powershell
irm https://get.velocitypulse.io/agent | iex
```

### Linux/macOS

```bash
curl -fsSL https://get.velocitypulse.io/agent.sh | sudo bash
```

Installer modes (Linux/macOS):

```bash
# Upgrade existing install (preserve config)
curl -fsSL https://get.velocitypulse.io/agent.sh | sudo bash -s -- --upgrade

# Fresh install (remove old install and reconfigure)
curl -fsSL https://get.velocitypulse.io/agent.sh | sudo bash -s -- --fresh

# Uninstall
curl -fsSL https://get.velocitypulse.io/agent.sh | sudo bash -s -- --uninstall
```

## Public Release Source

Agent release artifacts are published publicly under:

- https://github.com/velocityeu/velocitypulse/releases (tags: `agent-v*`)
- Installers pull the latest `agent-v*` release automatically.

## Manual Installation

### Prerequisites

- Node.js 18 or higher
- Network access to VelocityPulse dashboard

### Steps

1. Clone or download this repository
2. Install dependencies:
   ```bash
   npm install
   ```
3. Build the agent:
   ```bash
   npm run build
   ```
4. Create `.env` file with your configuration (see below)
5. Start the agent:
   ```bash
   npm start
   ```

## Configuration

Create a `.env` file in the agent directory:

```env
# Required
VELOCITYPULSE_URL=https://app.velocitypulse.io
VP_API_KEY=vp_yourorg_xxxxxxxxxxxxxxxxxxxx

# Optional
AGENT_NAME=Office Network Agent
HEARTBEAT_INTERVAL=60
STATUS_CHECK_INTERVAL=30
STATUS_FAILURE_THRESHOLD=2
LOG_LEVEL=info
```

### Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `VELOCITYPULSE_URL` | Yes | - | VelocityPulse dashboard URL |
| `VP_API_KEY` | Yes | - | API key from dashboard (format: `vp_{org}_{key}`) |
| `AGENT_NAME` | No | hostname | Display name for this agent |
| `HEARTBEAT_INTERVAL` | No | 60 | Seconds between heartbeats |
| `STATUS_CHECK_INTERVAL` | No | 30 | Seconds between status checks |
| `STATUS_FAILURE_THRESHOLD` | No | 2 | Consecutive failures before offline |
| `LOG_LEVEL` | No | info | Log level (debug/info/warn/error) |
| `ENABLE_REALTIME` | No | true | Enable WebSocket real-time updates |
| `ENABLE_AUTO_SCAN` | No | true | Auto-detect and register all physical local networks |

## API Key Format

VelocityPulse API keys follow this format:
```
vp_{org_prefix}_{random_24_chars}
```

Example: `vp_acme1234_xK7mN9pQ2rStUvWxYz3456`

Get your API key from the VelocityPulse dashboard under Settings > Agents.

## Running as a Service

### Windows

The installer automatically registers a Windows service named `VelocityPulseAgent`.

Manual service management:
```powershell
# Check status
Get-Service VelocityPulseAgent

# Start/Stop/Restart
Start-Service VelocityPulseAgent
Stop-Service VelocityPulseAgent
Restart-Service VelocityPulseAgent
```

### Linux (systemd)

The installer creates a systemd service named `velocitypulse-agent`.

```bash
# Check status
systemctl status velocitypulse-agent

# Start/Stop/Restart
sudo systemctl start velocitypulse-agent
sudo systemctl stop velocitypulse-agent
sudo systemctl restart velocitypulse-agent

# View logs
journalctl -u velocitypulse-agent -f
```

### macOS (launchd)

The installer creates a launchd plist at `/Library/LaunchDaemons/io.velocitypulse.agent.plist`.

```bash
# Check status
sudo launchctl list | grep velocitypulse

# Start/Stop
sudo launchctl load /Library/LaunchDaemons/io.velocitypulse.agent.plist
sudo launchctl unload /Library/LaunchDaemons/io.velocitypulse.agent.plist
```

## Development

```bash
# Install dependencies
npm install

# Run in development mode (auto-reload)
npm run dev

# Build for production
npm run build

# Run tests
npm test
```

## Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│                     VelocityPulse Agent                          │
├──────────────────────────────────────────────────────────────────┤
│  ┌──────────────────┐                                            │
│  │  Multi-Adapter    │  Detects physical NICs, filters virtual   │
│  │  Detection        │  interfaces, deduplicates by CIDR         │
│  └────────┬─────────┘                                            │
│           ▼                                                      │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐      │
│  │  Heartbeat  │  │   Scanner   │  │   Status Checker    │      │
│  │    Loop     │  │    Loop     │  │       Loop          │      │
│  └──────┬──────┘  └──────┬──────┘  └──────────┬──────────┘      │
│         │                │                     │                 │
│         ▼                ▼                     ▼                 │
│  ┌──────────────────────────────────────────────────────────┐    │
│  │                   Dashboard Client                        │    │
│  │         (REST API + WebSocket Real-time)                  │    │
│  └──────────────────────────────────────────────────────────┘    │
└──────────────────────────────────────────────────────────────────┘
                              │
                              ▼
                ┌─────────────────────────┐
                │  VelocityPulse Dashboard │
                │    (SaaS Platform)       │
                └─────────────────────────┘
```

## v1.1.0 Highlights

- **Multi-adapter detection** — The agent now calls `os.networkInterfaces()` and discovers all physical NICs, not just the primary one. Each detected network segment is registered with the dashboard automatically.
- **CIDR deduplication** — If two adapters share the same subnet (e.g. bonded NICs), the agent deduplicates by CIDR before registering, preventing duplicate segments.
- **Virtual interface filtering** — Docker (`docker0`, `br-*`, `veth*`), VMware (`vmnet*`), Hyper-V (`vEthernet*`), WSL, `utun`, `llw`, `bridge`, and loopback interfaces are automatically excluded.
- **Idempotent registration** — Segment registration matches on CIDR alone (regardless of segment name), so re-registrations are safely deduplicated on the server side.
- **Graceful per-segment error handling** — If one segment fails to register or scan, the agent logs the error and continues with the remaining segments.

## Troubleshooting

### Agent won't connect

1. Verify `VELOCITYPULSE_URL` is correct
2. Check API key format starts with `vp_`
3. Ensure firewall allows outbound HTTPS (port 443)
4. Check logs in `./logs/` directory

### Devices not discovered

1. Verify agent has network access to target segments
2. For remote networks, ensure ICMP is allowed through firewalls
3. Check if segments are assigned in the dashboard

### Multi-adapter: some segments not registering

1. Run with `LOG_LEVEL=debug` to see which interfaces are detected and which are filtered
2. Virtual interfaces (Docker, VMware, Hyper-V, WSL) are excluded by default
3. Verify the interface has a valid IPv4 address with a subnet mask
4. Check that the CIDR isn't already registered under a different name (CIDR-based dedup)

### Status always shows offline

1. Check `STATUS_FAILURE_THRESHOLD` setting
2. Verify devices respond to ping/TCP/HTTP checks
3. Review agent logs for check failures

## License

MIT License - See LICENSE file for details.

## Support

- Documentation: https://docs.velocitypulse.io
- Issues: https://github.com/velocityeu/velocitypulse/issues
- Email: support@velocitypulse.io
