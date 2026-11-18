"""VIAGO - prepare le fond de carte LOCAL (style, polices, icones) a partir du style OpenFreeMap Liberty.

A lancer une fois, depuis la racine du depot, avec Internet :
    .venv\\Scripts\\python.exe tools\\viago-tiles\\build_basemap.py

Produit (aucune dependance Python, bibliotheque standard seulement) :
    apps/web/public/viago-map/fonts/<police>/<plage>.pbf   (polices des etiquettes)
    apps/web/public/viago-map/sprite/ofm(.json|.png|@2x...) (icones)
    .tiles/style.json  (style avec les adresses LOCALES ; __ORIGIN__ est remplace a la volee)

Les tuiles elles-memes (.tiles/guinea.pmtiles) sont generees par preparer_tuiles_guinee.ps1.
Donnees : (c) OpenStreetMap contributors (ODbL) ; schema OpenMapTiles (c) OpenMapTiles.
"""
from __future__ import annotations

import json
import os
import sys
import urllib.parse
import urllib.request

STYLE_URL = os.environ.get("VIAGO_STYLE_URL", "https://tiles.openfreemap.org/styles/liberty")
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
PUBLIC = os.path.join(ROOT, "apps", "web", "public", "viago-map")
TILES = os.path.join(ROOT, ".tiles")
# Plages de caracteres : latin de base, latin etendu A/B, ponctuation generale.
RANGES = ["0-255", "256-511", "512-767", "8192-8447"]
DEFAULT_FONTS = ["Noto Sans Regular", "Noto Sans Bold", "Noto Sans Italic"]
ATTRIBUTION = ('<a href="https://www.openstreetmap.org/copyright" target="_blank">&copy; OpenStreetMap contributors</a> '
               '<a href="https://openmaptiles.org/" target="_blank">&copy; OpenMapTiles</a>')
PMTILES_SOURCE_URL = "pmtiles://__ORIGIN__/viago-tiles/guinea"


def fetch(url: str) -> bytes:
    request = urllib.request.Request(url, headers={"User-Agent": "viago-basemap-builder/1.0"})
    with urllib.request.urlopen(request, timeout=60) as response:
        return response.read()


def collect_fonts(value, found: set[str]) -> None:
    """Parcourt un style et retient toutes les piles de polices (text-font), y compris en expressions."""
    if isinstance(value, dict):
        for key, item in value.items():
            if key == "text-font":
                gather_font_names(item, found)
            else:
                collect_fonts(item, found)
    elif isinstance(value, list):
        for item in value:
            collect_fonts(item, found)


def gather_font_names(value, found: set[str]) -> None:
    if isinstance(value, str):
        found.add(value)
    elif isinstance(value, list):
        for item in value:
            gather_font_names(item, found)
    elif isinstance(value, dict):
        for item in value.values():
            gather_font_names(item, found)


def rewrite_style(style: dict) -> dict:
    sources = style.get("sources", {})
    vector_names = [name for name, src in sources.items() if src.get("type") == "vector"]
    if not vector_names:
        raise SystemExit("Le style ne contient aucune source vectorielle : structure inattendue.")
    for name in vector_names:
        sources[name] = {
            "type": "vector",
            "url": PMTILES_SOURCE_URL,
            "attribution": ATTRIBUTION,
        }
    for name, src in list(sources.items()):
        if src.get("type") not in ("vector",) and ("url" in src or "tiles" in src):
            # Toute autre source distante (raster, etc.) serait une dependance cachee.
            del sources[name]
            style["layers"] = [l for l in style.get("layers", []) if l.get("source") != name]
            print("Source distante retiree :", name, src.get("type"))
    style["glyphs"] = "__ORIGIN__/viago-map/fonts/{fontstack}/{range}.pbf"
    style["sprite"] = "__ORIGIN__/viago-map/sprite/ofm"
    return style


def main() -> int:
    print("1/4 Telechargement du style", STYLE_URL)
    style = json.loads(fetch(STYLE_URL))

    glyph_template = style.get("glyphs")
    sprite_base = style.get("sprite")
    if not glyph_template or not sprite_base:
        raise SystemExit("Le style n'indique pas de glyphes ou de sprite.")
    if isinstance(sprite_base, list):  # style a plusieurs sprites
        sprite_base = sprite_base[0]["url"]

    fonts: set[str] = set()
    collect_fonts(style.get("layers", []), fonts)
    fonts.update(DEFAULT_FONTS)
    print("2/4 Polices utilisees :", ", ".join(sorted(fonts)))

    count = 0
    for font in sorted(fonts):
        target_dir = os.path.join(PUBLIC, "fonts", font)
        os.makedirs(target_dir, exist_ok=True)
        for rng in RANGES:
            target = os.path.join(target_dir, rng + ".pbf")
            if os.path.exists(target) and os.path.getsize(target) > 0:
                continue
            url = glyph_template.replace("{fontstack}", urllib.parse.quote(font)).replace("{range}", rng)
            try:
                data = fetch(url)
            except Exception as exc:  # une plage absente n'est pas bloquante
                print("   plage ignoree", font, rng, "->", type(exc).__name__)
                continue
            with open(target, "wb") as handle:
                handle.write(data)
            count += 1
    print("   fichiers de polices telecharges :", count)

    print("3/4 Icones (sprite)")
    sprite_dir = os.path.join(PUBLIC, "sprite")
    os.makedirs(sprite_dir, exist_ok=True)
    for suffix in (".json", ".png", "@2x.json", "@2x.png"):
        data = fetch(sprite_base + suffix)
        with open(os.path.join(sprite_dir, "ofm" + suffix), "wb") as handle:
            handle.write(data)

    print("4/4 Ecriture du style local")
    os.makedirs(TILES, exist_ok=True)
    local = rewrite_style(style)
    with open(os.path.join(TILES, "style.json"), "w", encoding="utf-8") as handle:
        json.dump(local, handle, ensure_ascii=False)
    print("Termine : .tiles/style.json,", os.path.relpath(PUBLIC, ROOT))
    return 0


if __name__ == "__main__":
    sys.exit(main())

