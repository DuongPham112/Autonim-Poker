<#
.SYNOPSIS
    Sync Autonim-Poker client files to BannerGeneratorAI server for OTA updates.
    
.DESCRIPTION
    1. Copies client/ -> BannerGeneratorAI/server/poker-assets/client-bundle/
    2. Updates versions.json at Autonim-Poker repo root (for GitHub Raw check)
    3. Optionally accepts a changelog message
    4. Commits + pushes Autonim-Poker (versions.json) — NO commit to BannerGeneratorAI

.PARAMETER Changelog
    Optional changelog message for this version

.PARAMETER NoPush
    If set, skip git commit/push

.EXAMPLE
    .\sync-ota.ps1 -Changelog "feat: Save/Load layout with localStorage"
#>

param(
    [string]$Changelog = "",
    [switch]$NoPush
)

$ErrorActionPreference = "Stop"

# Paths
$PokerRoot = "I:\WebAppDev\Autonim-Poker"
$ServerRoot = "I:\WebAppDev\BannerGeneratorAI\server"
$ClientSrc = "$PokerRoot\client"
$BundleDest = "$ServerRoot\poker-assets\client-bundle"
$VersionsFile = "$PokerRoot\versions.json"
$UpdaterFile = "$ClientSrc\js\modules\updater.js"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Autonim-Poker OTA Sync" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Step 1: Extract CLIENT_VERSION from updater.js
Write-Host "[1/5] Extracting version from updater.js..." -ForegroundColor Yellow
$updaterContent = Get-Content $UpdaterFile -Raw
if ($updaterContent -match "const CLIENT_VERSION\s*=\s*'([^']+)'") {
    $clientVersion = $Matches[1]
    Write-Host "       Client version: v$clientVersion" -ForegroundColor Green
} else {
    Write-Host "ERROR: Could not find CLIENT_VERSION in updater.js" -ForegroundColor Red
    exit 1
}

# Step 2: Clean and sync client files to BannerGeneratorAI (for bundle download)
Write-Host "[2/5] Syncing client/ -> client-bundle/..." -ForegroundColor Yellow

# Remove old bundle
if (Test-Path $BundleDest) {
    Remove-Item $BundleDest -Recurse -Force
    Write-Host "       Cleaned old client-bundle/" -ForegroundColor DarkGray
}

# Copy new files (exclude unnecessary files)
Copy-Item $ClientSrc $BundleDest -Recurse -Force

# Remove files that shouldn't be in the bundle
$excludePatterns = @("*.map", "*.bak", "*.tmp")
foreach ($pattern in $excludePatterns) {
    Get-ChildItem $BundleDest -Recurse -Filter $pattern | Remove-Item -Force -ErrorAction SilentlyContinue
}

$fileCount = (Get-ChildItem $BundleDest -Recurse -File).Count
Write-Host "       Copied $fileCount files" -ForegroundColor Green

# Step 3: Update versions.json in Autonim-Poker repo root (GitHub Raw source)
Write-Host "[3/5] Updating versions.json (Autonim-Poker repo root)..." -ForegroundColor Yellow

$versions = Get-Content $VersionsFile -Raw | ConvertFrom-Json
$oldVersion = $versions.clientVersion
$versions.clientVersion = $clientVersion

if ($Changelog) {
    $versions.changelog = $Changelog
}

$versions | ConvertTo-Json -Depth 5 | Set-Content $VersionsFile -Encoding UTF8
Write-Host "       $oldVersion -> $clientVersion" -ForegroundColor Green
if ($Changelog) {
    Write-Host "       Changelog: $Changelog" -ForegroundColor DarkGray
}

# Step 4: Git commit + push Autonim-Poker (versions.json + source code)
Write-Host "[4/5] Git commit (Autonim-Poker)..." -ForegroundColor Yellow

if (-not $NoPush) {
    Push-Location $PokerRoot
    try {
        git add versions.json
        git commit -m "release: v$clientVersion`n`n$Changelog"
        Write-Host "       Committed versions.json" -ForegroundColor Green
    } catch {
        Write-Host "       Git commit skipped (maybe nothing changed): $_" -ForegroundColor DarkGray
    }
    Pop-Location
} else {
    Write-Host "       Skipped (--NoPush)" -ForegroundColor DarkGray
}

# Step 5: Push Autonim-Poker
Write-Host "[5/5] Pushing to remote..." -ForegroundColor Yellow

if (-not $NoPush) {
    Push-Location $PokerRoot
    try {
        git push
        Write-Host "       Pushed to remote" -ForegroundColor Green
    } catch {
        Write-Host "       Git push failed: $_" -ForegroundColor Red
    }
    Pop-Location
} else {
    Write-Host "       Skipped (--NoPush)" -ForegroundColor DarkGray
}

# Summary
Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  OTA Sync Complete!" -ForegroundColor Green
Write-Host "  Version: v$clientVersion" -ForegroundColor Green
Write-Host "  Files:   $fileCount" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Version check: GitHub Raw URL (live in ~5 min after push)" -ForegroundColor Yellow
Write-Host "Bundle download: Deploy BannerGeneratorAI to Vercel to make OTA bundle live." -ForegroundColor Yellow
