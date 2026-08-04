#Requires -Version 5.1
<#
.SYNOPSIS
  Nightly full-environment export for transition-insight (working tree + git bundle + optional secrets).

.DESCRIPTION
  Creates a timestamped folder on an external drive:
    YYYY-MM-DD_HHmmss/
      workspace/          robocopy mirror of the repo (uncommitted work included)
      transition-insight.bundle   git bundle --all
      env/                .env* copies when includeEnvFiles is true (NOT in git)
      manifest.json       sizes, git HEAD, dirty file list

  Prunes folders older than keepDays.

  Resilience (Modern Standby / USB):
  - Holds a system sleep lock for the duration of the run
  - Retries until backupRoot is reachable (USB spin-up)
  - Always logs to %LOCALAPPDATA%\transition-insight\nightly-backup.log
    (and mirrors to backupRoot\backup.log once the drive is up)

  SETUP
  1. Copy scripts/nightly-backup.config.example.json -> scripts/nightly-backup.config.json
  2. Set backupRoot to your external drive path (must exist when the job runs)
  3. Register the scheduled task (once):
       powershell -ExecutionPolicy Bypass -File scripts/register-nightly-backup-task.ps1

  MANUAL RUN
       npm run backup:nightly
     or
       powershell -ExecutionPolicy Bypass -File scripts/nightly-backup.ps1

  RESTORE (quick)
  - Working files: copy workspace/ back over your checkout
  - Full git history: git clone transition-insight.bundle restored-repo
#>
param(
  [string]$ConfigPath = (Join-Path $PSScriptRoot "nightly-backup.config.json"),
  [int]$DriveReadyTimeoutSec = 180
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

# --- Local log (survives missing / sleeping USB) ---
$script:LocalLogDir = Join-Path $env:LOCALAPPDATA "transition-insight"
$script:LocalLogFile = Join-Path $script:LocalLogDir "nightly-backup.log"
$script:DriveLogFile = $null
$script:LogFile = $null

if (-not (Test-Path $script:LocalLogDir)) {
  New-Item -ItemType Directory -Path $script:LocalLogDir -Force | Out-Null
}

function Write-Log([string]$Message) {
  $line = "[{0}] {1}" -f (Get-Date -Format "yyyy-MM-dd HH:mm:ss"), $Message
  Write-Host $line
  try {
    Add-Content -Path $script:LocalLogFile -Value $line -Encoding UTF8 -ErrorAction SilentlyContinue
  } catch { }
  if ($script:DriveLogFile) {
    try {
      Add-Content -Path $script:DriveLogFile -Value $line -Encoding UTF8 -ErrorAction SilentlyContinue
    } catch { }
  }
}

function Write-StatusJson([hashtable]$Fields) {
  $path = Join-Path $script:LocalLogDir "nightly-backup-status.json"
  $payload = [ordered]@{
    updatedAt = (Get-Date).ToUniversalTime().ToString("o")
  }
  foreach ($key in $Fields.Keys) { $payload[$key] = $Fields[$key] }
  $payload | ConvertTo-Json -Depth 4 | Set-Content -Path $path -Encoding UTF8
}

# Prevent Modern Standby / sleep for the duration of this process.
if (-not ("BackupNative.Sleep" -as [type])) {
  Add-Type -Namespace BackupNative -Name Sleep -MemberDefinition @"
[DllImport("kernel32.dll", CharSet = CharSet.Auto, SetLastError = true)]
public static extern uint SetThreadExecutionState(uint esFlags);
"@
}
# PowerShell parses 0x80000000 as signed Int32 (-2147483648); use Convert.
$ES_CONTINUOUS = [Convert]::ToUInt32("80000000", 16)
$ES_SYSTEM_REQUIRED = [Convert]::ToUInt32("1", 16)
$script:SleepLockHeld = $false
function Enter-StayAwake {
  try {
    [void][BackupNative.Sleep]::SetThreadExecutionState($ES_CONTINUOUS -bor $ES_SYSTEM_REQUIRED)
    $script:SleepLockHeld = $true
    Write-Log "Sleep lock held (ES_SYSTEM_REQUIRED)"
  } catch {
    Write-Log ("WARN: could not set sleep lock: {0}" -f $_.Exception.Message)
  }
}
function Exit-StayAwake {
  if (-not $script:SleepLockHeld) { return }
  try {
    [void][BackupNative.Sleep]::SetThreadExecutionState($ES_CONTINUOUS)
  } catch { }
  $script:SleepLockHeld = $false
}

function Wait-BackupRoot([string]$Path, [int]$TimeoutSec) {
  $deadline = (Get-Date).AddSeconds($TimeoutSec)
  $attempt = 0
  while ($true) {
    $attempt++
    if (Test-Path -LiteralPath $Path) {
      # Touch the volume so a spun-down USB actually wakes.
      try {
        Get-ChildItem -LiteralPath $Path -Force -ErrorAction Stop | Out-Null
        return
      } catch {
        Write-Log ("Backup root listed but not ready (attempt {0}): {1}" -f $attempt, $_.Exception.Message)
      }
    } else {
      $qualifier = Split-Path -Qualifier $Path -ErrorAction SilentlyContinue
      if ($qualifier) {
        try { Get-PSDrive -Name $qualifier.TrimEnd(':') -ErrorAction SilentlyContinue | Out-Null } catch { }
        try { Get-ChildItem -LiteralPath ($qualifier + '\') -Force -ErrorAction SilentlyContinue | Out-Null } catch { }
      }
      Write-Log ("Waiting for backup drive (attempt {0}/{1}s): {2}" -f $attempt, $TimeoutSec, $Path)
    }
    if ((Get-Date) -ge $deadline) {
      throw "Backup drive not available after ${TimeoutSec}s: $Path"
    }
    Start-Sleep -Seconds 5
  }
}

Enter-StayAwake
Write-Log "=== nightly-backup start ==="
Write-StatusJson @{ state = "starting"; pid = $PID }

try {
  if (-not (Test-Path $ConfigPath)) {
    throw @"
Missing $ConfigPath
Copy scripts/nightly-backup.config.example.json -> scripts/nightly-backup.config.json and set backupRoot to your drive.
"@
  }

  $config = Get-Content $ConfigPath -Raw -Encoding UTF8 | ConvertFrom-Json
  $workspaceRoot = [string]$config.workspaceRoot
  $backupRoot = [string]$config.backupRoot
  # PowerShell 5.1 has no ?? operator - use null checks
  $keepDays = if ($null -ne $config.keepDays) { [int]$config.keepDays } else { 14 }
  $includeEnv = if ($null -ne $config.includeEnvFiles) { [bool]$config.includeEnvFiles } else { $false }
  $includeOut = if ($null -ne $config.includeOut) { [bool]$config.includeOut } else { $true }
  $includeNodeModules = if ($null -ne $config.includeNodeModules) { [bool]$config.includeNodeModules } else { $false }
  if ($null -ne $config.driveReadyTimeoutSec) {
    $DriveReadyTimeoutSec = [int]$config.driveReadyTimeoutSec
  }

  if (-not (Test-Path $workspaceRoot)) {
    throw "workspaceRoot not found: $workspaceRoot"
  }

  Wait-BackupRoot -Path $backupRoot -TimeoutSec $DriveReadyTimeoutSec

  $script:DriveLogFile = Join-Path $backupRoot "backup.log"
  $script:LogFile = $script:DriveLogFile

  $stamp = Get-Date -Format "yyyy-MM-dd_HHmmss"
  $destRoot = Join-Path $backupRoot $stamp
  $destWorkspace = Join-Path $destRoot "workspace"
  $destBundle = Join-Path $destRoot "transition-insight.bundle"
  $destEnv = Join-Path $destRoot "env"

  New-Item -ItemType Directory -Path $destWorkspace -Force | Out-Null
  Write-Log ("Starting backup -> {0}" -f $destRoot)
  Write-StatusJson @{ state = "running"; destRoot = $destRoot; pid = $PID }

  # Keep the derived semantic workspace current before copying it.
  $graphScript = Join-Path $workspaceRoot "scripts\generate-lexica-graph.mjs"
  if (Test-Path $graphScript) {
    Write-Log "Refreshing lexica graph..."
    Push-Location $workspaceRoot
    try {
      & node $graphScript 2>&1 | ForEach-Object { Write-Log $_ }
      if ($LASTEXITCODE -ne 0) {
        Write-Log ("WARN: lexica graph refresh failed with exit {0}; continuing backup" -f $LASTEXITCODE)
      }
    } finally {
      Pop-Location
    }
  }

  # --- Git metadata ---
  $gitDir = Join-Path $workspaceRoot ".git"
  $hasGit = Test-Path $gitDir
  $headSha = $null
  $branch = $null
  $dirtyFiles = @()

  if ($hasGit) {
    Push-Location $workspaceRoot
    try {
      $headSha = (git rev-parse HEAD 2>$null)
      $branch = (git branch --show-current 2>$null)
      $dirtyFiles = @(git status --porcelain 2>$null | ForEach-Object { $_.Substring(3) })
    } finally {
      Pop-Location
    }
  }

  # --- Git bundle (full history, portable) ---
  if ($hasGit) {
    Write-Log "Creating git bundle..."
    Push-Location $workspaceRoot
    try {
      git bundle create $destBundle --all 2>&1 | ForEach-Object { Write-Log $_ }
      if ($LASTEXITCODE -ne 0) { throw "git bundle failed with exit $LASTEXITCODE" }
    } finally {
      Pop-Location
    }
  } else {
    Write-Log "WARN: no .git directory - skipping bundle"
  }

  # --- Working tree mirror ---
  $robocopyArgs = @(
    $workspaceRoot,
    $destWorkspace,
    "/MIR", "/R:2", "/W:3",
    "/NFL", "/NDL", "/NJH", "/NJS", "/NC", "/NS",
    "/XD", "node_modules", ".next", ".git"
  )
  if (-not $includeOut) {
    $robocopyArgs += "/XD", "out"
  }

  Write-Log "Mirroring workspace (robocopy)..."
  & robocopy @robocopyArgs | Out-Null
  # robocopy exit 0-7 = success
  if ($LASTEXITCODE -gt 7) {
    throw "robocopy failed with exit $LASTEXITCODE"
  }

  # --- Optional env / secrets (never in git) ---
  $envCopied = @()
  if ($includeEnv) {
    New-Item -ItemType Directory -Path $destEnv -Force | Out-Null
    Get-ChildItem -Path $workspaceRoot -Filter ".env*" -File -Force -ErrorAction SilentlyContinue | ForEach-Object {
      Copy-Item $_.FullName -Destination (Join-Path $destEnv $_.Name) -Force
      $envCopied += $_.Name
    }
    $envList = if ($envCopied.Count) { $envCopied -join ", " } else { "(none)" }
    Write-Log ("Copied env files: {0}" -f $envList)
  }

  # --- Manifest ---
  function Get-FolderSizeBytes([string]$Path) {
    if (-not (Test-Path $Path)) { return 0 }
    $sum = (Get-ChildItem -Path $Path -Recurse -File -Force -ErrorAction SilentlyContinue |
      Measure-Object -Property Length -Sum).Sum
    if ($null -eq $sum) { return 0 }
    return [long]$sum
  }

  $manifest = [ordered]@{
    generatedAt = (Get-Date).ToUniversalTime().ToString("o")
    workspaceRoot = $workspaceRoot
    backupRoot = $backupRoot
    git = @{
      head = $headSha
      branch = $branch
      dirtyFileCount = $dirtyFiles.Count
      dirtyFiles = $dirtyFiles
    }
    includes = @{
      envFiles = $includeEnv
      out = $includeOut
      nodeModules = $includeNodeModules
    }
    envFilesCopied = $envCopied
    bytes = @{
      workspace = (Get-FolderSizeBytes $destWorkspace)
      bundle = if (Test-Path $destBundle) { (Get-Item $destBundle).Length } else { 0 }
      env = (Get-FolderSizeBytes $destEnv)
      total = (Get-FolderSizeBytes $destRoot)
    }
  }

  $manifestPath = Join-Path $destRoot "manifest.json"
  $manifest | ConvertTo-Json -Depth 6 | Set-Content -Path $manifestPath -Encoding UTF8

  # --- Retention ---
  if ($keepDays -gt 0) {
    $cutoff = (Get-Date).AddDays(-$keepDays)
    Get-ChildItem -Path $backupRoot -Directory -ErrorAction SilentlyContinue |
      Where-Object {
        $_.Name -match '^\d{4}-\d{2}-\d{2}_\d{6}$' -and $_.LastWriteTime -lt $cutoff
      } |
      ForEach-Object {
        Write-Log ("Pruning old backup {0}" -f $_.Name)
        Remove-Item $_.FullName -Recurse -Force
      }
  }

  # --- latest pointer (junction) ---
  $latestLink = Join-Path $backupRoot "latest"
  if (Test-Path $latestLink) {
    cmd /c "rmdir `"$latestLink`"" 2>$null | Out-Null
  }
  cmd /c "mklink /J `"$latestLink`" `"$destRoot`"" 2>$null | Out-Null

  $totalMb = [math]::Round(($manifest.bytes.total / 1MB), 1)
  Write-Log ("Done. Total ~{0} MB. Dirty files: {1}" -f $totalMb, $dirtyFiles.Count)
  Write-StatusJson @{
    state = "ok"
    destRoot = $destRoot
    totalMb = $totalMb
    dirtyFileCount = $dirtyFiles.Count
    head = $headSha
  }
  exit 0
}
catch {
  Write-Log ("FAILED: {0}" -f $_.Exception.Message)
  Write-StatusJson @{ state = "failed"; error = $_.Exception.Message }
  exit 1
}
finally {
  Exit-StayAwake
  Write-Log "=== nightly-backup end ==="
}
