$ErrorActionPreference = 'Stop'
$project = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location -LiteralPath $project
Write-Host '=== VIAGO C14-P1 — ANDROID SETUP (DEV ONLY) ==='
if (-not (Get-Command node -ErrorAction SilentlyContinue)) { throw 'STOP: NODE_NOT_FOUND' }
if (-not (Get-Command npm -ErrorAction SilentlyContinue)) { throw 'STOP: NPM_NOT_FOUND' }
$nodeVer = (node -p 'process.versions.node').Trim()
$major = [int]($nodeVer.Split('.')[0])
if ($major -lt 22) { throw "STOP: NODE_22_REQUIRED (current=$nodeVer)" }
if (Test-Path -LiteralPath (Join-Path $project 'android')) { throw 'STOP: ANDROID_PROJECT_ALREADY_EXISTS' }
Write-Host ('NODE_VERSION = ' + $nodeVer)
Write-Host 'DEPENDENCY_INSTALL = START'
npm install --no-audit --no-fund
if ($LASTEXITCODE -ne 0) { throw 'STOP: NPM_INSTALL_FAILED' }
Write-Host 'ANDROID_PROJECT_GENERATION = START'
npx --no-install cap add android
if ($LASTEXITCODE -ne 0) { throw 'STOP: CAP_ADD_ANDROID_FAILED' }
Write-Host 'C14_P1_ANDROID_PROJECT = PASS'
Write-Host 'NEXT = npx --no-install cap open android'
