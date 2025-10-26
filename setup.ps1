# MacroVox Setup Script for Windows
param([switch]$SkipNodeModules = $false, [switch]$SkipSoX = $false, [switch]$SkipAutoHotkey = $false)
$ErrorActionPreference = "Continue"
Write-Host "=== MacroVox Setup ===" -ForegroundColor Cyan
Write-Host "`n[1/5] Checking Node.js..." -ForegroundColor Yellow
$nodeVersion = node --version 2>$null
if ($LASTEXITCODE -eq 0) { Write-Host "✓ Node.js found: $nodeVersion" -ForegroundColor Green }
else { Write-Host "✗ Node.js not found. Install from https://nodejs.org (v20+ LTS)" -ForegroundColor Red; exit 1 }
if (-not $SkipNodeModules) {
    Write-Host "`n[2/5] Installing npm dependencies..." -ForegroundColor Yellow
    npm install
    if ($LASTEXITCODE -ne 0) { Write-Host "✗ npm install failed" -ForegroundColor Red; exit 1 }
    Write-Host "✓ Dependencies installed" -ForegroundColor Green
}
else { Write-Host "`n[2/5] Skipping npm install" -ForegroundColor Yellow }
Write-Host "`n[3/5] Checking SoX..." -ForegroundColor Yellow
$soxVersion = sox --version 2>$null
if ($LASTEXITCODE -eq 0) { Write-Host "✓ SoX found: $soxVersion" -ForegroundColor Green }
else {
    Write-Host "✗ SoX not found in PATH" -ForegroundColor Red
    Write-Host "  Install from: https://sox.sourceforge.net/download.html" -ForegroundColor Yellow
    Write-Host "  1. Download sox-14.4.2-win32.zip" -ForegroundColor Yellow
    Write-Host "  2. Extract to C:\sox" -ForegroundColor Yellow
    Write-Host "  3. Add C:\sox to system PATH" -ForegroundColor Yellow
    if (-not $SkipSoX) { exit 1 }
}
Write-Host "`n[4/5] Checking AutoHotkey v2.0..." -ForegroundColor Yellow
$ahkVersion = AutoHotkey.exe --version 2>$null
if ($LASTEXITCODE -eq 0) {
    if ($ahkVersion -match "2\.0") { Write-Host "✓ AutoHotkey v2.0 found: $ahkVersion" -ForegroundColor Green }
    else { Write-Host "⚠ AutoHotkey found but version may not be v2.0: $ahkVersion" -ForegroundColor Yellow }
}
else {
    Write-Host "✗ AutoHotkey not found in PATH" -ForegroundColor Red
    Write-Host "  Install from: https://www.autohotkey.com" -ForegroundColor Yellow
    Write-Host "  1. Download and run installer" -ForegroundColor Yellow
    Write-Host "  2. Select AutoHotkey v2.0" -ForegroundColor Yellow
    if (-not $SkipAutoHotkey) { exit 1 }
}
Write-Host "`n[5/5] Checking .env configuration..." -ForegroundColor Yellow
if (Test-Path ".env") {
    $envContent = Get-Content ".env" -Raw
    if ($envContent -match "DEEPGRAM_API_KEY=your_api_key_here" -or $envContent -match "DEEPGRAM_API_KEY=$") {
        Write-Host "⚠ .env exists but DEEPGRAM_API_KEY not set" -ForegroundColor Yellow
        Write-Host "  Get key from: https://console.deepgram.com" -ForegroundColor Yellow
    }
    else { Write-Host "✓ .env file configured" -ForegroundColor Green }
}
else {
    Write-Host "⚠ .env not found. Creating from .env.example..." -ForegroundColor Yellow
    Copy-Item ".env.example" ".env"
    Write-Host "✓ Created .env" -ForegroundColor Green
}
Write-Host "`n=== Setup Complete ===" -ForegroundColor Cyan
Write-Host "Next steps:" -ForegroundColor Yellow
Write-Host "  1. Edit .env and add DEEPGRAM_API_KEY" -ForegroundColor Yellow
Write-Host "  2. Run: npm start" -ForegroundColor Yellow
Write-Host "  3. Speak a command (e.g., undo, cut)" -ForegroundColor Yellow
Write-Host ""
