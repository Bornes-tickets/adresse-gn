"""VIAGO P4-P4-D1: isolated, fail-closed road candidate discovery.

Not an API endpoint. Not a navigation confirmation engine.
Caller must supply an explicitly controlled, read-only DB connection.
"""

from __future__ import annotations

import math
from typing import Any

PROFILE_VIEWS = {
    "car": "maps_routing_stage.routing_edges_car",
    "motorcycle": "maps_routing_stage.routing_edges_motorcycle",
    "foot": "maps_routing_stage.routing_edges_foot",
}

MAX_CANDIDATES = 32
MIN_RADIUS_M = 5.0
MAX_RADIUS_M = 100.0


class CandidateValidationError(ValueError):
    pass


class CandidateContractError(RuntimeError):
    pass


def _finite(value: Any, name: str, low: float, high: float) -> float:
    if isinstance(value, bool):
        raise CandidateValidationError(f"{name}: invalid value")
    try:
        result = float(value)
    except (TypeError, ValueError) as exc:
        raise CandidateValidationError(f"{name}: invalid value") from exc
    if not math.isfinite(result) or not low <= result <= high:
        raise CandidateValidationError(f"{name}: out of range")
    return result


def candidate_sql(profile: str) -> str:
    if profile not in PROFILE_VIEWS:
        raise CandidateValidationError("Unsupported routing profile")

    view = PROFILE_VIEWS[profile]

    return f"""
        WITH p AS (
            SELECT ST_SetSRID(ST_MakePoint(%s, %s), 4326) AS geom
        ),
        nearby AS (
            SELECT
                e.edge_id::bigint AS edge_id,
                e.source::bigint AS source_node_id,
                e.target::bigint AS target_node_id,
                ST_ClosestPoint(e.geom, p.geom) AS snapped,
                ST_LineLocatePoint(
                    e.geom, ST_ClosestPoint(e.geom, p.geom)
                )::double precision AS fraction,
                ST_Distance(
                    e.geom::geography, p.geom::geography
                )::double precision AS distance_m
            FROM maps_routing_stage.routing_edges AS e
            CROSS JOIN p
            WHERE e.geom IS NOT NULL
              AND ST_DWithin(
                  e.geom::geography, p.geom::geography, %s
              )
            ORDER BY distance_m, edge_id
            LIMIT %s
        )
        SELECT
            n.edge_id,
            n.source_node_id,
            n.target_node_id,
            ST_X(n.snapped)::double precision,
            ST_Y(n.snapped)::double precision,
            n.fraction,
            n.distance_m,
            pv.cost::double precision,
            pv.reverse_cost::double precision
        FROM nearby AS n
        LEFT JOIN {view} AS pv ON pv.id = n.edge_id
        ORDER BY n.distance_m, n.edge_id
    """


def find_road_candidates(
    *,
    longitude: float,
    latitude: float,
    profile: str,
    radius_m: float,
    connection_obj: Any,
    limit: int = 16,
) -> dict[str, Any]:
    """Return road alternatives; never claim a confirmed road."""
    lng = _finite(longitude, "longitude", -180.0, 180.0)
    lat = _finite(latitude, "latitude", -90.0, 90.0)
    radius = _finite(
        radius_m, "radius_m", MIN_RADIUS_M, MAX_RADIUS_M
    )

    if not isinstance(limit, int) or isinstance(limit, bool):
        raise CandidateValidationError("Invalid candidate limit")
    if not 1 <= limit <= MAX_CANDIDATES:
        raise CandidateValidationError("Invalid candidate limit")
    if connection_obj is None:
        raise CandidateValidationError("Explicit connection required")

    sql = candidate_sql(profile)

    with connection_obj.cursor() as cursor:
        cursor.execute(sql, [lng, lat, radius, limit + 1])
        rows = cursor.fetchall()

    if not isinstance(rows, (list, tuple)):
        raise CandidateContractError("Invalid query result")
    if len(rows) > limit + 1:
        raise CandidateContractError("Candidate limit violated")

    truncated = len(rows) > limit
    result = []

    for row in rows[:limit]:
        if len(row) != 9:
            raise CandidateContractError("Invalid candidate row")

        edge, source, target, snap_lng, snap_lat, fraction, dist, fwd, rev = row

        edge = int(edge)
        source = int(source)
        target = int(target)
        snap_lng = _finite(snap_lng, "snap_lng", -180, 180)
        snap_lat = _finite(snap_lat, "snap_lat", -90, 90)
        fraction = _finite(fraction, "fraction", 0, 1)
        dist = _finite(dist, "distance_m", 0, MAX_RADIUS_M)

        if edge < 0 or source < 0 or target < 0:
            raise CandidateContractError("Invalid graph IDs")

        def enabled(value: Any) -> bool:
            if value is None:
                return False
            try:
                number = float(value)
            except (TypeError, ValueError) as exc:
                raise CandidateContractError("Invalid routing cost") from exc
            if not math.isfinite(number):
                raise CandidateContractError("Invalid routing cost")
            return number >= 0

        forward = enabled(fwd)
        reverse = enabled(rev)

        result.append({
            "edge_id": edge,
            "source_node_id": source,
            "target_node_id": target,
            "snapped_longitude": snap_lng,
            "snapped_latitude": snap_lat,
            "fraction": fraction,
            "distance_m": dist,
            "forward_enabled": forward,
            "reverse_enabled": reverse,
            "routable": forward or reverse,
        })

    if len({x["edge_id"] for x in result}) != len(result):
        raise CandidateContractError("Duplicate edge IDs")

    # No temporal evidence here: no result is route-confirmed.
    return {
        "status": "candidate_only" if result else "no_candidates",
        "profile": profile,
        "candidates": result,
        "truncated": truncated,
        "confirmed": False,
    }


def assess_candidate_ambiguity(
    candidates: list[dict[str, Any]],
    accuracy_m: float,
    *,
    truncated: bool = False,
) -> str:
    """Conservative spatial assessment, not vehicle map matching."""
    accuracy = _finite(accuracy_m, "accuracy_m", 0, 100)

    if truncated:
        return "ambiguous"

    eligible = sorted(
        (
            float(item["distance_m"])
            for item in candidates
            if item["routable"]
        )
    )

    if not eligible:
        return "no_candidates"

    if len(eligible) > 1:
        # Competing roads inside GPS uncertainty are not distinguishable
        # from a single observation.
        if eligible[1] - eligible[0] <= max(8.0, accuracy):
            return "ambiguous"

    # Even a single apparent road is not proof of actual travel on it.
    return "unconfirmed"