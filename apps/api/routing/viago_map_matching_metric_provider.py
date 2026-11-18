"""VIAGO D7-D3: read-only metric candidate SQL/provider.

Does not create a connection, endpoint, or navigation decision.
The caller must provide an approved read-only connection.
SQL is not yet verified against a real PostGIS database.
"""

from __future__ import annotations

import math

from .viago_map_matching_candidates import (
    PROFILE_VIEWS,
    CandidateValidationError,
    CandidateContractError,
    _finite,
)


def metric_candidate_sql(profile: str) -> str:
    if not isinstance(profile, str) or profile not in PROFILE_VIEWS:
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
                e.geom AS edge_geom,
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
              AND ST_SRID(e.geom) = 4326
              AND GeometryType(e.geom) = 'LINESTRING'
              AND ST_IsValid(e.geom)
              AND ST_NPoints(e.geom) >= 2
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
            pv.reverse_cost::double precision,
            ST_Length(n.edge_geom::geography)::double precision
                AS edge_length_m,
            CASE
                WHEN n.fraction <= 0 THEN 0.0
                WHEN n.fraction >= 1
                    THEN ST_Length(n.edge_geom::geography)
                ELSE ST_Length(
                    ST_LineSubstring(
                        n.edge_geom, 0.0, n.fraction
                    )::geography
                )
            END::double precision AS distance_to_source_m,
            CASE
                WHEN n.fraction >= 1 THEN 0.0
                WHEN n.fraction <= 0
                    THEN ST_Length(n.edge_geom::geography)
                ELSE ST_Length(
                    ST_LineSubstring(
                        n.edge_geom, n.fraction, 1.0
                    )::geography
                )
            END::double precision AS distance_to_target_m
        FROM nearby AS n
        LEFT JOIN {view} AS pv ON pv.id = n.edge_id
        ORDER BY n.distance_m, n.edge_id
    """


def find_metric_road_candidates(
    *,
    longitude,
    latitude,
    profile,
    radius_m,
    connection_obj,
    limit=16,
):
    """Return metric candidates; never claim GPS confirmation."""

    lng = _finite(longitude, "longitude", -180, 180)
    lat = _finite(latitude, "latitude", -90, 90)
    radius = _finite(radius_m, "radius_m", 5, 100)

    if type(limit) is not int or not 1 <= limit <= 32:
        raise CandidateValidationError("Invalid candidate limit")

    if connection_obj is None:
        raise CandidateValidationError("Explicit connection required")

    from .viago_map_matching_eligible_sql import eligible_metric_candidate_sql
    sql = eligible_metric_candidate_sql(profile)

    with connection_obj.cursor() as cursor:
        cursor.execute(sql, [lng, lat, radius, limit + 1])
        rows = cursor.fetchall()

    if not isinstance(rows, (list, tuple)):
        raise CandidateContractError("Invalid query rows")

    if len(rows) > limit + 1:
        raise CandidateContractError("Too many query rows")

    truncated = len(rows) > limit
    candidates = []
    seen = set()

    def metric(value, name, maximum=1e10):
        if isinstance(value, bool):
            raise CandidateContractError(f"Invalid {name}")
        try:
            v = float(value)
        except (TypeError, ValueError, OverflowError) as exc:
            raise CandidateContractError(f"Invalid {name}") from exc
        if not math.isfinite(v) or not 0 <= v <= maximum:
            raise CandidateContractError(f"Invalid {name}")
        return v

    def direction(value):
        if value is None:
            return False
        if isinstance(value, bool):
            raise CandidateContractError("Invalid direction cost")
        try:
            v = float(value)
        except (TypeError, ValueError, OverflowError) as exc:
            raise CandidateContractError("Invalid direction cost") from exc
        if not math.isfinite(v):
            raise CandidateContractError("Invalid direction cost")
        return v >= 0

    for row in rows[:limit]:
        if not isinstance(row, (tuple, list)) or len(row) != 12:
            raise CandidateContractError("Invalid row shape")

        (
            edge, source, target, snap_lng, snap_lat,
            fraction, distance, forward_cost, reverse_cost,
            length, to_source, to_target,
        ) = row

        for value in (edge, source, target):
            if type(value) is not int or value < 0:
                raise CandidateContractError("Invalid graph ID")

        if edge in seen:
            raise CandidateContractError("Duplicate edge")
        seen.add(edge)

        try:
            slng = _finite(snap_lng, "snapped_longitude", -180, 180)
            slat = _finite(snap_lat, "snapped_latitude", -90, 90)
            frac = _finite(fraction, "fraction", 0, 1)
        except CandidateValidationError as exc:
            raise CandidateContractError("Invalid projection") from exc

        dist = metric(distance, "distance_m", 100)
        if dist > radius + 0.01:
            raise CandidateContractError("Distance exceeds search radius")

        length = metric(length, "edge_length_m")
        to_source = metric(to_source, "distance_to_source_m")
        to_target = metric(to_target, "distance_to_target_m")

        if length <= 0:
            raise CandidateContractError("Nonpositive edge length")

        if (
            to_source > length + 0.5
            or to_target > length + 0.5
            or abs((to_source + to_target) - length)
            > max(0.5, 0.005 * length)
        ):
            raise CandidateContractError("Inconsistent metrics")

        forward = direction(forward_cost)
        reverse = direction(reverse_cost)

        candidates.append({
            "edge_id": edge,
            "source_node_id": source,
            "target_node_id": target,
            "snapped_longitude": slng,
            "snapped_latitude": slat,
            "fraction": frac,
            "distance_m": dist,
            "forward_enabled": forward,
            "reverse_enabled": reverse,
            "routable": forward or reverse,
            "edge_length_m": length,
            "distance_to_source_m": to_source,
            "distance_to_target_m": to_target,
        })

    return {
        "status": "candidate_only" if candidates else "no_candidates",
        "profile": profile,
        "candidates": candidates,
        "truncated": truncated,
        "confirmed": False,
        "navigation_authorized": False,
    }