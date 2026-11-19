# VIAGO - lance la carte + le routage sur le graphe national, en LOCAL.
# Usage (PowerShell, depuis la racine du depot) :  .\lancer_viago_national.ps1
# Arret : fermez les deux fenetres ouvertes, puis  docker stop viago-p4p7-r3
$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$py   = Join-Path $root ".venv\Scripts\python.exe"
if (-not (Test-Path $py)) { throw "Python du projet introuvable : $py" }

Write-Host "1/4 Demarrage de la base du graphe national (conteneur viago-p4p7-r3, lecture seule)..."
docker start viago-p4p7-r3 | Out-Null
Start-Sleep -Seconds 20

# Jeton local aleatoire, partage uniquement entre les deux processus ci-dessous.
$token = -join ((48..57) + (65..90) + (97..122) | Get-Random -Count 48 | ForEach-Object { [char]$_ })
$env:VIAGO_STAGING_BEARER_TOKEN  = $token
$env:VIAGO_ROUTING_API_BASE_URL  = "http://127.0.0.1:18765"
$env:DJANGO_SETTINGS_MODULE      = "config.settings_viago_national_local"
$env:VIAGO_NATIONAL_DB_PORT      = "55434"
$env:VIAGO_NATIONAL_DB_NAME      = "viago_routing_validation"

Write-Host "2/4 Serveur de routage Viago (127.0.0.1:18765)..."
Start-Process -FilePath $py -WorkingDirectory (Join-Path $root "apps\api") `
  -ArgumentList @("manage.py", "runserver", "127.0.0.1:18765", "--noreload")

# Carte locale : active automatiquement si les tuiles ont ete preparees.
if ((Test-Path (Join-Path $root ".tiles\guinea.pmtiles")) -and (Test-Path (Join-Path $root ".tiles\style.json"))) {
  $env:NEXT_PUBLIC_VIAGO_BASEMAP = "local"
  Write-Host "   Fond de carte : LOCAL (tuiles Guinee)."
} else {
  Write-Host "   Fond de carte : OpenFreeMap (tuiles locales non preparees)."
}

# Hotes autorises a appeler le proxy de routage derriere tailscale serve (Origin != Host local).
$env:VIAGO_ALLOWED_ORIGIN_HOSTS = "pc-dieila.tail2e1adc.ts.net"

Write-Host "3/4 Application web (http://localhost:3107)..."
Start-Process -FilePath "powershell.exe" -WorkingDirectory (Join-Path $root "apps\web") `
  -ArgumentList @("-NoExit", "-Command", "npm run dev -- -p 3107")

Start-Sleep -Seconds 12
Write-Host "4/4 Ouverture : http://localhost:3107/viago"
Start-Process "http://localhost:3107/viago"

