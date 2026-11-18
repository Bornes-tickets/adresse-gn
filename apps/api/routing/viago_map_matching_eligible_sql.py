"""VIAGO D7-D7-A: experimental profile-eligible candidate SQL.

SQL construction only. It does NOT execute queries.
No navigation confirmation, connection, or API integration.
The actual PostgreSQL view schema is not yet verified.
"""

from __future__ import annotations

from .viago_map_matching_candidates import (
    PROFILE_VIEWS,
    CandidateValidationError,
)


def eligible_metric_candidate_sql(profile: str) -> str:
    """Return four-parameter SQL: lng, lat, radius, limit+1.

    Filter on profile costs BEFORE LIMIT.
    This function intentionally does not activate any navigation.
    """
    if (
        not isinstance(profile, str)
        or profile not in PROFILE_VIEWS
    ):
        raise CandidateValidationError(
            "Unsupported routing profile"
        )

    view = PROFILE_VIEWS[profile]

    return f"""
        WITH p AS (
            SELECT ST_SetSRID(
                ST_MakePoint(%s, %s), 4326
            ) AS geom
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
                )::double precision AS distance_m,
                pv.cost::double precision AS forward_cost,
                pv.reverse_cost::double precision AS reverse_cost
            FROM maps_routing_stage.routing_edges AS e
            JOIN {view} AS pv ON pv.id = e.edge_id
            CROSS JOIN p
            WHERE e.geom IS NOT NULL
              AND ST_SRID(e.geom) = 4326
              AND GeometryType(e.geom) = 'LINESTRING'
              AND ST_IsValid(e.geom)
              AND ST_NPoints(e.geom) >= 2
              AND ST_DWithin(
                  e.geom::geography, p.geom::geography, %s
              )
              AND (
                  pv.cost >= 0
                  OR pv.reverse_cost >= 0
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
            n.forward_cost,
            n.reverse_cost,
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
        ORDER BY n.distance_m, n.edge_id
    """