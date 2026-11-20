"""Read-only, fail-closed geometry reconstruction for Viago routing.

Uses the GPS composition contract as the source of truth. Never draws an
approximate straight line. This implementation is intended for controlled
local graph validation before enabling a public endpoint.
"""
from __future__ import annotations

import json
import math
from collections.abc import Mapping

from django.db import connection

from .gps_route import compose_gps_route
from .snap import snap_point_to_routing_graph
from .viago_maneuvers import graph_maneuvers
from .state_od import execute_state_od_matrix, render_edge_sql


class ViagoGeometryUnavailable(RuntimeError):
    """No verified road geometry can be returned."""


PATH_SQL = """
SELECT path_seq, node, edge, agg_cost
FROM pgr_dijkstra(%s::text, %s::bigint, %s::bigint, directed := true)
ORDER BY path_seq
""".strip()

EDGE_SQL = """
SELECT
  ST_AsGeoJSON(
    CASE WHEN %s
      THEN ST_Reverse(ST_LineSubstring(e.geom, %s, %s))
      ELSE ST_LineSubstring(e.geom, %s, %s)
    END
  ) AS line_geojson,
  ST_Length(ST_LineSubstring(e.geom, %s, %s)::geography) AS length_m
FROM maps_routing_stage.routing_edges AS e
JOIN {profile_view} AS pv ON pv.id = e.edge_id
WHERE e.edge_id = %s
  AND ST_GeometryType(e.geom) = 'ST_LineString'
  AND (CASE WHEN %s THEN pv.reverse_cost ELSE pv.cost END) >= 0
""".strip()

PROFILE_VIEW = {
    "car": "maps_routing_stage.routing_edges_car",
    "motorcycle": "maps_routing_stage.routing_edges_motorcycle",
    "foot": "maps_routing_stage.routing_edges_foot",
}

# Estimation de duree distincte des couts ponderes pgRouting.
PROFILE_SPEED_COLUMN = {
    "car": "car_effective_speed_kmh",
    "motorcycle": "motorcycle_effective_speed_kmh",
    "foot": "foot_effective_speed_kmh",
}

DURATION_SQL = """
SELECT
  ST_Length(ST_LineSubstring(e.geom, %s, %s)::geography),
  w.{speed_column}
FROM maps_routing_stage.routing_edges AS e
JOIN maps_routing_stage.routing_ways AS w ON w.way_id = e.way_id
JOIN {profile_view} AS pv ON pv.id = e.edge_id
WHERE e.edge_id = %s
  AND ST_GeometryType(e.geom) = 'ST_LineString'
  AND (CASE WHEN %s THEN pv.reverse_cost ELSE pv.cost END) >= 0
""".strip()


def _seconds_for_state(*, state_id: int, profile: str,
                       start_fraction: float, end_fraction: float,
                       db_connection=connection) -> float | None:
    """Duree estimee sur la portion reelle du segment selectionne."""
    speed_column = PROFILE_SPEED_COLUMN.get(profile)
    if speed_column is None:
        return None

    if not all(math.isfinite(v) for v in (start_fraction, end_fraction)):
        return None

    if not (0 <= start_fraction <= 1 and 0 <= end_fraction <= 1):
        return None

    reverse = bool(state_id % 2)

    if start_fraction != end_fraction and reverse != (start_fraction > end_fraction):
        return None

    low, high = sorted((start_fraction, end_fraction))

    query = DURATION_SQL.format(
        speed_column=speed_column,
        profile_view=PROFILE_VIEW[profile],
    )

    with db_connection.cursor() as cursor:
        cursor.execute(
            query,
            [low, high, state_id // 2, reverse],
        )
        row = cursor.fetchone()

    if row is None or row[0] is None or row[1] is None:
        return None

    try:
        length_m = float(row[0])
        speed_kmh = float(row[1])
    except (TypeError, ValueError, OverflowError):
        return None

    if not (math.isfinite(length_m) and math.isfinite(speed_kmh)):
        return None

    if length_m < 0 or speed_kmh <= 0:
        return None

    seconds = length_m * 3.6 / speed_kmh

    return seconds if math.isfinite(seconds) and seconds >= 0 else None


BATCH_SQL = """
WITH req AS (
  SELECT t.edge_id, t.lo, t.hi, t.rev, t.ord
  FROM unnest(%s::bigint[], %s::float8[], %s::float8[], %s::boolean[])
       WITH ORDINALITY AS t(edge_id, lo, hi, rev, ord)
)
SELECT
  req.ord,
  ST_AsGeoJSON(
    CASE WHEN req.rev
      THEN ST_Reverse(ST_LineSubstring(e.geom, req.lo, req.hi))
      ELSE ST_LineSubstring(e.geom, req.lo, req.hi)
    END
  ) AS line_geojson,
  ST_Length(ST_LineSubstring(e.geom, req.lo, req.hi)::geography) AS length_m,
  w.{speed_column} AS speed_kmh
FROM req
JOIN maps_routing_stage.routing_edges AS e ON e.edge_id = req.edge_id
JOIN {profile_view} AS pv ON pv.id = e.edge_id
LEFT JOIN maps_routing_stage.routing_ways AS w ON w.way_id = e.way_id
WHERE ST_GeometryType(e.geom) = 'ST_LineString'
  AND (CASE WHEN req.rev THEN pv.reverse_cost ELSE pv.cost END) >= 0
ORDER BY req.ord
""".strip()


def _lines_for_portions(*, portions, profile: str,
                        db_connection=connection):
    """One SQL round trip for all path edges.

    Same checks as _line_for_state / _seconds_for_state. Returns a list of
    (coordinates, length_m, seconds_or_None) in path order.
    """
    if profile not in PROFILE_VIEW:
        raise ViagoGeometryUnavailable("Unknown routing profile.")
    edge_ids, lows, highs, revs = [], [], [], []
    for state_id, begin, finish in portions:
        if not 0 <= begin <= 1 or not 0 <= finish <= 1:
            raise ViagoGeometryUnavailable("Invalid edge fractions.")
        reverse = bool(state_id % 2)
        if reverse != (begin > finish) and begin != finish:
            raise ViagoGeometryUnavailable("Direction disagrees with state.")
        low, high = sorted((begin, finish))
        edge_ids.append(state_id // 2)
        lows.append(low)
        highs.append(high)
        revs.append(reverse)
    query = BATCH_SQL.format(
        speed_column=PROFILE_SPEED_COLUMN[profile],
        profile_view=PROFILE_VIEW[profile],
    )
    with db_connection.cursor() as cursor:
        cursor.execute(query, [edge_ids, lows, highs, revs])
        rows = cursor.fetchall()
    by_ord = {int(r[0]): r for r in rows}
    out = []
    for index in range(1, len(portions) + 1):
        row = by_ord.get(index)
        if row is None:
            raise ViagoGeometryUnavailable(
                "No profile-compatible geometry for state.")
        try:
            geometry = json.loads(row[1])
            points = geometry["coordinates"]
            distance = float(row[2])
            if geometry["type"] != "LineString" or len(points) < 2:
                raise ValueError("Not a LineString")
            if not math.isfinite(distance) or distance < 0:
                raise ValueError("Invalid length")
            for point in points:
                if len(point) < 2 or not all(
                        math.isfinite(float(v)) for v in point[:2]):
                    raise ValueError("Invalid coordinate")
            line = [[float(v) for v in p[:2]] for p in points]
        except (TypeError, ValueError, KeyError, IndexError,
                json.JSONDecodeError) as exc:
            raise ViagoGeometryUnavailable("Invalid PostGIS geometry.") from exc
        seconds = None
        try:
            speed = None if row[3] is None else float(row[3])
            if speed is not None and speed > 0 and math.isfinite(speed):
                value = distance * 3.6 / speed
                seconds = value if math.isfinite(value) and value >= 0 else None
        except (TypeError, ValueError, OverflowError):
            seconds = None
        out.append((line, distance, seconds))
    return out


def _line_for_state(*, state_id: int, profile: str,
                    start_fraction: float, end_fraction: float,
                    db_connection=connection) -> tuple[list[list[float]], float]:
    """Read the exact directed substring of a road edge from PostGIS."""
    if profile not in PROFILE_VIEW:
        raise ViagoGeometryUnavailable("Unknown routing profile.")
    if not 0 <= start_fraction <= 1 or not 0 <= end_fraction <= 1:
        raise ViagoGeometryUnavailable("Invalid edge fractions.")
    reverse = bool(state_id % 2)
    if reverse != (start_fraction > end_fraction):
        # Zero-length paths can be unambiguously oriented either way.
        if start_fraction != end_fraction:
            raise ViagoGeometryUnavailable("Direction disagrees with state.")
    low, high = sorted((start_fraction, end_fraction))
    query = EDGE_SQL.format(profile_view=PROFILE_VIEW[profile])
    with db_connection.cursor() as cursor:
        cursor.execute(query, [reverse, low, high, low, high,
                               low, high, state_id // 2, reverse])
        row = cursor.fetchone()
    if row is None:
        raise ViagoGeometryUnavailable("No profile-compatible geometry for state.")
    try:
        geometry = json.loads(row[0])
        points = geometry["coordinates"]
        distance = float(row[1])
        if geometry["type"] != "LineString" or len(points) < 2:
            raise ValueError("Not a LineString")
        if not math.isfinite(distance) or distance < 0:
            raise ValueError("Invalid length")
        for point in points:
            if len(point) < 2 or not all(math.isfinite(float(v)) for v in point[:2]):
                raise ValueError("Invalid coordinate")
        return [[float(v) for v in p[:2]] for p in points], distance
    except (TypeError, ValueError, KeyError, IndexError, json.JSONDecodeError) as exc:
        raise ViagoGeometryUnavailable("Invalid PostGIS geometry.") from exc


def _haversine_m(a: list[float], b: list[float]) -> float:
    radius = 6371008.8
    lat1, lat2 = math.radians(a[1]), math.radians(b[1])
    dlat, dlon = lat2 - lat1, math.radians(b[0] - a[0])
    h = math.sin(dlat / 2)**2 + math.cos(lat1)*math.cos(lat2)*math.sin(dlon / 2)**2
    return 2 * radius * math.asin(min(1, math.sqrt(h)))


def _network_states(*, candidate: Mapping, profile: str,
                    db_connection=connection, path_sink=None) -> list[int]:
    start_id = int(candidate["start_state_id"])
    end_id = int(candidate["end_state_id"])
    rows = (path_sink or {}).get((start_id, end_id))
    if rows is None:
        with db_connection.cursor() as cursor:
            cursor.execute(PATH_SQL, [render_edge_sql(profile), start_id, end_id])
            rows = cursor.fetchall()
    if not rows:
        raise ViagoGeometryUnavailable("No network path.")
    nodes = []
    for i, row in enumerate(rows):
        if int(row[0]) != i + 1:
            raise ViagoGeometryUnavailable("Discontinuous path sequence.")
        nodes.append(int(row[1]))
    if nodes[0] != start_id or nodes[-1] != end_id:
        raise ViagoGeometryUnavailable("Path does not match selected states.")
    if int(rows[-1][2]) != -1:
        raise ViagoGeometryUnavailable("Path terminal edge is missing.")
    pg_cost = float(rows[-1][3])
    if not math.isclose(pg_cost, float(candidate["pg_cost"]), rel_tol=1e-7, abs_tol=1e-6):
        raise ViagoGeometryUnavailable("Selected path cost changed.")
    if len(nodes) > 20000:
        raise ViagoGeometryUnavailable("Path exceeds geometry safety limit.")
    return nodes


# Beyond this, a point is not on/near any road usable by the profile.
DEFAULT_MAX_SNAP_DISTANCE_M = 1000.0


_ROUTE_CACHE: dict = {}
_ROUTE_CACHE_TTL_S = 600
_ROUTE_CACHE_MAX = 32


def _route_key(profile, start_longitude, start_latitude, end_longitude, end_latitude):
    return (str(profile), round(float(start_longitude), 6), round(float(start_latitude), 6),
            round(float(end_longitude), 6), round(float(end_latitude), 6))


def _cache_get(key):
    import time
    entry = _ROUTE_CACHE.get(key)
    if entry and time.monotonic() - entry["t"] <= _ROUTE_CACHE_TTL_S:
        return entry
    _ROUTE_CACHE.pop(key, None)
    return None


def _cache_put(key, edges, route_result):
    import time
    if len(_ROUTE_CACHE) >= _ROUTE_CACHE_MAX:
        oldest = min(_ROUTE_CACHE, key=lambda k: _ROUTE_CACHE[k]["t"])
        _ROUTE_CACHE.pop(oldest, None)
    _ROUTE_CACHE[key] = {
        "t": time.monotonic(), "main_edges": list(edges),
        "main_ids": {e for e, _ in edges},
        "main_distance": route_result.get("distance_m"),
        "main_duration": route_result.get("duration_s"),
        "alts": [], "rejected": set(), "attempts": 0,
    }


def make_viago_route(*, start_longitude: float, start_latitude: float,
                     end_longitude: float, end_latitude: float,
                     profile: str, candidate_limit: int = 64,
                     db_connection=connection,
                     max_snap_distance_m: float = DEFAULT_MAX_SNAP_DISTANCE_M,
                     avoid_edge_ids=None, edge_ids_sink: list | None = None,
                     include_surface: bool = False) -> dict:
    """Compose GPS path and derive verified GeoJSON for its selected candidate.

    The existing compose_gps_route arbitration is never bypassed.
    When it cannot select one candidate, no map geometry is emitted.
    """
    if profile not in PROFILE_VIEW:
        raise ValueError("profile must be car, motorcycle, or foot")
    path_sink: dict = {}
    selection = compose_gps_route(
        start_longitude=start_longitude, start_latitude=start_latitude,
        end_longitude=end_longitude, end_latitude=end_latitude,
        profile=profile, candidate_limit=candidate_limit,
        state_od_executor=lambda **kwargs: execute_state_od_matrix(
            **kwargs, connection_obj=db_connection,
            path_sink=path_sink, avoid_edge_ids=avoid_edge_ids,
            avoid_tracks=(str(profile).lower() == "car")),
        snapper=lambda **kwargs: snap_point_to_routing_graph(
            **kwargs, connection_obj=db_connection,
            max_distance_m=max_snap_distance_m),
    )
    status = selection["status"]
    result = {"status": status, "profile": profile,
              "geometry": None, "distance_m": None,
              "total_cost": None, "cost_unit": "graph_weight", "maneuvers": []}
    if status != "ok":
        return result

    selected = selection["selected_candidate"]
    start = selection["start_snap"]
    end = selection["end_snap"]
    if not selected:
        raise ViagoGeometryUnavailable("No unique selected route.")
    kind = selected["kind"]
    segments: list[tuple[list[list[float]], float]] = []
    duration_portions: list[tuple[int, float, float]] = []
    batch_seconds = None
    if kind == "same_edge_zero":
        p = [float(start["snapped_longitude"]), float(start["snapped_latitude"])]
        return {**result, "geometry": {"type": "LineString", "coordinates": [p, p]},
                "distance_m": 0.0, "total_cost": 0.0,
                "duration_s": 0.0,
                "duration_source": "profile_effective_speed", "maneuvers": []}
    if kind == "same_edge_direct":
        state = int(start["edge_id"]) * 2 + (selected["direction"] == "reverse")
        segments.append(_line_for_state(
            state_id=state, profile=profile,
            start_fraction=float(start["fraction"]), end_fraction=float(end["fraction"]),
            db_connection=db_connection))
        duration_portions.append((
            state, float(start["fraction"]), float(end["fraction"])
        ))
    elif kind == "network":
        nodes = _network_states(candidate=selected, profile=profile,
                                db_connection=db_connection,
                                path_sink=path_sink)
        for i, state in enumerate(nodes):
            reverse = bool(state % 2)
            first = i == 0
            last = i == len(nodes) - 1
            begin = float(start["fraction"]) if first else (1.0 if reverse else 0.0)
            finish = float(end["fraction"]) if last else (0.0 if reverse else 1.0)
            duration_portions.append((state, begin, finish))
        batch_rows = _lines_for_portions(
            portions=duration_portions, profile=profile,
            db_connection=db_connection)
        segments.extend((line, length) for line, length, _ in batch_rows)
        batch_seconds = [seconds for _, _, seconds in batch_rows]
    else:
        raise ViagoGeometryUnavailable("Unrecognized selected candidate.")

    coordinates: list[list[float]] = []
    distance_m = 0.0
    for line, length in segments:
        if coordinates and _haversine_m(coordinates[-1], line[0]) > 3.0:
            raise ViagoGeometryUnavailable("Road geometry is not continuous.")
        coordinates.extend(line if not coordinates else line[1:])
        distance_m += length
    if len(coordinates) < 2:
        raise ViagoGeometryUnavailable("Path has insufficient coordinates.")
    path_edges = [(state_id // 2, float(length))
                  for (state_id, _, _), (_, length) in zip(duration_portions, segments)]
    if edge_ids_sink is not None:
        edge_ids_sink.extend(path_edges)
    route_result = {
        **result,
        "geometry": {
            "type": "LineString",
            "coordinates": coordinates,
        },
        "distance_m": round(distance_m, 2),
        "total_cost": float(selected["total_cost"]),
    }

    # Guidance is optional: topology or routing metadata failures must never
    # invalidate a verified path. No guessed turns from bends in a polyline.
    try:
        route_result["maneuvers"] = graph_maneuvers(
            portions=duration_portions, segments=segments,
            total_m=distance_m, db_connection=db_connection)
    except Exception as exc:
        print(
            "VIAGO_GUIDANCE_EXCEPTION =",
            type(exc).__name__,
            str(exc)[:500],
            flush=True,
        )
        route_result["maneuvers"] = []

    # Le calcul du temps ne doit pas invalider une route deja verifiee.
    if batch_seconds is not None:
        portions = batch_seconds
    else:
        try:
            portions = [
                _seconds_for_state(
                    state_id=state_id,
                    profile=profile,
                    start_fraction=begin,
                    end_fraction=finish,
                    db_connection=db_connection,
                )
                for state_id, begin, finish in duration_portions
            ]
        except Exception:
            portions = [None]

    if portions and all(value is not None for value in portions):
        total_seconds = sum(portions)

        if math.isfinite(total_seconds) and total_seconds >= 0:
            route_result["duration_s"] = round(total_seconds, 1)
            route_result["duration_source"] = "profile_effective_speed"

    # Revetement : information facultative (desactivee par defaut cote interface).
    try:
        if not include_surface:
            raise LookupError("surface disabled")
        from .viago_surface import surface_summary
        route_result["surface"] = surface_summary(
            portions=duration_portions,
            lengths=[length for _, length in segments],
            db_connection=db_connection)
    except LookupError:
        pass
    except Exception as exc:
        print("VIAGO_SURFACE_EXCEPTION =", type(exc).__name__,
              str(exc)[:300], flush=True)
        route_result["surface"] = None

    if avoid_edge_ids is None:
        _cache_put(_route_key(profile, start_longitude, start_latitude,
                              end_longitude, end_latitude), path_edges, route_result)
    return route_result


ALT_PENALTY_OVERLAP_MAX = 0.80   # part de longueur commune maximale avec un itineraire deja retenu
ALT_MAX_DISTANCE_RATIO = 1.6
ALT_MAX_DURATION_RATIO = 1.7


def _shared_ratio(edges_a: list, edges_b_ids: set) -> float:
    total = sum(length for _, length in edges_a) or 1.0
    return sum(length for edge, length in edges_a if edge in edges_b_ids) / total


def make_viago_alternatives(*, count: int = 2, db_connection=connection, **kwargs) -> dict:
    """Itineraire principal + jusqu'a `count` alternatives (methode de la penalite).

    Chaque alternative est un VRAI chemin du graphe (memes controles que le
    principal) calcule en majorant le cout des arcs deja empruntes. Rien
    n'est invente : une alternative trop longue ou trop proche est ecartee.
    Le principal et les alternatives deja calcules sont gardes 10 min en memoire :
    une demande suivante ne recalcule que ce qui manque."""
    from django.db import transaction

    key = _route_key(kwargs["profile"], kwargs["start_longitude"], kwargs["start_latitude"],
                     kwargs["end_longitude"], kwargs["end_latitude"])
    entry = _cache_get(key)
    if entry is None:
        main = make_viago_route(**kwargs, db_connection=db_connection)
        entry = _cache_get(key)
        if main.get("status") != "ok" or not main.get("geometry") or entry is None:
            main["alternatives"] = []
            return main
    else:
        main = {"status": "ok", "profile": kwargs["profile"], "main_cached": True}
    alias = getattr(db_connection, "alias", None)
    count = max(0, min(int(count), 2))
    while len(entry["alts"]) < count and entry["attempts"] < 3:
        entry["attempts"] += 1
        avoid = set(entry["main_ids"]) | entry["rejected"]
        for ids, _ in entry["alts"]:
            avoid |= ids
        sink: list = []
        try:
            with transaction.atomic(using=alias):   # savepoint : un echec n'annule rien d'autre
                alt = make_viago_route(**kwargs, db_connection=db_connection,
                                       avoid_edge_ids=sorted(avoid), edge_ids_sink=sink)
        except Exception as exc:
            print("VIAGO_ALT_EXCEPTION =", type(exc).__name__, str(exc)[:300], flush=True)
            entry["attempts"] = 99
            break
        if alt.get("status") != "ok" or not alt.get("geometry") or not sink:
            entry["attempts"] = 99
            break
        ids = {e for e, _ in sink}
        others = [entry["main_ids"]] + [i for i, _ in entry["alts"]]
        too_close = any(_shared_ratio(sink, other) > ALT_PENALTY_OVERLAP_MAX for other in others)
        too_long = (alt.get("distance_m") or 0) > ALT_MAX_DISTANCE_RATIO * (entry["main_distance"] or 1)
        too_slow = bool(entry["main_duration"] and alt.get("duration_s")
                        and alt["duration_s"] > ALT_MAX_DURATION_RATIO * entry["main_duration"])
        if too_close or too_long or too_slow:
            entry["rejected"] |= ids
            continue
        entry["alts"].append((ids, alt))
    main["alternatives"] = [r for _, r in entry["alts"][:count]]
    return main
