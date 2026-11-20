#!/usr/bin/env python3
"""Theme "navigation" Viago pour le style de la carte locale (derive d'OpenFreeMap Liberty).

Objectif : une carte lisible en conduite, plus proche de Google Maps / Waze :
 - routes plus larges et mieux contrastees (liseré de bord plus marque),
 - batiments plats et discrets (pas d'extrusion 3D ni d'ombres),
 - eau, parcs et fond plus nets, noms de rues plus lisibles.

Usage : python apply_nav_theme.py <style.json> [sortie.json]   (idempotent)
"""
import json
import sys

ROAD_SCALE = 3.4          # largeur des routes au zoom de navigation (>= z15)
SCALE_FROM, SCALE_FULL = 13.0, 15.0

BACKGROUND = "#eeebe3"
BUILDING_FILL = "#e1dccf"
BUILDING_OUTLINE = "#cbc5b6"
WATER = "#a9d3f2"
PARK = "#cde6bd"
ROAD_CASING_MINOR = "#b3ad9f"
LABEL = "#3b3b3b"


def _scale_stops(expr, k):
    """Multiplie les sorties numeriques d'un interpolate sur le zoom (progressif de z13 a z15)."""
    if not (isinstance(expr, list) and len(expr) >= 5 and expr[0] == "interpolate" and expr[2] == ["zoom"]):
        return expr
    out = list(expr)
    for i in range(3, len(out) - 1, 2):
        z, v = out[i], out[i + 1]
        if isinstance(v, (int, float)) and not isinstance(v, bool):
            t = max(0.0, min(1.0, (z - SCALE_FROM) / (SCALE_FULL - SCALE_FROM)))
            out[i + 1] = round(v * (1 + (k - 1) * t), 3)
    return out


def _is_road_line(layer_id: str) -> bool:
    if layer_id.endswith(("_rail", "_rail_hatching")) or "rail" in layer_id or "pattern" in layer_id:
        return False
    return layer_id.startswith(("road_", "bridge_", "tunnel_")) and "arrow" not in layer_id and "path" not in layer_id


def apply_nav_theme(style: dict) -> dict:
    if style.get("metadata", {}).get("viago_nav_theme") == THEME_VERSION:
        return style   # deja applique : ne jamais recomposer les largeurs
    layers = style.get("layers", [])
    for layer in layers:
        lid, paint = layer.get("id", ""), layer.setdefault("paint", {})
        if lid == "background":
            paint["background-color"] = BACKGROUND
        elif lid == "water":
            paint["fill-color"] = WATER
        elif lid == "park":
            paint["fill-color"] = PARK
            paint["fill-opacity"] = 0.85
        elif lid == "building":
            # batiments plats a tous les zooms, discrets (la 3D est desactivee plus bas)
            layer["minzoom"] = 13
            layer.pop("maxzoom", None)

            paint["fill-color"] = BUILDING_FILL
            paint["fill-outline-color"] = BUILDING_OUTLINE
        elif lid == "building-3d":
            layer.setdefault("layout", {})["visibility"] = "none"   # pas de 3D
        elif _is_road_line(lid) and layer.get("type") == "line":
            if "width" in str(paint.get("line-width", "")) or "line-width" in paint:
                paint["line-width"] = _scale_stops(paint["line-width"], ROAD_SCALE)
            if lid in ("road_minor_casing", "road_service_track_casing", "bridge_street_casing", "tunnel_street_casing"):
                paint["line-color"] = ROAD_CASING_MINOR
                # liseré visible des z12.5 (comme Google Maps), pas seulement a fort zoom
                if lid == "road_minor_casing":
                    paint["line-opacity"] = ["interpolate", ["linear"], ["zoom"], 12, 0, 12.5, 1]
        elif lid.startswith("highway-name"):
            paint["text-color"] = LABEL
            paint["text-halo-color"] = "#ffffff"
            paint["text-halo-width"] = 1.8
            paint["text-halo-blur"] = 0.4
    if SHOW_UNPAVED:
        _add_unpaved_overlay(style)
    style.setdefault("metadata", {})["viago_nav_theme"] = THEME_VERSION
    return style


THEME_VERSION = 4
SHOW_UNPAVED = False   # desactive : donnees de revetement OSM trop incompletes (routes goudronnees affichees en terre)
UNPAVED_COLOR = "#8a5a2b"   # brun terre : piste / route non revetue
UNPAVED_LAYER_ID = "viago-unpaved-dash"


UNPAVED_FILL = "#d9b583"     # sable : route non revetue
UNPAVED_CASING = "#8f5f2e"   # brun terre
UNPAVED_GROUPS = {
    "minor": (["minor", "street", "street_limited"], "road_minor"),
    "secondary": (["secondary", "tertiary"], "road_secondary_tertiary"),
    "primary": (["primary", "trunk"], "road_trunk_primary"),
    "track": (["service", "track"], "road_service_track"),
}


def _widen(expr, extra):
    if not (isinstance(expr, list) and expr and expr[0] == "interpolate"):
        return expr
    out = list(expr)
    for i in range(4, len(out), 2):
        if isinstance(out[i], (int, float)) and out[i] > 0:
            out[i] = round(out[i] + extra, 3)
    return out


def _add_unpaved_overlay(style: dict) -> None:
    """Dessine les routes non revetues comme de VRAIES routes larges (sable + liseré brun),
    de la meme largeur que les routes goudronnees de leur classe.

    Source : attribut OSM `surface=unpaved` (ou classe `track`). Les routes sans
    tag de revetement ne sont PAS marquees (donnee absente)."""
    layers = style["layers"]
    layers[:] = [l for l in layers if not str(l.get("id", "")).startswith(("viago-unpaved", UNPAVED_LAYER_ID))]
    by_id = {l.get("id"): l for l in layers}
    new_layers = []
    for group, (classes, road_id) in UNPAVED_GROUPS.items():
        road = by_id.get(road_id)
        if not road:
            continue
        width = road["paint"].get("line-width")
        flt = ["all",
               ["match", ["geometry-type"], ["LineString", "MultiLineString"], True, False],
               ["match", ["get", "brunnel"], ["bridge", "tunnel"], False, True],
               ["match", ["get", "class"], classes, True, False],
               ["any", ["==", ["get", "surface"], "unpaved"], ["==", ["get", "class"], "track"]]]
        common = {"type": "line", "source": "openmaptiles", "source-layer": "transportation",
                  "filter": flt, "layout": {"line-cap": "round", "line-join": "round"}}
        new_layers.append({**common, "id": f"viago-unpaved-casing-{group}", "minzoom": 11,
                           "paint": {"line-color": UNPAVED_CASING, "line-width": _widen(width, 2.2)}})
        new_layers.append({**common, "id": f"viago-unpaved-fill-{group}", "minzoom": 11,
                           "paint": {"line-color": UNPAVED_FILL, "line-width": width}})
    idx = next((i for i, l in enumerate(layers) if l.get("id", "").startswith("bridge_")), None)
    if idx is None:
        idx = next((i for i, l in enumerate(layers) if l.get("type") == "symbol"), len(layers))
    layers[idx:idx] = new_layers


def main() -> int:
    if len(sys.argv) < 2:
        print(__doc__)
        return 2
    src = sys.argv[1]
    dst = sys.argv[2] if len(sys.argv) > 2 else src
    with open(src, encoding="utf-8") as f:
        style = json.load(f)
    apply_nav_theme(style)
    with open(dst, "w", encoding="utf-8") as f:
        json.dump(style, f, ensure_ascii=False)
    print("Theme navigation applique :", dst)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
