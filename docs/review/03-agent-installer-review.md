# Agent + Installer + Deployment Review (Phase 1B Revalidation)

Date: 2026-02-11  
Component: `velocitypulse-agent` + installer delivery (`velocitypulse-web` get routes) + release pipeline  
Method: static code revalidation + targeted test execution (`npm test` and `npm run build` in `velocitypulse-agent`).

## Current Status

Previous P1 findings for installer source drift, upgrade safety, UI exposure, release test gating, and manual upgrade payloads are now materially remediated.

## Closed P1 Findings

### 1. Linux/macOS installer release source alignment

Evidence:

- `velocitypulse-agent/scripts/install-linux.sh:160`
- `velocitypulse-web/app/api/get/agent-sh/route.ts:164`

Result:

- Linux/macOS installer and hosted `agent.sh` now target monorepo release source (`velocityeu/velocitypulse`) consistently with Windows.

### 2. Upgrade URL contract and dashboard defaults

Evidence:

- `velocitypulse-dashboard/src/lib/constants.ts:12`
- `velocitypulse-dashboard/src/app/api/agent/heartbeat/route.ts:89`
- `velocitypulse-dashboard/src/app/api/dashboard/agents/[id]/commands/route.ts:54`
- `velocitypulse-agent/src/upgrade/upgrader.ts:245`

Result:

- Dashboard now resolves archive-safe upgrade URLs, and agent upgrader enforces archive/manifest URL formats.

### 3. Dependency-safe upgrade + rollback/health checks

Evidence:

- `velocitypulse-agent/src/upgrade/upgrader.ts:454`
- `velocitypulse-agent/src/upgrade/upgrader.ts:599`
- `velocitypulse-agent/src/upgrade/upgrader.ts:512`

Result:

- Upgrade flow now installs dependencies during upgrade (`npm ci --omit=dev`) and performs rollback/restart recovery on failure paths.

### 4. Local UI security hardening

Evidence:

- `velocitypulse-agent/src/ui/server.ts:416`
- `velocitypulse-agent/src/index.ts:87`
- `velocitypulse-agent/scripts/install-linux.sh:296`

Result:

- UI now supports localhost-default host, token-based auth on HTTP/Socket paths, and explicit disable via `AGENT_UI_ENABLED=false`.

### 5. Release pipeline test gating

Evidence:

- `.github/workflows/agent-release.yml:62`

Result:

- Agent release workflow no longer allows test failures to pass release.

### 6. Runtime backoff + manual upgrade payloads

Evidence:

- `velocitypulse-agent/src/index.ts:269`
- `velocitypulse-dashboard/src/app/api/dashboard/agents/[id]/commands/route.ts:70`

Result:

- Heartbeat retry backoff is now applied to sleep timing, and dashboard manual `upgrade` commands now include validated payload defaults.

## Remaining Findings

## P2

### 1. Linux service still runs as root with permissive hardening flags

Evidence:

- `velocitypulse-agent/scripts/install-linux.sh:327`
- `velocitypulse-agent/scripts/install-linux.sh:340`

Impact:

- Blast radius remains larger than necessary for production compromise scenarios.

Recommendation:

- Move to dedicated service user + stricter systemd sandboxing (`NoNewPrivileges=true`, reduced writable paths/capabilities).

### 2. Installer script duplication across source + hosted route persists

Evidence:

- `velocitypulse-agent/scripts/install-linux.sh:1`
- `velocitypulse-web/app/api/get/agent-sh/route.ts:1`

Impact:

- Manual sync risk still exists for future urgent fixes.

Recommendation:

- Generate hosted script from canonical source at build time, with checksum assertion in CI.

## Test Baseline

Executed:

- `npm test` in `velocitypulse-agent` -> **38/38 passed**.
- `npm run build` in `velocitypulse-agent` -> **passed**.

## Component Verdict

Current status: **No open P1 blockers in this component after remediation; remaining hardening is P2.**
