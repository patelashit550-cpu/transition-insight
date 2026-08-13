#Requires -Version 5.1
<#
.SYNOPSIS
  Audit a Windows 11 development environment (host tools + WSL).

.DESCRIPTION
  Prints a readable report and writes JSON to:
    %LOCALAPPDATA%\transition-insight\dev-env-audit.json

  Checks OS, shell, PATH tools, Node/Python/Git/Docker, editors,
  package managers, disk/memory, and WSL status/distributions.

.EXAMPLE
  powershell -NoProfile -ExecutionPolicy Bypass -File scripts/audit-windows-dev-env.ps1

.EXAMPLE
  npm run audit:windows-dev

.NOTES
  WSL quick commands (run in elevated PowerShell when installing):

    # Install WSL + default Ubuntu (Windows 11)
    wsl --install

    # Or pick a distro
    wsl --list --online
    wsl --install -d Ubuntu-22.04

    # Status / list
    wsl --status
    wsl -l -v

    # Update WSL kernel / set default
    wsl --update
    wsl --set-default-version 2
    wsl --set-default Ubuntu-22.04

    # Enter / shutdown
    wsl
    wsl -d Ubuntu-22.04
    wsl --shutdown

    # Inside WSL (after first launch):
    sudo apt update && sudo apt upgrade -y
    sudo apt install -y build-essential git curl
#>
param(
  [string]$OutDir = (Join-Path $env:LOCALAPPDATA "transition-insight"),
  [switch]$JsonOnly
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Continue"

function Write-Section([string]$Title) {
  if ($JsonOnly) { return }
  Write-Host ""
  Write-Host ("==== {0} ====" -f $Title) -ForegroundColor Cyan
}

function Write-Item([string]$Name, [string]$Value, [string]$Status = "info") {
  if ($JsonOnly) { return }
  $color = switch ($Status) {
    "ok" { "Green" }
    "warn" { "Yellow" }
    "missing" { "Red" }
    default { "Gray" }
  }
  Write-Host ("  {0,-28} {1}" -f $Name, $Value) -ForegroundColor $color
}

function Get-CommandInfo([string]$Name) {
  $cmd = Get-Command $Name -ErrorAction SilentlyContinue
  if (-not $cmd) {
    return [ordered]@{
      name      = $Name
      present   = $false
      path      = $null
      version   = $null
      source    = $null
    }
  }
  $version = $null
  try {
    switch -Regex ($Name) {
      "^(node|npm|npx|pnpm|yarn|bun)$" {
        $version = (& $Name --version 2>$null | Select-Object -First 1)
      }
      "^(git|gh|rg|fd|fzf|jq|docker|kubectl|helm|terraform|aws|az|gcloud|cargo|rustc|go|php|ruby|deno)$" {
        $version = (& $Name --version 2>$null | Select-Object -First 1)
      }
      "^python(\d+(\.\d+)?)?$" {
        $version = (& $Name --version 2>$null | Select-Object -First 1)
      }
      "^pip(\d+)?$" {
        $version = (& $Name --version 2>$null | Select-Object -First 1)
      }
      "^code$" {
        $version = (& $Name --version 2>$null | Select-Object -First 1)
      }
      "^cursor$" {
        $version = (& $Name --version 2>$null | Select-Object -First 1)
      }
      "^winget$" {
        $version = (& $Name --version 2>$null | Select-Object -First 1)
      }
      "^choco$" {
        $version = (& $Name --version 2>$null | Select-Object -First 1)
      }
      "^scoop$" {
        $version = (& $Name --version 2>$null | Select-Object -First 1)
      }
      "^wsl$" {
        # wsl --version prints multi-line; keep first useful line
        $version = (& $Name --version 2>$null | Where-Object { $_ -match "\S" } | Select-Object -First 1)
      }
      default {
        $version = $null
      }
    }
  } catch {
    $version = $null
  }
  if ($version) { $version = ($version -replace "\s+", " ").Trim() }

  return [ordered]@{
    name      = $Name
    present   = $true
    path      = $cmd.Source
    version   = $version
    source    = $cmd.CommandType.ToString()
  }
}

function Test-Tool([string]$Name) {
  $info = Get-CommandInfo $Name
  if ($info.present) {
    $display = if ($info.version) { $info.version } else { $info.path }
    Write-Item $Name $display "ok"
  } else {
    Write-Item $Name "not found" "missing"
  }
  return $info
}

function Get-OsInfo {
  $caption = $null
  $version = $null
  $build = $null
  $arch = $env:PROCESSOR_ARCHITECTURE
  try {
    $os = Get-CimInstance Win32_OperatingSystem -ErrorAction Stop
    $caption = $os.Caption
    $version = $os.Version
    $build = $os.BuildNumber
  } catch {
    try {
      $caption = (Get-ItemProperty "HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion").ProductName
      $build = (Get-ItemProperty "HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion").CurrentBuild
      $version = [System.Environment]::OSVersion.Version.ToString()
    } catch { }
  }
  $isWin11 = $false
  if ($build -and [int]$build -ge 22000) { $isWin11 = $true }

  return [ordered]@{
    caption     = $caption
    version     = $version
    build       = $build
    architecture = $arch
    isWindows11 = $isWin11
    computerName = $env:COMPUTERNAME
    userName     = $env:USERNAME
    userProfile  = $env:USERPROFILE
    powershell   = $PSVersionTable.PSVersion.ToString()
    executionPolicy = (Get-ExecutionPolicy -ErrorAction SilentlyContinue).ToString()
  }
}

function Get-HardwareInfo {
  $memGb = $null
  $cpu = $null
  try {
    $os = Get-CimInstance Win32_OperatingSystem -ErrorAction Stop
    $memGb = [math]::Round($os.TotalVisibleMemorySize / 1MB, 1)
  } catch { }
  try {
    $cpu = (Get-CimInstance Win32_Processor -ErrorAction Stop | Select-Object -First 1).Name
  } catch { }

  $drives = @()
  try {
    Get-CimInstance Win32_LogicalDisk -Filter "DriveType=3" -ErrorAction Stop | ForEach-Object {
      $drives += [ordered]@{
        deviceId  = $_.DeviceID
        freeGb    = [math]::Round($_.FreeSpace / 1GB, 1)
        sizeGb    = [math]::Round($_.Size / 1GB, 1)
        freePct   = if ($_.Size -gt 0) { [math]::Round(100 * $_.FreeSpace / $_.Size, 1) } else { $null }
      }
    }
  } catch { }

  return [ordered]@{
    cpu           = $cpu
    memoryTotalGb = $memGb
    drives        = $drives
  }
}

function Get-WslInfo {
  $wslCmd = Get-Command wsl -ErrorAction SilentlyContinue
  if (-not $wslCmd) {
    return [ordered]@{
      present = $false
      status  = $null
      version = $null
      distros = @()
      notes   = @("wsl.exe not found - install with: wsl --install")
    }
  }

  $statusText = $null
  $versionText = $null
  $distros = @()
  $notes = @()

  try {
    $statusText = (& wsl --status 2>&1 | Out-String).Trim()
  } catch {
    $notes += "wsl --status failed: $($_.Exception.Message)"
  }

  try {
    $versionText = (& wsl --version 2>&1 | Out-String).Trim()
  } catch {
    # Older WSL may not support --version
  }

  try {
    # Prefer machine-readable list when available
    $raw = & wsl -l -v 2>&1
    $lines = @($raw | ForEach-Object { "$_" })
    foreach ($line in $lines) {
      $clean = ($line -replace "`0", "" -replace "\s+", " ").Trim()
      if (-not $clean) { continue }
      if ($clean -match "^(NAME|Windows Subsystem)") { continue }
      if ($clean -match "^\*?\s*(\S+)\s+(\S+)\s+(\d+)\s*$") {
        $distros += [ordered]@{
          name    = $Matches[1]
          state   = $Matches[2]
          version = [int]$Matches[3]
          default = $clean.StartsWith("*")
        }
      } elseif ($clean -match "^\*?\s*(\S+)\s+(\S+)\s*$") {
        $distros += [ordered]@{
          name    = $Matches[1]
          state   = $Matches[2]
          version = $null
          default = $clean.StartsWith("*")
        }
      }
    }
  } catch {
    $notes += "wsl -l -v failed: $($_.Exception.Message)"
  }

  if ($distros.Count -eq 0) {
    $notes += "No distros listed. Install one: wsl --install -d Ubuntu-22.04"
  }

  return [ordered]@{
    present = $true
    status  = $statusText
    version = $versionText
    distros = $distros
    notes   = $notes
  }
}

function Get-OptionalFeatureState([string]$FeatureName) {
  try {
    $f = Get-WindowsOptionalFeature -Online -FeatureName $FeatureName -ErrorAction Stop
    return $f.State.ToString()
  } catch {
    return $null
  }
}

# --- Run audit ---
$startedAt = (Get-Date).ToUniversalTime().ToString("o")

Write-Section "Operating System"
$os = Get-OsInfo
Write-Item "Caption" $os.caption $(if ($os.isWindows11) { "ok" } else { "warn" })
Write-Item "Version / Build" ("{0} (build {1})" -f $os.version, $os.build)
Write-Item "Architecture" $os.architecture
Write-Item "Computer / User" ("{0} / {1}" -f $os.computerName, $os.userName)
Write-Item "PowerShell" $os.powershell
Write-Item "ExecutionPolicy" $os.executionPolicy

Write-Section "Hardware"
$hw = Get-HardwareInfo
Write-Item "CPU" $(if ($hw.cpu) { $hw.cpu } else { "unknown" })
Write-Item "Memory (GB)" $(if ($null -ne $hw.memoryTotalGb) { "$($hw.memoryTotalGb)" } else { "unknown" })
foreach ($d in $hw.drives) {
  $status = if ($d.freePct -lt 15) { "warn" } else { "ok" }
  $diskLabel = '{0} GB free / {1} GB ({2} pct)' -f $d.freeGb, $d.sizeGb, $d.freePct
  Write-Item ("Disk {0}" -f $d.deviceId) $diskLabel $status
}

Write-Section "Package managers"
$tools = [ordered]@{}
foreach ($name in @("winget", "choco", "scoop")) {
  $tools[$name] = Test-Tool $name
}

Write-Section "Core CLI"
foreach ($name in @("git", "gh", "curl", "ssh", "tar", "rg", "jq")) {
  $tools[$name] = Test-Tool $name
}

Write-Section "JavaScript / Node"
foreach ($name in @("node", "npm", "npx", "pnpm", "yarn", "bun", "deno")) {
  $tools[$name] = Test-Tool $name
}

Write-Section "Python"
foreach ($name in @("python", "python3", "py", "pip", "pip3")) {
  $tools[$name] = Test-Tool $name
}

Write-Section "Containers / cloud"
foreach ($name in @("docker", "kubectl", "helm", "terraform", "aws", "az", "gcloud")) {
  $tools[$name] = Test-Tool $name
}

Write-Section "Editors / IDEs"
foreach ($name in @("code", "cursor")) {
  $tools[$name] = Test-Tool $name
}

Write-Section "WSL"
$wsl = Get-WslInfo
if (-not $wsl.present) {
  Write-Item "WSL" "not installed" "missing"
  Write-Item "Install" "wsl --install" "warn"
} else {
  Write-Item "WSL" "present" "ok"
  if ($wsl.version) {
    $firstLine = ($wsl.version -split "`r?`n" | Where-Object { $_ -match "\S" } | Select-Object -First 1)
    Write-Item "WSL version" $firstLine "ok"
  }
  if ($wsl.status) {
    foreach ($line in ($wsl.status -split "`r?`n" | Where-Object { $_ -match "\S" })) {
      Write-Item "Status" $line.Trim() "info"
    }
  }
  if ($wsl.distros.Count -eq 0) {
    Write-Item "Distros" "none" "warn"
  } else {
    foreach ($d in $wsl.distros) {
      $label = if ($d.default) { "$($d.name) (default)" } else { $d.name }
      $detail = if ($null -ne $d.version) { "state=$($d.state) wsl=$($d.version)" } else { "state=$($d.state)" }
      $status = if ($d.state -match "Running|Stopped") { "ok" } else { "warn" }
      Write-Item $label $detail $status
    }
  }
  foreach ($n in $wsl.notes) {
    Write-Item "Note" $n "warn"
  }
}

# Optional Windows features related to containers / WSL (may need admin)
Write-Section "Windows features (optional)"
$featureNames = @(
  "Microsoft-Windows-Subsystem-Linux",
  "VirtualMachinePlatform",
  "Microsoft-Hyper-V-All",
  "Containers"
)
$features = [ordered]@{}
foreach ($fn in $featureNames) {
  $state = Get-OptionalFeatureState $fn
  $features[$fn] = $state
  if ($null -eq $state) {
    Write-Item $fn "unavailable (need admin / not present)" "info"
  } else {
    $status = if ($state -eq "Enabled") { "ok" } else { "warn" }
    Write-Item $fn $state $status
  }
}

# Project-aware hints when run from this repo
Write-Section "This repository"
$repoRoot = Split-Path $PSScriptRoot -Parent
$pkgPath = Join-Path $repoRoot "package.json"
$nodeModules = Join-Path $repoRoot "node_modules"
$repoHints = [ordered]@{
  root            = $repoRoot
  packageJson     = (Test-Path $pkgPath)
  nodeModules     = (Test-Path $nodeModules)
  suggestedNext   = @()
}
if (-not $tools.node.present) {
  $repoHints.suggestedNext += "Install Node.js LTS (winget install OpenJS.NodeJS.LTS)"
} elseif (-not (Test-Path $nodeModules)) {
  $repoHints.suggestedNext += "From repo root: npm install"
}
if (-not $tools.git.present) {
  $repoHints.suggestedNext += "Install Git (winget install Git.Git)"
}
if (-not $wsl.present) {
  $repoHints.suggestedNext += "Install WSL: wsl --install"
} elseif ($wsl.distros.Count -eq 0) {
  $repoHints.suggestedNext += "Install a distro: wsl --install -d Ubuntu-22.04"
}

Write-Item "Repo root" $repoRoot
Write-Item "package.json" $(if ($repoHints.packageJson) { "yes" } else { "no" }) $(if ($repoHints.packageJson) { "ok" } else { "warn" })
Write-Item "node_modules" $(if ($repoHints.nodeModules) { "yes" } else { "no" }) $(if ($repoHints.nodeModules) { "ok" } else { "warn" })
foreach ($hint in $repoHints.suggestedNext) {
  Write-Item "Next" $hint "warn"
}

$report = [ordered]@{
  startedAt = $startedAt
  finishedAt = (Get-Date).ToUniversalTime().ToString("o")
  os        = $os
  hardware  = $hw
  tools     = $tools
  wsl       = $wsl
  features  = $features
  repository = $repoHints
}

if (-not (Test-Path $OutDir)) {
  New-Item -ItemType Directory -Path $OutDir -Force | Out-Null
}
$outFile = Join-Path $OutDir "dev-env-audit.json"
$report | ConvertTo-Json -Depth 8 | Set-Content -Path $outFile -Encoding UTF8

if (-not $JsonOnly) {
  Write-Host ""
  Write-Host ("Report written to: {0}" -f $outFile) -ForegroundColor Green
  Write-Host ""
  Write-Host "WSL cheat sheet:" -ForegroundColor Cyan
  Write-Host "  wsl --install                     # first-time install (reboot may be required)"
  Write-Host "  wsl --list --online               # available distros"
  Write-Host "  wsl --install -d Ubuntu-22.04     # install specific distro"
  Write-Host "  wsl -l -v                         # list installed distros"
  Write-Host "  wsl --status                      # default distro / WSL version"
  Write-Host "  wsl --update                      # update WSL"
  Write-Host "  wsl --set-default-version 2       # prefer WSL2"
  Write-Host "  wsl                               # open default distro"
  Write-Host "  wsl --shutdown                    # stop all distros"
}

# Exit non-zero if critical tools missing
$criticalMissing = @()
foreach ($c in @("git", "node", "npm")) {
  if (-not $tools[$c].present) { $criticalMissing += $c }
}
if ($criticalMissing.Count -gt 0) {
  if (-not $JsonOnly) {
    Write-Host ("Missing critical tools: {0}" -f ($criticalMissing -join ", ")) -ForegroundColor Yellow
  }
  exit 2
}
exit 0
