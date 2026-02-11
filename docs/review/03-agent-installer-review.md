# Agent + Installer + Deployment Review (Phase 1B)

Date: 2026-02-11  
Component: `velocitypulse-agent` + installer delivery (`velocitypulse-web` get routes) + release pipeline  
Method: static code review + targeted test execution (`npm test` in `velocitypulse-agent`).

## Findings (Ordered by Severity)

## P1

### 1. Linux/macOS installer pulls releases from the wrong repository

Evidence:

- Linux installer script points to `velocityeu/velocitypulse-agent` (`velocitypulse-agent/scripts/install-linux.sh:160`).
- Public installer endpoint serves the same repo target (`velocitypulse-web/app/api/get/agent-sh/route.ts:164`).
- Agent release workflow publishes `agent-v*` tags/releases from the monorepo (`.github/workflows/agent-release.yml:6`, `.github/workflows/agent-release.yml:82`).
- Windows installer is already aligned to monorepo (`velocitypulse-agent/scripts/install-windows.ps1:831`), creating cross-platform inconsistency.

Impact:

- Linux/macOS installs can fail to resolve valid release assets or pull from an unintended source.
- Production installer reliability is inconsistent across operating systems.

Recommendation:

- Standardize all installer release lookups to the monorepo (`velocityeu/velocitypulse`).
- Add CI validation that both `/agent` and `/agent.sh` resolve a valid `agent-v*` asset before deployment.

### 2. Auto-upgrade download URL defaults are incompatible with upgrader expectations

Evidence:

- Default upgrade URL is `https://github.com/velocityeu/velocitypulse-agent/releases/latest` (`velocitypulse-dashboard/src/lib/constants.ts:11`).
- Heartbeat auto-upgrade command queues this value as `download_url` (`velocitypulse-dashboard/src/app/api/agent/heartbeat/route.ts:138`).
- Upgrader expects direct `.tar.gz` or `.zip` archive URLs and immediately extracts them (`velocitypulse-agent/src/upgrade/upgrader.ts:109`, `velocitypulse-agent/src/upgrade/upgrader.ts:126`, `velocitypulse-agent/src/upgrade/upgrader.ts:133`).

Impact:

- If env overrides are missing/mis-set, upgrade commands can consistently fail at runtime.
- Agent fleet upgrade behavior becomes environment-fragile.

Recommendation:

- Require `AGENT_DOWNLOAD_URL` to be an explicit archive asset URL (or signed manifest endpoint).
- Validate URL shape at dashboard startup and reject non-archive defaults.

### 3. Upgrade path can deploy new code without required dependencies

Evidence:

- Release archives contain `dist`, `package.json`, and `package-lock.json`, but not `node_modules` (`.github/workflows/agent-release.yml:71`, `.github/workflows/agent-release.yml:72`).
- Upgrader copies `node_modules` only if present in downloaded archive and does not run `npm install` (`velocitypulse-agent/src/upgrade/upgrader.ts:220`, `velocitypulse-agent/src/upgrade/upgrader.ts:302`).

Impact:

- Upgrades that introduce new dependencies can restart into broken runtime state.
- Fleet-wide upgrade attempts can cause outages or repeated restart failures.

Recommendation:

- Post-swap, run `npm ci --omit=dev` (or equivalent deterministic dependency step) before service restart.
- Add rollback-on-health-check-failure behavior after upgrade.

### 4. Agent local UI is unauthenticated and exposed on all interfaces by default

Evidence:

- UI Socket.IO CORS allows any origin (`velocitypulse-agent/src/ui/server.ts:94`).
- Management endpoints (`/api/status`, `/api/scan`, `/api/ping`) have no auth (`velocitypulse-agent/src/ui/server.ts:146`, `velocitypulse-agent/src/ui/server.ts:151`, `velocitypulse-agent/src/ui/server.ts:157`).
- Server binds with default host (all interfaces) (`velocitypulse-agent/src/ui/server.ts:294`).

Impact:

- Any reachable host on the network can inspect agent state (including discovered devices/logs) and trigger commands.
- Increases attack surface for internal network actors and lateral movement scenarios.

Recommendation:

- Bind UI to `127.0.0.1` by default.
- Require auth token/session for all UI APIs and Socket events.
- Add explicit hard-disable option for UI in production agent deployments.

### 5. Release workflow can publish artifacts even when tests fail

Evidence:

- Workflow marks test step as non-blocking (`.github/workflows/agent-release.yml:64`).
- Current local run shows failing test file: `src/scanner/discover.test.ts` (4 timeouts) while other suites pass.

Impact:

- Broken behavior can be released as official agent artifacts.
- Commercial deployment confidence is reduced for agent updates.

Recommendation:

- Remove `continue-on-error` for tests in release workflow.
- Fix `discover` test suite and gate release on all tests passing.

## P2

### 6. Heartbeat retry backoff is calculated but never applied

Evidence:

- `retryDelay` is updated on heartbeat failures (`velocitypulse-agent/src/index.ts:252`) but loop sleep uses fixed interval (`velocitypulse-agent/src/index.ts:256`).

Impact:

- Backoff logic is effectively dead code.
- Agent recovery/load behavior under outages is less controlled than intended.

Recommendation:

- Use dynamic sleep based on success/failure state (`retryDelay` on failure, configured heartbeat on success).

### 7. Manual dashboard “Upgrade Agent” command cannot succeed with current payload contract

Evidence:

- Dashboard sends only `command_type` for agent commands (`velocitypulse-dashboard/src/app/(dashboard)/agents/page.tsx:136`).
- Agent requires `target_version` and `download_url` for `upgrade` command (`velocitypulse-agent/src/index.ts:817`).

Impact:

- “Upgrade Agent” button can enqueue commands that fail immediately on agent side.
- Operator expectation diverges from actual behavior.

Recommendation:

- Enrich upgrade command payload at dispatch time (version + signed download URL), or have server resolve payload before insert.
- Add API validation for command-specific required payload fields.

### 8. Linux service hardening is explicitly weakened while running as root

Evidence:

- Installer creates systemd service as root (`velocitypulse-agent/scripts/install-linux.sh:321`).
- Hardening flags are permissive (`NoNewPrivileges=false`, `ProtectSystem=false`) (`velocitypulse-agent/scripts/install-linux.sh:334`, `velocitypulse-agent/scripts/install-linux.sh:335`).

Impact:

- Increases blast radius for runtime compromise or exploit in agent process/dependencies.

Recommendation:

- Run as dedicated least-privilege service user.
- Enable stricter systemd sandboxing (`NoNewPrivileges=true`, `ProtectSystem=strict`, narrowed writable paths/capabilities).

## P3

### 9. Multiple installer generations remain in repo and increase maintenance drift risk

Evidence:

- Deprecated installers still present and executable (`velocitypulse-agent/scripts/install.sh:22`, `velocitypulse-agent/scripts/install.ps1:42`).
- New installers are separately inlined in marketing API routes (`velocitypulse-web/app/api/get/agent/route.ts:1`, `velocitypulse-web/app/api/get/agent-sh/route.ts:1`).

Impact:

- Higher chance of behavioral drift and confusion about source-of-truth during urgent release fixes.

Recommendation:

- Keep one canonical installer implementation per platform and generate served scripts from source during build.
- Archive/remove deprecated installers from primary operational paths.

## Test Baseline

Executed:

- `npm test` in `velocitypulse-agent` -> **34 passed, 4 failed** (`src/scanner/discover.test.ts` timed out).

Observation:

- Current release workflow still allows publishing even when this failure persists.

## Open Questions / Assumptions

1. Is there an intentional separate public repository (`velocityeu/velocitypulse-agent`) that should remain Linux installer source, or is monorepo (`velocityeu/velocitypulse`) the canonical release source?
2. Should agent UI be reachable remotely for support workflows, or only localhost with optional secure tunnel?
3. Should auto-upgrades be launch-enabled, or disabled until signed artifact + dependency-safe upgrade flow is implemented?

## Remediation Plan (Agent/Installer/Deployment Component)

1. Installer/release source alignment (P1): unify repo/asset source for Linux, Windows, and hosted install endpoints; add CI smoke checks.
2. Upgrade safety hardening (P1): enforce valid archive URL policy, install dependencies during upgrade, and add health-check rollback.
3. Agent UI security hardening (P1): localhost bind + auth + configurable disable.
4. Release quality gate (P1): make tests mandatory in `agent-release` workflow and fix `discover` test suite.
5. Runtime resilience cleanup (P2): wire effective heartbeat backoff and command payload validation for `upgrade`.
