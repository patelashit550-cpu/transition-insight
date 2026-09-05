# One-time local setup for production ships from this repo.
# Run: npm run setup:ship

$ErrorActionPreference = "Stop"
Set-Location (Join-Path $PSScriptRoot "..")

git config --local user.name "Ashit Milne"
git config --local user.email "290472903+patelashit550-cpu@users.noreply.github.com"

Write-Host ""
Write-Host "setup-ship: git commit identity configured for this repo."
Write-Host ""
Write-Host "Deploy (from Cursor terminal or any shell):"
Write-Host '  npm run ship -- --push -m "Your message."'
Write-Host ""
Write-Host "Analytics MCP plugins (Mixpanel, Amplitude, PostHog, Pendo) are not used"
Write-Host "by this static-site repo. If they keep opening a browser:"
Write-Host "  Cursor sidebar -> Customize -> toggle OFF unused MCP plugins."
Write-Host "  Disabled plugins stay off across sessions."
Write-Host ""
