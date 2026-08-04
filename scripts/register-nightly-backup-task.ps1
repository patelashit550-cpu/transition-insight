#Requires -Version 5.1
<#
.SYNOPSIS
  Register a Windows Scheduled Task to run nightly-backup.ps1 at 2:15 AM daily.

  Run once from an elevated or normal PowerShell (runs as current user):
    powershell -ExecutionPolicy Bypass -File scripts/register-nightly-backup-task.ps1

  Unregister:
    Unregister-ScheduledTask -TaskName "TransitionInsight-NightlyBackup" -Confirm:$false
#>
param(
  [string]$TaskName = "TransitionInsight-NightlyBackup",
  [string]$RunAt = "02:15"
)

$repoRoot = Split-Path $PSScriptRoot -Parent
$scriptPath = Join-Path $PSScriptRoot "nightly-backup.ps1"
$configPath = Join-Path $PSScriptRoot "nightly-backup.config.json"

if (-not (Test-Path $configPath)) {
  Write-Error "Create scripts/nightly-backup.config.json first (copy from nightly-backup.config.example.json)."
}

$action = New-ScheduledTaskAction `
  -Execute "powershell.exe" `
  -Argument "-NoProfile -ExecutionPolicy Bypass -File `"$scriptPath`"" `
  -WorkingDirectory $repoRoot

$trigger = New-ScheduledTaskTrigger -Daily -At $RunAt

# WakeToRun: ask the PC to leave sleep/standby for the job.
# RestartCount: if Modern Standby kills a flash-wake attempt, retry a few times.
# StartWhenAvailable: catch up after missed 02:15 windows.
$settings = New-ScheduledTaskSettingsSet `
  -AllowStartIfOnBatteries `
  -DontStopIfGoingOnBatteries `
  -StartWhenAvailable `
  -WakeToRun `
  -RestartCount 3 `
  -RestartInterval (New-TimeSpan -Minutes 10) `
  -ExecutionTimeLimit (New-TimeSpan -Hours 2) `
  -MultipleInstances IgnoreNew

$principal = New-ScheduledTaskPrincipal -UserId $env:USERNAME -LogonType Interactive -RunLevel Limited

Register-ScheduledTask `
  -TaskName $TaskName `
  -Action $action `
  -Trigger $trigger `
  -Settings $settings `
  -Principal $principal `
  -Description "Nightly export of transition-insight workspace to external drive (wake + retry)." `
  -Force | Out-Null

Write-Host "Registered scheduled task '$TaskName' daily at $RunAt"
Write-Host "  WakeToRun=on, StartWhenAvailable=on, restart up to 3x every 10 min on failure"
Write-Host "  Local log: $env:LOCALAPPDATA\transition-insight\nightly-backup.log"
Write-Host "Ensure the backup drive is plugged in; test now: npm run backup:nightly"

# Best-effort: allow wake timers on AC (needs admin; ignore failure).
try {
  powercfg /SETACVALUEINDEX SCHEME_CURRENT SUB_SLEEP RTCWAKE 1 2>$null | Out-Null
  powercfg /SETACTIVE SCHEME_CURRENT 2>$null | Out-Null
  Write-Host "  AC wake timers enabled for current power scheme"
} catch {
  Write-Host "  (Could not enable AC wake timers - run elevated if backups miss while asleep)"
}
