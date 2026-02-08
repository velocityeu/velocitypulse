import { NextResponse } from 'next/server'

// Source of truth: velocitypulse-agent/scripts/install-windows.ps1
// Keep in sync when the installer script changes.
const INSTALL_SCRIPT = `<#
.SYNOPSIS
    VelocityPulse Agent installer for Windows.

.DESCRIPTION
    Downloads and installs the VelocityPulse Agent as a Windows service.
    Detects existing installs and offers upgrade, clean install, or uninstall.
    One-liner: irm https://get.velocitypulse.io/agent | iex

.PARAMETER ApiKey
    The agent API key from your VelocityPulse dashboard.

.PARAMETER DashboardUrl
    The dashboard URL (default: https://app.velocitypulse.io).

.PARAMETER InstallDir
    Installation directory (default: C:\\Program Files\\VelocityPulse Agent).

.PARAMETER AgentName
    Display name for this agent (default: hostname).

.PARAMETER CleanInstall
    Remove everything and reinstall from scratch.

.PARAMETER Uninstall
    Remove the agent completely and exit.

.PARAMETER Upgrade
    Upgrade files while keeping existing .env configuration.

.PARAMETER Force
    Skip interactive prompts (for automation/silent installs).
#>
param(
    [string]$ApiKey,
    [string]$DashboardUrl = "https://app.velocitypulse.io",
    [string]$InstallDir = "C:\\Program Files\\VelocityPulse Agent",
    [string]$AgentName = $env:COMPUTERNAME,
    [switch]$CleanInstall,
    [switch]$Uninstall,
    [switch]$Upgrade,
    [switch]$Force
)

$ErrorActionPreference = "Stop"
$ProgressPreference = "SilentlyContinue"

$ServiceName = "VelocityPulseAgent"
$ServiceDisplay = "VelocityPulse Agent"
$InstallerVersion = "2.0.0"

# ============================================
# Admin check (works with irm | iex)
# ============================================
$principal = New-Object Security.Principal.WindowsPrincipal([Security.Principal.WindowsIdentity]::GetCurrent())
if (-not $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    Write-Host ""
    Write-Host "  ERROR: This installer must be run as Administrator." -ForegroundColor Red
    Write-Host "  Right-click PowerShell and select 'Run as Administrator'." -ForegroundColor Red
    Write-Host ""
    exit 1
}

# ============================================
# Banner
# ============================================
Write-Host ""
Write-Host "  ============================================" -ForegroundColor Cyan
Write-Host "   VelocityPulse Agent Installer v$InstallerVersion" -ForegroundColor Cyan
Write-Host "  ============================================" -ForegroundColor Cyan
Write-Host ""

# ============================================
# Helper functions
# ============================================

function Test-ExistingInstall {
    $result = @{
        ServiceExists       = $false
        ServiceStatus       = $null
        ServiceImagePath    = $null
        DirExists           = $false
        EnvExists           = $false
        EnvApiKey           = $null
        EnvDashboardUrl     = $null
        EnvAgentName        = $null
        HasPackageJson      = $false
        HasEntryPoint       = $false
        NodeModulesHealthy  = $false
        Summary             = "none"
    }

    # Check service
    $svc = Get-Service -Name $ServiceName -ErrorAction SilentlyContinue
    if ($svc) {
        $result.ServiceExists = $true
        $result.ServiceStatus = $svc.Status.ToString()
        $regPath = "HKLM:\\SYSTEM\\CurrentControlSet\\Services\\$ServiceName"
        if (Test-Path $regPath) {
            $result.ServiceImagePath = (Get-ItemProperty -Path $regPath -Name ImagePath -ErrorAction SilentlyContinue).ImagePath
        }
    }

    # Check install directory
    if (Test-Path $InstallDir) {
        $result.DirExists = $true
        $result.HasPackageJson = Test-Path (Join-Path $InstallDir "package.json")
        $result.HasEntryPoint = Test-Path (Join-Path $InstallDir "dist\\index.js")

        # Check node_modules health
        $nmDir = Join-Path $InstallDir "node_modules"
        if (Test-Path $nmDir) {
            $hasExpress = Test-Path (Join-Path $nmDir "express")
            $hasDotenv = Test-Path (Join-Path $nmDir "dotenv")
            $result.NodeModulesHealthy = $hasExpress -and $hasDotenv
        }

        # Parse .env
        $envPath = Join-Path $InstallDir ".env"
        if (Test-Path $envPath) {
            $result.EnvExists = $true
            $envContent = Get-Content $envPath -ErrorAction SilentlyContinue
            foreach ($line in $envContent) {
                if ($line -match '^\\s*VP_API_KEY\\s*=\\s*(.+)$') { $result.EnvApiKey = $Matches[1].Trim() }
                if ($line -match '^\\s*VELOCITYPULSE_URL\\s*=\\s*(.+)$') { $result.EnvDashboardUrl = $Matches[1].Trim() }
                if ($line -match '^\\s*AGENT_NAME\\s*=\\s*(.+)$') { $result.EnvAgentName = $Matches[1].Trim() }
            }
        }
    }

    # Determine summary
    if ($result.ServiceExists -and $result.DirExists -and $result.HasEntryPoint -and $result.NodeModulesHealthy) {
        $result.Summary = "healthy"
    } elseif ($result.ServiceExists -or $result.DirExists) {
        if (-not $result.HasPackageJson -or -not $result.HasEntryPoint -or -not $result.NodeModulesHealthy) {
            $result.Summary = "corrupt"
        } else {
            $result.Summary = "partial"
        }
    }

    return $result
}

function Stop-AgentService {
    param([int]$TimeoutSeconds = 30)

    $svc = Get-Service -Name $ServiceName -ErrorAction SilentlyContinue
    if (-not $svc) { return }

    $status = $svc.Status.ToString()

    # Handle stuck pending states by killing the process
    if ($status -eq "StopPending" -or $status -eq "StartPending") {
        Write-Host "  Service is stuck ($status). Killing process..." -ForegroundColor Yellow
        Kill-AgentProcess
        Start-Sleep -Seconds 2
        return
    }

    if ($status -eq "Running") {
        Write-Host "  Stopping service..." -ForegroundColor Yellow
        Stop-Service -Name $ServiceName -Force -ErrorAction SilentlyContinue

        # Wait for it to stop
        $elapsed = 0
        while ($elapsed -lt $TimeoutSeconds) {
            Start-Sleep -Seconds 2
            $elapsed += 2
            $svc = Get-Service -Name $ServiceName -ErrorAction SilentlyContinue
            if (-not $svc -or $svc.Status -eq "Stopped") { return }
        }

        # Timed out - force kill
        Write-Host "  Stop timed out after \${TimeoutSeconds}s. Force killing..." -ForegroundColor Yellow
        Kill-AgentProcess
        Start-Sleep -Seconds 2
    }
}

function Kill-AgentProcess {
    $entryPoint = Join-Path $InstallDir "dist\\index.js"
    try {
        $procs = Get-CimInstance Win32_Process -Filter "Name = 'node.exe'" -ErrorAction SilentlyContinue
        foreach ($proc in $procs) {
            if ($proc.CommandLine -and $proc.CommandLine -like "*$entryPoint*") {
                Write-Host "  Killing node.exe (PID $($proc.ProcessId))..." -ForegroundColor Yellow
                Stop-Process -Id $proc.ProcessId -Force -ErrorAction SilentlyContinue
            }
        }
    } catch {
        # Fallback: kill all node processes that reference our install dir
        Get-Process -Name "node" -ErrorAction SilentlyContinue | Where-Object {
            try { $_.Path -and $_.MainModule.FileName } catch { $false }
        } | ForEach-Object {
            Write-Host "  Killing node.exe (PID $($_.Id)) via fallback..." -ForegroundColor Yellow
            Stop-Process -Id $_.Id -Force -ErrorAction SilentlyContinue
        }
    }
}

function Remove-AgentService {
    $svc = Get-Service -Name $ServiceName -ErrorAction SilentlyContinue
    if (-not $svc) { return }

    # Try sc.exe delete
    $scResult = sc.exe delete $ServiceName 2>&1
    Start-Sleep -Seconds 2

    # Verify deletion
    $svc = Get-Service -Name $ServiceName -ErrorAction SilentlyContinue
    if ($svc) {
        # Fallback: direct registry removal
        Write-Host "  sc.exe delete failed, removing via registry..." -ForegroundColor Yellow
        $regPath = "HKLM:\\SYSTEM\\CurrentControlSet\\Services\\$ServiceName"
        if (Test-Path $regPath) {
            Remove-Item -Path $regPath -Recurse -Force -ErrorAction SilentlyContinue
        }
        Start-Sleep -Seconds 2
    }
}

function Remove-InstallDirectory {
    if (-not (Test-Path $InstallDir)) { return }

    try {
        Remove-Item -Path $InstallDir -Recurse -Force -ErrorAction Stop
    } catch {
        # Long path fallback: robocopy /MIR with empty dir
        Write-Host "  Standard removal failed, using robocopy fallback..." -ForegroundColor Yellow
        $emptyDir = Join-Path $env:TEMP "vp-empty-$([guid]::NewGuid().ToString('N').Substring(0,8))"
        New-Item -ItemType Directory -Path $emptyDir -Force | Out-Null
        robocopy $emptyDir $InstallDir /MIR /NFL /NDL /NJH /NJS /NC /NS /NP | Out-Null
        Remove-Item $InstallDir -Recurse -Force -ErrorAction SilentlyContinue
        Remove-Item $emptyDir -Force -ErrorAction SilentlyContinue
    }
}

function Remove-TempFiles {
    Get-ChildItem -Path $env:TEMP -Filter "vp-agent-*" -ErrorAction SilentlyContinue | ForEach-Object {
        Remove-Item $_.FullName -Recurse -Force -ErrorAction SilentlyContinue
    }
}

function Backup-EnvFile {
    $envPath = Join-Path $InstallDir ".env"
    if (Test-Path $envPath) {
        $backupPath = Join-Path $env:TEMP "vp-agent-env-backup.txt"
        Copy-Item -Path $envPath -Destination $backupPath -Force
        return $backupPath
    }
    return $null
}

function Restore-EnvFile {
    param([string]$BackupPath)
    if ($BackupPath -and (Test-Path $BackupPath)) {
        $envPath = Join-Path $InstallDir ".env"
        Copy-Item -Path $BackupPath -Destination $envPath -Force
        Remove-Item $BackupPath -Force -ErrorAction SilentlyContinue
        return $true
    }
    return $false
}

function Invoke-FullCleanup {
    Write-Host "  Stopping service..." -ForegroundColor Yellow
    Stop-AgentService
    Write-Host "  Removing service..." -ForegroundColor Yellow
    Remove-AgentService
    Write-Host "  Removing install directory..." -ForegroundColor Yellow
    Remove-InstallDirectory
    Write-Host "  Cleaning temp files..." -ForegroundColor Yellow
    Remove-TempFiles
}

function Show-InstallStatus {
    param($State)

    Write-Host "  Existing installation detected:" -ForegroundColor White
    Write-Host ""

    $svcColor = if ($State.ServiceExists) {
        if ($State.ServiceStatus -eq "Running") { "Green" } else { "Yellow" }
    } else { "DarkGray" }
    $svcText = if ($State.ServiceExists) { "$($State.ServiceStatus)" } else { "Not found" }
    Write-Host "    Service:      $svcText" -ForegroundColor $svcColor

    $dirColor = if ($State.DirExists) { "Green" } else { "DarkGray" }
    $dirText = if ($State.DirExists) { "Present" } else { "Not found" }
    Write-Host "    Install Dir:  $dirText" -ForegroundColor $dirColor

    $envColor = if ($State.EnvExists) { "Green" } else { "DarkGray" }
    $envText = if ($State.EnvExists) { "Present" } else { "Not found" }
    Write-Host "    Config (.env): $envText" -ForegroundColor $envColor

    if ($State.EnvAgentName) {
        Write-Host "    Agent Name:   $($State.EnvAgentName)" -ForegroundColor Cyan
    }

    $epColor = if ($State.HasEntryPoint) { "Green" } else { "Red" }
    $epText = if ($State.HasEntryPoint) { "OK" } else { "Missing" }
    Write-Host "    Entry point:  $epText" -ForegroundColor $epColor

    $nmColor = if ($State.NodeModulesHealthy) { "Green" } else { "Red" }
    $nmText = if ($State.NodeModulesHealthy) { "OK" } else { "Corrupt or missing" }
    Write-Host "    Dependencies: $nmText" -ForegroundColor $nmColor

    Write-Host ""
}

# ============================================
# Detect existing installation
# ============================================
$existingState = Test-ExistingInstall

# Determine install mode
$mode = "fresh"

if ($Uninstall) {
    $mode = "uninstall"
} elseif ($CleanInstall) {
    $mode = "clean"
} elseif ($Upgrade) {
    $mode = "upgrade"
} elseif ($existingState.Summary -ne "none") {
    # Existing install found - show menu or fail if -Force without explicit mode
    if ($Force) {
        # Default to upgrade when -Force is used with existing install
        $mode = "upgrade"
    } else {
        Show-InstallStatus $existingState

        if ($existingState.Summary -eq "corrupt") {
            Write-Host "  WARNING: Installation appears corrupt." -ForegroundColor Red
            Write-Host ""
        }

        Write-Host "  What would you like to do?" -ForegroundColor Yellow
        Write-Host ""
        Write-Host "    1. Upgrade        (keep .env config, update files)" -ForegroundColor White
        Write-Host "    2. Clean Install  (remove everything, start fresh)" -ForegroundColor White
        Write-Host "    3. Uninstall      (remove agent completely)" -ForegroundColor White
        Write-Host "    4. Cancel" -ForegroundColor White
        Write-Host ""

        $choice = Read-Host "  Enter choice (1-4)"
        switch ($choice) {
            "1" { $mode = "upgrade" }
            "2" { $mode = "clean" }
            "3" { $mode = "uninstall" }
            default {
                Write-Host ""
                Write-Host "  Cancelled." -ForegroundColor Yellow
                exit 0
            }
        }
    }
}

# ============================================
# Uninstall mode
# ============================================
if ($mode -eq "uninstall") {
    Write-Host ""
    Write-Host "  Uninstalling VelocityPulse Agent..." -ForegroundColor Yellow
    Write-Host ""
    Invoke-FullCleanup
    Write-Host ""
    Write-Host "  ============================================" -ForegroundColor Green
    Write-Host "   VelocityPulse Agent Uninstalled" -ForegroundColor Green
    Write-Host "  ============================================" -ForegroundColor Green
    Write-Host ""
    exit 0
}

# ============================================
# [1/8] Check prerequisites
# ============================================
Write-Host "[1/8] Checking prerequisites..." -ForegroundColor Yellow

$nodeVersion = $null
try { $nodeVersion = (node --version 2>$null) } catch {}

if (-not $nodeVersion) {
    Write-Host "  ERROR: Node.js is not installed." -ForegroundColor Red
    Write-Host "  Please install Node.js 18+ from https://nodejs.org" -ForegroundColor Red
    exit 1
}

$major = [int]($nodeVersion -replace '^v(\\d+)\\..*', '$1')
if ($major -lt 18) {
    Write-Host "  ERROR: Node.js $nodeVersion is too old. Version 18+ required." -ForegroundColor Red
    exit 1
}
Write-Host "  Node.js $nodeVersion" -ForegroundColor Green

# ============================================
# [2/8] Configuration
# ============================================
Write-Host "[2/8] Configuration..." -ForegroundColor Yellow

$envBackupPath = $null

if ($mode -eq "upgrade" -and $existingState.EnvExists) {
    # Back up .env for restore after upgrade
    $envBackupPath = Backup-EnvFile
    Write-Host "  Reusing existing configuration" -ForegroundColor Green
    if ($existingState.EnvAgentName) { Write-Host "  Agent Name: $($existingState.EnvAgentName)" -ForegroundColor Cyan }
    if ($existingState.EnvDashboardUrl) { Write-Host "  Dashboard:  $($existingState.EnvDashboardUrl)" -ForegroundColor Cyan }
} else {
    # Need API key for fresh and clean installs
    if (-not $ApiKey) {
        if ($Force) {
            Write-Host "  ERROR: -ApiKey is required with -Force for new installations." -ForegroundColor Red
            exit 1
        }
        Write-Host ""
        $ApiKey = Read-Host "  Enter your Agent API Key (from VelocityPulse dashboard)"
        if (-not $ApiKey) {
            Write-Host "  ERROR: API key is required." -ForegroundColor Red
            exit 1
        }
        $inputUrl = Read-Host "  Dashboard URL (press Enter for $DashboardUrl)"
        if ($inputUrl) { $DashboardUrl = $inputUrl }
        $inputName = Read-Host "  Agent Name (press Enter for $AgentName)"
        if ($inputName) { $AgentName = $inputName }
    }
    Write-Host "  Dashboard:  $DashboardUrl" -ForegroundColor Green
    Write-Host "  Agent Name: $AgentName" -ForegroundColor Green
}

# ============================================
# [3/8] Cleanup
# ============================================
Write-Host "[3/8] Cleanup..." -ForegroundColor Yellow

if ($mode -eq "clean" -or $mode -eq "upgrade") {
    Stop-AgentService
    Remove-AgentService
    if ($mode -eq "clean") {
        Remove-InstallDirectory
    } elseif ($mode -eq "upgrade") {
        # Remove everything except .env (already backed up)
        if (Test-Path $InstallDir) {
            Get-ChildItem -Path $InstallDir -Exclude ".env" -ErrorAction SilentlyContinue | ForEach-Object {
                try {
                    Remove-Item $_.FullName -Recurse -Force -ErrorAction Stop
                } catch {
                    Write-Host "  Warning: Could not remove $($_.Name)" -ForegroundColor Yellow
                }
            }
        }
    }
    Remove-TempFiles
    Write-Host "  Cleanup complete" -ForegroundColor Green
} elseif ($existingState.ServiceExists) {
    # Fresh install but orphaned service found
    Write-Host "  Removing orphaned service..." -ForegroundColor Yellow
    Stop-AgentService
    Remove-AgentService
    Write-Host "  Orphaned service removed" -ForegroundColor Green
} else {
    Write-Host "  Nothing to clean" -ForegroundColor Green
}

# ============================================
# [4/8] Download from GitHub
# ============================================
Write-Host "[4/8] Downloading latest agent release..." -ForegroundColor Yellow

$releasesUrl = "https://api.github.com/repos/velocityeu/velocitypulse-agent/releases/latest"
try {
    $release = Invoke-RestMethod -Uri $releasesUrl -Headers @{ "User-Agent" = "VelocityPulse-Installer" }
    $version = $release.tag_name
    $asset = $release.assets | Where-Object { $_.name -like "*windows*" -or $_.name -like "*.zip" } | Select-Object -First 1

    if (-not $asset) {
        $asset = $release.assets | Where-Object { $_.name -like "*.zip" } | Select-Object -First 1
    }

    if ($asset) {
        $downloadUrl = $asset.browser_download_url
    } else {
        $downloadUrl = $release.zipball_url
    }
    Write-Host "  Version: $version" -ForegroundColor Green
} catch {
    Write-Host "  WARNING: Could not fetch latest release. Using main branch." -ForegroundColor Yellow
    $version = "latest"
    $downloadUrl = "https://github.com/velocityeu/velocitypulse-agent/archive/refs/heads/main.zip"
}

$tempZip = Join-Path $env:TEMP "vp-agent-$([guid]::NewGuid().ToString('N').Substring(0,8)).zip"
$tempExtract = Join-Path $env:TEMP "vp-agent-extract"

Invoke-WebRequest -Uri $downloadUrl -OutFile $tempZip
Write-Host "  Downloaded OK" -ForegroundColor Green

# ============================================
# [5/8] Extract + npm install + verify
# ============================================
Write-Host "[5/8] Installing files..." -ForegroundColor Yellow

if (Test-Path $tempExtract) { Remove-Item $tempExtract -Recurse -Force }
Expand-Archive -Path $tempZip -DestinationPath $tempExtract -Force

# Find extracted directory (GitHub adds a prefix)
$sourceDir = Get-ChildItem -Path $tempExtract -Directory | Select-Object -First 1
if (-not $sourceDir) {
    Write-Host "  ERROR: Could not find extracted directory." -ForegroundColor Red
    exit 1
}

# Create install directory
if (-not (Test-Path $InstallDir)) {
    New-Item -ItemType Directory -Path $InstallDir -Force | Out-Null
}

# Copy files
Copy-Item -Path "$($sourceDir.FullName)\\*" -Destination $InstallDir -Recurse -Force
Write-Host "  Files extracted" -ForegroundColor Green

# Verify entry point
$entryPoint = Join-Path $InstallDir "dist\\index.js"
if (-not (Test-Path $entryPoint)) {
    Write-Host "  ERROR: dist\\index.js not found. Release may be missing pre-built files." -ForegroundColor Red
    exit 1
}

# Install npm dependencies
Write-Host "  Installing dependencies (this may take a minute)..."
Push-Location $InstallDir
try {
    $npmOutput = npm install --production 2>&1
    $npmExit = $LASTEXITCODE
} finally {
    Pop-Location
}

if ($npmExit -ne 0) {
    Write-Host "  ERROR: npm install failed (exit code $npmExit)." -ForegroundColor Red
    Write-Host "  Output: $npmOutput" -ForegroundColor Red
    Write-Host "  Try: cd '$InstallDir' && npm install --production" -ForegroundColor Yellow
    exit 1
}

# Verify node_modules
$nmDir = Join-Path $InstallDir "node_modules"
if (-not (Test-Path (Join-Path $nmDir "express")) -or -not (Test-Path (Join-Path $nmDir "dotenv"))) {
    Write-Host "  ERROR: node_modules is incomplete. Key packages missing." -ForegroundColor Red
    exit 1
}

Write-Host "  Dependencies installed" -ForegroundColor Green

# ============================================
# [6/8] Write .env config
# ============================================
Write-Host "[6/8] Configuring agent..." -ForegroundColor Yellow

if ($mode -eq "upgrade" -and $envBackupPath) {
    $restored = Restore-EnvFile $envBackupPath
    if ($restored) {
        Write-Host "  Restored existing .env configuration" -ForegroundColor Green
    } else {
        Write-Host "  WARNING: Could not restore .env backup. Writing new config." -ForegroundColor Yellow
        $mode = "fresh"  # Fall through to write new .env
    }
}

if ($mode -ne "upgrade") {
    $envFile = Join-Path $InstallDir ".env"
    @"
# VelocityPulse Agent Configuration
VELOCITYPULSE_URL=$DashboardUrl
VP_API_KEY=$ApiKey
AGENT_NAME=$AgentName
LOG_LEVEL=info
ENABLE_AUTO_SCAN=true
ENABLE_REALTIME=true
"@ | Set-Content -Path $envFile -Encoding UTF8
    Write-Host "  Configuration written to .env" -ForegroundColor Green
}

# ============================================
# [7/8] Register and start Windows service
# ============================================
Write-Host "[7/8] Registering Windows service..." -ForegroundColor Yellow

$nodeExe = (Get-Command node).Source

# Create service
$binPath = "\`"$nodeExe\`" \`"$entryPoint\`""
sc.exe create $ServiceName binPath= $binPath start= auto DisplayName= $ServiceDisplay | Out-Null
sc.exe description $ServiceName "VelocityPulse network monitoring agent" | Out-Null

# Set working directory via registry (sc.exe doesn't support it)
$regPath = "HKLM:\\SYSTEM\\CurrentControlSet\\Services\\$ServiceName"
if (Test-Path $regPath) {
    $wrappedBinPath = "cmd.exe /c \`"cd /d \`"$InstallDir\`" && \`"$nodeExe\`" \`"$entryPoint\`"\`""
    Set-ItemProperty -Path $regPath -Name ImagePath -Value $wrappedBinPath
}

# Verify service was created
$svc = Get-Service -Name $ServiceName -ErrorAction SilentlyContinue
if (-not $svc) {
    Write-Host "  ERROR: Service registration failed." -ForegroundColor Red
    Write-Host "  Try running: sc.exe create $ServiceName binPath= \`"$binPath\`" start= auto" -ForegroundColor Yellow
    exit 1
}
Write-Host "  Service registered" -ForegroundColor Green

# Start service
try {
    Start-Service -Name $ServiceName
    Start-Sleep -Seconds 3
    $svc = Get-Service -Name $ServiceName -ErrorAction SilentlyContinue
    if ($svc.Status -eq "Running") {
        Write-Host "  Service started successfully" -ForegroundColor Green
    } else {
        throw "Service status: $($svc.Status)"
    }
} catch {
    Write-Host "  WARNING: Service failed to start." -ForegroundColor Yellow
    # Query Event Log for errors
    try {
        $events = Get-WinEvent -FilterHashtable @{
            LogName = "System"
            ProviderName = "Service Control Manager"
            Level = 2
            StartTime = (Get-Date).AddMinutes(-2)
        } -MaxEvents 3 -ErrorAction SilentlyContinue

        if ($events) {
            Write-Host "  Recent error events:" -ForegroundColor Yellow
            foreach ($evt in $events) {
                Write-Host "    $($evt.TimeCreated): $($evt.Message.Substring(0, [Math]::Min(120, $evt.Message.Length)))" -ForegroundColor DarkYellow
            }
        }
    } catch {}
    Write-Host ""
    Write-Host "  Manual test: cd '$InstallDir' && node dist\\index.js" -ForegroundColor Yellow
    Write-Host "  Start:       Start-Service $ServiceName" -ForegroundColor Yellow
}

# ============================================
# [8/8] Post-install verification
# ============================================
Write-Host "[8/8] Verifying installation..." -ForegroundColor Yellow

$finalState = Test-ExistingInstall

$allGood = $true
if (-not $finalState.ServiceExists) {
    Write-Host "  FAIL: Service not found" -ForegroundColor Red; $allGood = $false
}
if (-not $finalState.HasEntryPoint) {
    Write-Host "  FAIL: dist\\index.js missing" -ForegroundColor Red; $allGood = $false
}
if (-not $finalState.NodeModulesHealthy) {
    Write-Host "  FAIL: node_modules incomplete" -ForegroundColor Red; $allGood = $false
}
if (-not $finalState.EnvExists) {
    Write-Host "  FAIL: .env missing" -ForegroundColor Red; $allGood = $false
}
if ($allGood) {
    Write-Host "  All checks passed" -ForegroundColor Green
}

# ============================================
# Cleanup temp files
# ============================================
Remove-Item $tempZip -Force -ErrorAction SilentlyContinue
Remove-Item $tempExtract -Recurse -Force -ErrorAction SilentlyContinue

# ============================================
# Done
# ============================================
Write-Host ""
Write-Host "  ============================================" -ForegroundColor Green
if ($mode -eq "upgrade") {
    Write-Host "   Upgrade Complete!" -ForegroundColor Green
} else {
    Write-Host "   Installation Complete!" -ForegroundColor Green
}
Write-Host "  ============================================" -ForegroundColor Green
Write-Host ""
Write-Host "  Install Dir:  $InstallDir" -ForegroundColor Cyan
Write-Host "  Service Name: $ServiceName" -ForegroundColor Cyan
Write-Host "  Agent UI:     http://localhost:3001" -ForegroundColor Cyan
Write-Host ""
Write-Host "  Commands:" -ForegroundColor Yellow
Write-Host "    Start:     Start-Service $ServiceName" -ForegroundColor White
Write-Host "    Stop:      Stop-Service $ServiceName" -ForegroundColor White
Write-Host "    Status:    Get-Service $ServiceName" -ForegroundColor White
Write-Host "    Logs:      Get-Content '$InstallDir\\logs\\agent.log' -Tail 50" -ForegroundColor White
Write-Host "    Uninstall: .\\install-windows.ps1 -Uninstall" -ForegroundColor White
Write-Host ""
`

export async function GET() {
  return new NextResponse(INSTALL_SCRIPT, {
    status: 200,
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=300, s-maxage=300',
    },
  })
}
