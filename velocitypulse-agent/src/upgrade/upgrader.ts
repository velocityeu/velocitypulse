import { exec, spawn } from 'child_process'
import { promisify } from 'util'
import * as fs from 'fs'
import * as path from 'path'
import * as os from 'os'
import * as https from 'https'
import * as http from 'http'
import type { Logger } from '../utils/logger.js'
import { VERSION } from '../utils/version.js'

const execAsync = promisify(exec)
const fsPromises = fs.promises
const MAX_REDIRECTS = 5
const DEFAULT_DOWNLOAD_TEMPLATE =
  'https://github.com/velocityeu/velocitypulse/releases/download/agent-v{version}/velocitypulse-agent-{version}.{ext}'

type ArchiveExtension = '.tar.gz' | '.zip'

type RuntimePlatform = 'linux' | 'darwin' | 'win32'

export interface UpgradeResult {
  success: boolean
  message: string
  previousVersion: string
  targetVersion?: string
}

function normalizePlatform(platform: NodeJS.Platform): RuntimePlatform {
  if (platform === 'win32' || platform === 'darwin' || platform === 'linux') {
    return platform
  }

  return 'linux'
}

function extensionForPlatform(platform: RuntimePlatform): ArchiveExtension {
  return platform === 'win32' ? '.zip' : '.tar.gz'
}

function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value)
    return url.protocol === 'http:' || url.protocol === 'https:'
  } catch {
    return false
  }
}

function resolveRedirect(currentUrl: string, locationHeader: string): string {
  return new URL(locationHeader, currentUrl).toString()
}

function detectArchiveExtension(value: string): ArchiveExtension | null {
  const base = value.split('?')[0]?.split('#')[0] ?? value

  if (base.endsWith('.tar.gz')) return '.tar.gz'
  if (base.endsWith('.zip')) return '.zip'

  return null
}

function isManifestUrl(value: string): boolean {
  const base = value.split('?')[0]?.split('#')[0] ?? value
  return base.endsWith('.json')
}

function resolveTemplate(input: string, targetVersion: string, platform: RuntimePlatform): string {
  const ext = extensionForPlatform(platform).replace(/^\./, '')

  return input
    .replaceAll('{version}', targetVersion)
    .replaceAll('{platform}', platform)
    .replaceAll('{ext}', ext)
}

function normalizeDownloadUrl(input: string, targetVersion: string, platform: RuntimePlatform): string {
  const raw = input.trim()
  const withTemplate = raw || DEFAULT_DOWNLOAD_TEMPLATE

  if (withTemplate.includes('/releases/latest')) {
    return resolveTemplate(DEFAULT_DOWNLOAD_TEMPLATE, targetVersion, platform)
  }

  return resolveTemplate(withTemplate, targetVersion, platform)
}

function downloadFile(url: string, dest: string, redirects = 0): Promise<void> {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest)
    const protocol = url.startsWith('https') ? https : http

    protocol.get(url, (response) => {
      const statusCode = response.statusCode ?? 0
      if ([301, 302, 307, 308].includes(statusCode)) {
        const redirectUrl = response.headers.location
        if (!redirectUrl) {
          file.close()
          try { fs.unlinkSync(dest) } catch { /* ignore */ }
          reject(new Error(`Download failed: redirect without location (${statusCode})`))
          return
        }

        if (redirects >= MAX_REDIRECTS) {
          file.close()
          try { fs.unlinkSync(dest) } catch { /* ignore */ }
          reject(new Error('Download failed: too many redirects'))
          return
        }

        const nextUrl = resolveRedirect(url, redirectUrl)
        file.close()
        try { fs.unlinkSync(dest) } catch { /* ignore */ }
        downloadFile(nextUrl, dest, redirects + 1).then(resolve).catch(reject)
        return
      }

      if (statusCode !== 200) {
        file.close()
        try { fs.unlinkSync(dest) } catch { /* ignore */ }
        reject(new Error(`Download failed: HTTP ${statusCode}`))
        return
      }

      response.pipe(file)
      file.on('finish', () => {
        file.close()
        resolve()
      })
    }).on('error', (err) => {
      file.close()
      try { fs.unlinkSync(dest) } catch { /* ignore */ }
      reject(err)
    })
  })
}

function downloadText(url: string, redirects = 0): Promise<string> {
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith('https') ? https : http

    protocol.get(url, (response) => {
      const statusCode = response.statusCode ?? 0
      if ([301, 302, 307, 308].includes(statusCode)) {
        const redirectUrl = response.headers.location
        if (!redirectUrl) {
          reject(new Error(`Manifest download failed: redirect without location (${statusCode})`))
          return
        }

        if (redirects >= MAX_REDIRECTS) {
          reject(new Error('Manifest download failed: too many redirects'))
          return
        }

        const nextUrl = resolveRedirect(url, redirectUrl)
        downloadText(nextUrl, redirects + 1).then(resolve).catch(reject)
        return
      }

      if (statusCode !== 200) {
        reject(new Error(`Manifest download failed: HTTP ${statusCode}`))
        return
      }

      let body = ''
      response.setEncoding('utf8')
      response.on('data', (chunk) => {
        body += chunk
      })
      response.on('end', () => resolve(body))
    }).on('error', reject)
  })
}

function getInstallDir(): string {
  const scriptDir = path.dirname(new URL(import.meta.url).pathname)

  const normalizedDir = process.platform === 'win32'
    ? scriptDir.replace(/^\//, '').replace(/\//g, '\\\\')
    : scriptDir

  return path.resolve(normalizedDir, '..', '..')
}

function pickManifestDownloadUrl(manifest: unknown, platform: RuntimePlatform): string | null {
  if (!manifest || typeof manifest !== 'object') return null
  const source = manifest as Record<string, unknown>

  const direct = source.download_url
  if (typeof direct === 'string' && direct.trim()) return direct.trim()

  const directUrl = source.url
  if (typeof directUrl === 'string' && directUrl.trim()) return directUrl.trim()

  const platformKeys: Record<RuntimePlatform, string[]> = {
    linux: ['linux', 'linux_url'],
    darwin: ['darwin', 'macos', 'darwin_url', 'macos_url'],
    win32: ['win32', 'windows', 'windows_url', 'win32_url'],
  }

  for (const key of platformKeys[platform]) {
    const value = source[key]
    if (typeof value === 'string' && value.trim()) {
      return value.trim()
    }
  }

  const nestedKeys = ['assets', 'downloads', 'files', 'platforms']
  for (const nestedKey of nestedKeys) {
    const nested = source[nestedKey]
    if (!nested || typeof nested !== 'object') continue

    const nestedRecord = nested as Record<string, unknown>
    for (const key of platformKeys[platform]) {
      const value = nestedRecord[key]
      if (typeof value === 'string' && value.trim()) {
        return value.trim()
      }
    }
  }

  return null
}

async function resolveDownloadSource(
  inputUrl: string,
  targetVersion: string,
  platform: RuntimePlatform,
  logger: Logger
): Promise<{ downloadUrl: string; archiveExt: ArchiveExtension }> {
  const normalized = normalizeDownloadUrl(inputUrl, targetVersion, platform)
  if (!isHttpUrl(normalized)) {
    throw new Error('Upgrade download URL must be http(s)')
  }

  const archiveExt = detectArchiveExtension(normalized)
  if (archiveExt) {
    return {
      downloadUrl: normalized,
      archiveExt,
    }
  }

  if (!isManifestUrl(normalized)) {
    throw new Error('Upgrade download URL must be an archive (.tar.gz/.zip) or manifest (.json) URL')
  }

  logger.info(`Resolving upgrade manifest: ${normalized}`)
  const manifestText = await downloadText(normalized)

  let parsed: unknown
  try {
    parsed = JSON.parse(manifestText)
  } catch {
    throw new Error('Upgrade manifest response is not valid JSON')
  }

  const manifestDownloadUrl = pickManifestDownloadUrl(parsed, platform)
  if (!manifestDownloadUrl) {
    throw new Error(`Upgrade manifest does not include a download URL for platform ${platform}`)
  }

  if (!isHttpUrl(manifestDownloadUrl)) {
    throw new Error('Upgrade manifest returned a non-http(s) download URL')
  }

  const manifestArchiveExt = detectArchiveExtension(manifestDownloadUrl)
  if (!manifestArchiveExt) {
    throw new Error('Upgrade manifest must point to a .tar.gz or .zip archive')
  }

  return {
    downloadUrl: manifestDownloadUrl,
    archiveExt: manifestArchiveExt,
  }
}

export async function performUpgrade(
  targetVersion: string,
  downloadUrl: string,
  logger: Logger
): Promise<UpgradeResult> {
  const previousVersion = VERSION
  const installDir = getInstallDir()
  const tempDir = path.join(os.tmpdir(), `vp-agent-upgrade-${Date.now()}`)
  const backupDir = path.join(installDir, 'previous')
  const runtimePlatform = normalizePlatform(process.platform)

  logger.info(`Starting upgrade: ${previousVersion} -> ${targetVersion}`)
  logger.info(`Install dir: ${installDir}`)
  logger.info(`Temp dir: ${tempDir}`)

  try {
    await fsPromises.mkdir(tempDir, { recursive: true })

    const resolvedSource = await resolveDownloadSource(downloadUrl, targetVersion, runtimePlatform, logger)
    const archivePath = path.join(tempDir, `agent${resolvedSource.archiveExt}`)

    logger.info(`Downloading from: ${resolvedSource.downloadUrl}`)
    await downloadFile(resolvedSource.downloadUrl, archivePath)

    const archiveStat = await fsPromises.stat(archivePath)
    if (archiveStat.size < 1024) {
      throw new Error(`Downloaded file too small: ${archiveStat.size} bytes`)
    }
    logger.info(`Downloaded: ${(archiveStat.size / 1024 / 1024).toFixed(1)} MB`)

    const extractDir = path.join(tempDir, 'extracted')
    await fsPromises.mkdir(extractDir, { recursive: true })

    if (resolvedSource.archiveExt === '.tar.gz') {
      await execAsync(`tar -xzf "${archivePath}" -C "${extractDir}"`)
    } else if (process.platform === 'win32') {
      await execAsync(`powershell -Command "Expand-Archive -Path '${archivePath}' -DestinationPath '${extractDir}' -Force"`)
    } else {
      await execAsync(`unzip -o "${archivePath}" -d "${extractDir}"`)
    }

    logger.info('Archive extracted successfully')

    await fsPromises.rm(backupDir, { recursive: true, force: true })
    await fsPromises.mkdir(backupDir, { recursive: true })

    const filesToBackup = ['package.json', 'package-lock.json', 'dist', 'node_modules']
    for (const fileName of filesToBackup) {
      const src = path.join(installDir, fileName)
      const dest = path.join(backupDir, fileName)
      try {
        const stat = await fsPromises.stat(src)
        if (stat.isDirectory()) {
          await fsPromises.cp(src, dest, { recursive: true })
        } else {
          await fsPromises.copyFile(src, dest)
        }
      } catch {
        // Skip missing files.
      }
    }
    logger.info('Current version backed up')

    if (process.platform === 'win32') {
      await windowsUpgrade(extractDir, installDir, backupDir, targetVersion, logger)
    } else {
      await linuxUpgrade(extractDir, installDir, backupDir, targetVersion, logger)
    }

    return {
      success: true,
      message: `Upgrade initiated: ${previousVersion} -> ${targetVersion}. Agent will restart.`,
      previousVersion,
      targetVersion,
    }
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error'
    logger.error(`Upgrade failed: ${errorMsg}`)

    try { await fsPromises.rm(tempDir, { recursive: true, force: true }) } catch { /* ignore */ }

    return {
      success: false,
      message: `Upgrade failed: ${errorMsg}`,
      previousVersion,
      targetVersion,
    }
  }
}

async function windowsUpgrade(
  extractDir: string,
  installDir: string,
  backupDir: string,
  targetVersion: string,
  logger: Logger
): Promise<void> {
  const scriptPath = path.join(os.tmpdir(), `vp-upgrade-${Date.now()}.ps1`)

  const script = `
# VelocityPulse Agent Upgrade Script
# Upgrading to version ${targetVersion}
Start-Sleep -Seconds 2

$source = "${extractDir.replace(/\\/g, '\\\\')}"
$dest = "${installDir.replace(/\\/g, '\\\\')}"
$backup = "${backupDir.replace(/\\/g, '\\\\')}"

function Restore-Backup {
    Write-Host "[upgrade] restoring backup..."
    if (Test-Path "$backup\\dist") {
        Remove-Item -Path "$dest\\dist" -Recurse -Force -ErrorAction SilentlyContinue
        Copy-Item -Path "$backup\\dist" -Destination "$dest\\dist" -Recurse -Force
    }
    if (Test-Path "$backup\\package.json") {
        Copy-Item -Path "$backup\\package.json" -Destination "$dest\\package.json" -Force
    }
    if (Test-Path "$backup\\package-lock.json") {
        Copy-Item -Path "$backup\\package-lock.json" -Destination "$dest\\package-lock.json" -Force
    }
    if (Test-Path "$backup\\node_modules") {
        Remove-Item -Path "$dest\\node_modules" -Recurse -Force -ErrorAction SilentlyContinue
        Copy-Item -Path "$backup\\node_modules" -Destination "$dest\\node_modules" -Recurse -Force
    }
}

function Restart-Agent {
    $serviceName = "VelocityPulseAgent"
    $service = Get-Service -Name $serviceName -ErrorAction SilentlyContinue

    if ($service) {
        Restart-Service -Name $serviceName -Force
        Start-Sleep -Seconds 5
        $service = Get-Service -Name $serviceName -ErrorAction SilentlyContinue
        if (-not $service -or $service.Status -ne "Running") {
            throw "Service failed health check"
        }
        return
    }

    if (Get-Command pm2 -ErrorAction SilentlyContinue) {
        & pm2 restart velocitypulse-agent 2>$null
        if ($LASTEXITCODE -ne 0) {
            throw "pm2 restart failed"
        }
        Start-Sleep -Seconds 3
        $status = (& pm2 describe velocitypulse-agent 2>$null | Out-String)
        if ($status -notmatch "online") {
            throw "pm2 process failed health check"
        }
        return
    }

    Start-Process -FilePath "node" -ArgumentList "$dest\\dist\\index.js" -WorkingDirectory $dest -WindowStyle Hidden
}

try {
    # Find the extracted content (may be in a subdirectory)
    $content = Get-ChildItem -Path $source -Directory | Select-Object -First 1
    if ($content) { $source = $content.FullName }

    if (-not (Test-Path "$source\\dist")) {
        throw "Upgrade archive missing dist/"
    }

    Remove-Item -Path "$dest\\dist" -Recurse -Force -ErrorAction SilentlyContinue
    Copy-Item -Path "$source\\dist" -Destination "$dest\\dist" -Recurse -Force

    if (Test-Path "$source\\package.json") {
        Copy-Item -Path "$source\\package.json" -Destination "$dest\\package.json" -Force
    }
    if (Test-Path "$source\\package-lock.json") {
        Copy-Item -Path "$source\\package-lock.json" -Destination "$dest\\package-lock.json" -Force
    }

    Push-Location $dest
    & npm ci --omit=dev --silent
    if ($LASTEXITCODE -ne 0) {
        throw "npm ci failed"
    }
    Pop-Location

    Restart-Agent
} catch {
    Write-Error "Upgrade failed: $_"
    try {
      Restore-Backup
      Restart-Agent
    } catch {
      Write-Error "Rollback failed: $_"
    }
    exit 1
}

# Cleanup
Remove-Item -Path "${extractDir.replace(/\\/g, '\\\\')}" -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item -Path $MyInvocation.MyCommand.Path -Force -ErrorAction SilentlyContinue
`

  await fsPromises.writeFile(scriptPath, script, 'utf-8')
  logger.info(`Upgrade script written to: ${scriptPath}`)

  const child = spawn('powershell.exe', ['-ExecutionPolicy', 'Bypass', '-File', scriptPath], {
    detached: true,
    stdio: 'ignore',
    windowsHide: true,
  })
  child.unref()

  logger.info('Upgrade script launched, agent will exit for restart...')
  await new Promise(resolve => setTimeout(resolve, 500))
  process.exit(0)
}

async function linuxUpgrade(
  extractDir: string,
  installDir: string,
  backupDir: string,
  targetVersion: string,
  logger: Logger
): Promise<void> {
  const scriptPath = path.join(os.tmpdir(), `vp-upgrade-${Date.now()}.sh`)

  const script = `#!/bin/bash
set -euo pipefail

# VelocityPulse Agent Upgrade Script
# Upgrading to version ${targetVersion}
sleep 2

SOURCE="${extractDir}"
DEST="${installDir}"
BACKUP="${backupDir}"

restore_backup() {
  echo "[upgrade] restoring backup..."

  if [ -d "$BACKUP/dist" ]; then
    rm -rf "$DEST/dist"
    cp -rf "$BACKUP/dist" "$DEST/dist"
  fi

  if [ -f "$BACKUP/package.json" ]; then
    cp -f "$BACKUP/package.json" "$DEST/package.json"
  fi

  if [ -f "$BACKUP/package-lock.json" ]; then
    cp -f "$BACKUP/package-lock.json" "$DEST/package-lock.json"
  fi

  if [ -d "$BACKUP/node_modules" ]; then
    rm -rf "$DEST/node_modules"
    cp -rf "$BACKUP/node_modules" "$DEST/node_modules"
  fi
}

restart_agent() {
  if command -v systemctl >/dev/null 2>&1 && systemctl list-unit-files | grep -q '^velocitypulse-agent\\.service'; then
    systemctl restart velocitypulse-agent
    return 0
  fi

  if command -v pm2 >/dev/null 2>&1; then
    pm2 restart velocitypulse-agent >/dev/null 2>&1 || return 1
    return 0
  fi

  nohup node "$DEST/dist/index.js" >/dev/null 2>&1 &
  return 0
}

health_check() {
  if command -v systemctl >/dev/null 2>&1 && systemctl list-unit-files | grep -q '^velocitypulse-agent\\.service'; then
    for _ in {1..10}; do
      if systemctl is-active --quiet velocitypulse-agent; then
        return 0
      fi
      sleep 2
    done
    return 1
  fi

  if command -v pm2 >/dev/null 2>&1; then
    pm2 describe velocitypulse-agent 2>/dev/null | grep -qi "online"
    return $?
  fi

  pgrep -f "$DEST/dist/index.js" >/dev/null 2>&1
  return $?
}

rollback_and_restart() {
  restore_backup

  if [ -f "$DEST/package-lock.json" ]; then
    (cd "$DEST" && npm ci --omit=dev --silent) || true
  fi

  restart_agent || true
}

# Find extracted content (may be in a subdirectory)
CONTENT=$(find "$SOURCE" -mindepth 1 -maxdepth 1 -type d | head -1)
if [ -n "$CONTENT" ]; then SOURCE="$CONTENT"; fi

if [ ! -d "$SOURCE/dist" ]; then
  echo "Upgrade archive missing dist/"
  exit 1
fi

rm -rf "$DEST/dist"
cp -rf "$SOURCE/dist" "$DEST/dist"

if [ -f "$SOURCE/package.json" ]; then
  cp -f "$SOURCE/package.json" "$DEST/package.json"
fi

if [ -f "$SOURCE/package-lock.json" ]; then
  cp -f "$SOURCE/package-lock.json" "$DEST/package-lock.json"
fi

if ! (cd "$DEST" && npm ci --omit=dev --silent); then
  echo "npm ci failed, rolling back"
  rollback_and_restart
  exit 1
fi

if ! restart_agent; then
  echo "Restart failed, rolling back"
  rollback_and_restart
  exit 1
fi

if ! health_check; then
  echo "Health check failed, rolling back"
  rollback_and_restart
  exit 1
fi

# Cleanup
rm -rf "${extractDir}"
rm -f "$0"
`

  await fsPromises.writeFile(scriptPath, script, 'utf-8')
  await execAsync(`chmod +x "${scriptPath}"`)
  logger.info(`Upgrade script written to: ${scriptPath}`)

  const child = spawn('bash', [scriptPath], {
    detached: true,
    stdio: 'ignore',
  })
  child.unref()

  logger.info('Upgrade script launched, agent will exit for restart...')
  await new Promise(resolve => setTimeout(resolve, 500))
  process.exit(0)
}

export async function rollback(logger: Logger): Promise<UpgradeResult> {
  const installDir = getInstallDir()
  const backupDir = path.join(installDir, 'previous')

  try {
    const backupExists = await fsPromises.stat(backupDir).then(() => true).catch(() => false)
    if (!backupExists) {
      return { success: false, message: 'No backup found for rollback', previousVersion: VERSION }
    }

    const files = await fsPromises.readdir(backupDir)
    for (const fileName of files) {
      const src = path.join(backupDir, fileName)
      const dest = path.join(installDir, fileName)
      const stat = await fsPromises.stat(src)
      if (stat.isDirectory()) {
        await fsPromises.cp(src, dest, { recursive: true })
      } else {
        await fsPromises.copyFile(src, dest)
      }
    }

    logger.info('Rollback completed, restart required')
    return { success: true, message: 'Rollback completed', previousVersion: VERSION }
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error'
    return { success: false, message: `Rollback failed: ${errorMsg}`, previousVersion: VERSION }
  }
}
