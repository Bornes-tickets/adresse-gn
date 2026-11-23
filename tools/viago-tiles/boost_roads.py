#!/usr/bin/env python3
"""Elargit encore les routes de la carte (apres apply_nav_theme.py), sans toucher a la ligne bleue d'itineraire.

Usage : python3 boost_roads.py <style.json> [facteur=1.3]
Idempotent : un style deja traite (metadata.viago_road_boost) n'est jamais re-multiplie.
Une sauvegarde <style.json>.before_boost est creee la premiere fois.
"""
import json
import shutil
import sys


def _is_road_line(layer_id: str) -> bool:
    if "rail" in layer_id or "pattern" in layer_id:
        return False
    return layer_id.startswith(("road_", "bridge_", "tunnel_")) and "arrow" not in layer_id and "path" not in layer_id


def scale(expr, k):
    if isinstance(expr, bool):
        return expr
    if isinstance(expr, (int, float)):
        return round(expr * k, 3)
    if isinstance(expr, list) and expr:
        if expr[0] == "interpolate":
            out = list(expr)
            for i in range(4, len(out), 2):
                out[i] = scale(out[i], k)
            return out
        if expr[0] == "step":
            out = list(expr)
            out[2] = scale(out[2], k)
            for i in range(4, len(out), 2):
                out[i] = scale(out[i], k)
            return out
        return ["*", k, expr]
    return expr


def main() -> int:
    if len(sys.argv) < 2:
        print(__doc__)
        return 2
    path = sys.argv[1]
    k = float(sys.argv[2]) if len(sys.argv) > 2 else 1.3
    with open(path, encoding="utf-8") as f:
        style = json.load(f)
    meta = style.setdefault("metadata", {})
    if meta.get("viago_road_boost"):
        print("Deja applique (facteur %s) : rien a faire." % meta["viago_road_boost"])
        return 0
    shutil.copyfile(path, path + ".before_boost")
    n = 0
    for layer in style.get("layers", []):
        paint = layer.get("paint") or {}
        if layer.get("type") == "line" and _is_road_line(layer.get("id", "")) and "line-width" in paint:
            paint["line-width"] = scale(paint["line-width"], k)
            n += 1
    meta["viago_road_boost"] = k
    with open(path, "w", encoding="utf-8") as f:
        json.dump(style, f, ensure_ascii=False)
    print("Routes elargies x%s sur %d couches : %s" % (k, n, path))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
