# VIAGO - prepare la carte LOCALE de la Guinee (tuiles vectorielles hebergees par vous).
# A lancer UNE fois depuis la racine du depot, avec Internet :  .\preparer_tuiles_guinee.ps1
# Telechargements : donnees OpenStreetMap Guinee (~100 Mo) + contours des oceans (~1 Go, une seule fois).
# Duree : 10 a 30 minutes. Rien n'est supprime ; les fichiers modifies sont sauvegardes en .bak.
$ErrorActionPreference = "Stop"
$root  = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $root
$py    = Join-Path $root ".venv\Scripts\python.exe"
$tiles = Join-Path $root ".tiles"
if (-not (Test-Path $py)) { throw "Python du projet introuvable : $py" }
New-Item -ItemType Directory -Force -Path $tiles | Out-Null

Write-Host "1/5 Dependance 'pmtiles' (lecteur de tuiles)..."
npm install pmtiles --workspace web
if ($LASTEXITCODE -ne 0) { throw "npm install pmtiles a echoue." }

Write-Host "2/5 Generation des tuiles de la Guinee (Planetiler dans Docker, nouveau conteneur temporaire)..."
docker run --rm -e JAVA_TOOL_OPTIONS="-Xmx2g" -v "${tiles}:/data" `
  ghcr.io/onthegomap/planetiler:latest `
  --download --area=guinea --output=/data/guinea.pmtiles --force
if ($LASTEXITCODE -ne 0) { throw "Planetiler a echoue (voir les messages ci-dessus)." }
if (-not (Test-Path (Join-Path $tiles "guinea.pmtiles"))) { throw "guinea.pmtiles n'a pas ete produit." }

Write-Host "3/5 Style, polices et icones locaux..."
& $py (Join-Path $root "tools\viago-tiles\build_basemap.py")
if ($LASTEXITCODE -ne 0) { throw "build_basemap.py a echoue." }

Write-Host "4/5 Activation dans la carte MapLibre (sauvegarde .bak)..."
$target = Join-Path $root "apps\web\src\features\viago\viago-maplibre.tsx"
$local  = Join-Path $root "tools\viago-tiles\viago-maplibre.local.tsx"
if (-not (Select-String -Path $target -Pattern "NEXT_PUBLIC_VIAGO_BASEMAP" -Quiet)) {
  Copy-Item $target "$target.bak" -Force
  Copy-Item $local $target -Force
  Write-Host "   viago-maplibre.tsx mis a jour."
} else { Write-Host "   deja active." }

$mb = [math]::Round((Get-Item (Join-Path $tiles "guinea.pmtiles")).Length / 1MB, 1)
Write-Host "5/5 Termine : .tiles\guinea.pmtiles ($mb Mo)."
Write-Host "Relancez maintenant :  .\lancer_viago_national.ps1   (il active la carte locale automatiquement)"
