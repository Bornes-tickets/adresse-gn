"""Revetement le long d'un itineraire VIAGO (lecture seule, facultatif).

Source : colonnes OSM de maps_routing_stage.routing_ways (surface, smoothness,
tracktype, highway). Une route SANS tag de revetement est classee "unknown" :
l'absence de donnee n'est jamais presentee comme "goudronne".
"""
from __future__ import annotations

from typing import Sequence

PAVED = {"asphalt", "paved", "concrete", "concrete:plates", "concrete:lanes",
         "paving_stones", "sett", "cobblestone", "metal", "bricks", "chipseal"}
UNPAVED = {"unpaved", "ground", "dirt", "earth", "gravel", "fine_gravel",
           "compacted", "sand", "mud", "grass", "pebblestone", "clay", "rock",
           "gravel;dirt", "dirt/sand", "soil", "woodchips"}
ROUGH_SMOOTHNESS = {"bad", "very_bad", "horrible", "very_horrible", "impassable"}
PROBABLE_UNPAVED_HIGHWAYS = {"track", "path"}

SQL = """
SELECT e.edge_id, w.highway, w.surface, w.surface_normalized,
       w.smoothness, w.tracktype
FROM maps_routing_stage.routing_edges AS e
JOIN maps_routing_stage.routing_ways AS w ON w.way_id = e.way_id
WHERE e.edge_id = ANY(%s::bigint[])
""".strip()


def classify(highway, surface, surface_normalized, smoothness, tracktype) -> str:
    """paved | unpaved | probable_unpaved | rough | unknown."""
    s = (surface or "").strip().lower()
    n = (surface_normalized or "").strip().lower()
    if smoothness and smoothness.strip().lower() in ROUGH_SMOOTHNESS:
        return "rough"
    if s in UNPAVED or n == "unpaved":
        return "unpaved"
    if s in PAVED or n == "paved":
        return "paved"
    if tracktype and tracktype.strip().lower() in {"grade2", "grade3", "grade4", "grade5"}:
        return "probable_unpaved"
    if (highway or "").strip().lower() in PROBABLE_UNPAVED_HIGHWAYS:
        return "probable_unpaved"
    return "unknown"


def surface_summary(*, portions: Sequence[tuple[int, float, float]],
                    lengths: Sequence[float], db_connection) -> dict:
    """Retourne {"sections": [...], "summary": {...}} ; jamais d'exception metier."""
    edge_ids = sorted({int(state) // 2 for state, _, _ in portions})
    with db_connection.cursor() as cursor:
        cursor.execute(SQL, [edge_ids])
        rows = {int(r[0]): classify(*r[1:]) for r in cursor.fetchall()}
    sections: list[dict] = []
    totals = {"paved": 0.0, "unpaved": 0.0, "probable_unpaved": 0.0,
              "rough": 0.0, "unknown": 0.0}
    cursor_m = 0.0
    for (state, _, _), length in zip(portions, lengths):
        kind = rows.get(int(state) // 2, "unknown")
        start, end = cursor_m, cursor_m + float(length)
        cursor_m = end
        totals[kind] += float(length)
        if kind in ("unpaved", "probable_unpaved", "rough"):
            if sections and sections[-1]["kind"] == kind and abs(sections[-1]["end_m"] - start) < 1.0:
                sections[-1]["end_m"] = round(end, 1)
            else:
                sections.append({"kind": kind, "start_m": round(start, 1), "end_m": round(end, 1)})
    return {"sections": sections,
            "summary": {k: round(v, 1) for k, v in totals.items()}}
