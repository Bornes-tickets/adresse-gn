from __future__ import annotations

import math
from typing import Final

from django.db import connection


SUPPORTED_PROFILES: Final[tuple[str, ...]] = (
    "car",
    "motorcycle",
    "foot",
)

PROFILE_VIEWS: Final[dict[str, str]] = {
    "car": "maps_routing_stage.routing_edges_car",
    "motorcycle": "maps_routing_stage.routing_edges_motorcycle",
    "foot": "maps_routing_stage.routing_edges_foot",
}

RADIUS_STATUS: Final[str] = "UNQUALIFIED_NO_PRODUCTION_RADIUS"


class SnapValidationError(ValueError):
    pass


class SnapNotFoundError(RuntimeError):
    pass


class SnapContractError(RuntimeError):
    pass


def _finite_coordinate(
    value,
    *,
    name: str,
    minimum: float,
    maximum: float,
) -> float:
    if isinstance(value, bool):
        raise SnapValidationError(
            f"{name} must be a finite number."
        )

    try:
        result = float(value)
    except (TypeError, ValueError) as exc:
        raise SnapValidationError(
            f"{name} must be a finite number."
        ) from exc

    if not math.isfinite(result):
        raise SnapValidationError(
            f"{name} must be finite."
        )

    if not minimum <= result <= maximum:
        raise SnapValidationError(
            f"{name} must be between {minimum} and {maximum}."
        )

    return result


def _validated_profile(profile) -> str:
    if not isinstance(profile, str):
        raise SnapValidationError(
            "profile must be car, motorcycle, or foot."
        )

    result = profile.strip().lower()

    if result not in PROFILE_VIEWS:
        raise SnapValidationError(
            "profile must be car, motorcycle, or foot."
        )

    return result


def _validated_candidate_limit(candidate_limit) -> int:
    if isinstance(candidate_limit, bool):
        raise SnapValidationError(
            "candidate_limit must be a positive integer."
        )

    if not isinstance(candidate_limit, int):
        raise SnapValidationError(
            "candidate_limit must be a positive integer."
        )

    if candidate_limit <= 0:
        raise SnapValidationError(
            "candidate_limit must be a positive integer."
        )

    return candidate_limit


def _snap_sql(profile_view: str) -> str:
    return f"""
        WITH
        p AS (
            SELECT
                ST_SetSRID(
                    ST_MakePoint(%s, %s),
                    4326
                ) AS g
        ),

        knn AS (
            SELECT
                e.edge_id::bigint AS edge_id,
                (e.geom <-> p.g)::double precision AS planar_distance

            FROM maps_routing_stage.routing_edges AS e
            CROSS JOIN p

            WHERE e.geom IS NOT NULL

            ORDER BY
                e.geom <-> p.g

            LIMIT %s
        ),

        kth AS (
            SELECT
                max(planar_distance)::double precision AS threshold

            FROM knn
        ),

        expanded AS (
            SELECT
                e.edge_id::bigint AS edge_id,
                e.source::bigint AS source_node_id,
                e.target::bigint AS target_node_id,

                ST_ClosestPoint(
                    e.geom,
                    p.g
                ) AS snapped_point,

                ST_LineLocatePoint(
                    e.geom,
                    ST_ClosestPoint(
                        e.geom,
                        p.g
                    )
                )::double precision AS fraction,

                ST_Distance(
                    e.geom::geography,
                    p.g::geography
                )::double precision AS distance_m,

                count(*) OVER ()::bigint AS expanded_candidate_count

            FROM maps_routing_stage.routing_edges AS e
            CROSS JOIN p
            CROSS JOIN kth

            WHERE
                e.geom IS NOT NULL
                AND kth.threshold IS NOT NULL
                AND ST_DWithin(
                    e.geom,
                    p.g,
                    kth.threshold
                )
        ),

        chosen AS (
            SELECT
                edge_id,
                source_node_id,
                target_node_id,
                snapped_point,
                fraction,
                distance_m,
                expanded_candidate_count

            FROM expanded

            ORDER BY
                distance_m,
                edge_id

            LIMIT 1
        )

        SELECT
            c.edge_id,
            c.source_node_id,
            c.target_node_id,

            ST_X(c.snapped_point)::double precision
                AS snapped_longitude,

            ST_Y(c.snapped_point)::double precision
                AS snapped_latitude,

            c.fraction,
            c.distance_m,
            c.expanded_candidate_count,

            pv.cost::double precision
                AS forward_cost,

            pv.reverse_cost::double precision
                AS reverse_cost

        FROM chosen AS c

        LEFT JOIN {profile_view} AS pv
          ON pv.id = c.edge_id
    """


def snap_point_to_routing_graph(
    *,
    longitude,
    latitude,
    profile,
    candidate_limit,
) -> dict:
    validated_longitude = _finite_coordinate(
        longitude,
        name="longitude",
        minimum=-180.0,
        maximum=180.0,
    )

    validated_latitude = _finite_coordinate(
        latitude,
        name="latitude",
        minimum=-90.0,
        maximum=90.0,
    )

    validated_profile = _validated_profile(
        profile
    )

    validated_candidate_limit = _validated_candidate_limit(
        candidate_limit
    )

    profile_view = PROFILE_VIEWS[
        validated_profile
    ]

    sql = _snap_sql(
        profile_view
    )

    with connection.cursor() as cursor:
        cursor.execute(
            sql,
            [
                validated_longitude,
                validated_latitude,
                validated_candidate_limit,
            ],
        )

        row = cursor.fetchone()

    if row is None:
        raise SnapNotFoundError(
            "The physical routing graph contains no snap candidate."
        )

    (
        edge_id,
        source_node_id,
        target_node_id,
        snapped_longitude,
        snapped_latitude,
        fraction,
        distance_m,
        expanded_candidate_count,
        forward_cost,
        reverse_cost,
    ) = row

    edge_id = int(edge_id)
    source_node_id = int(source_node_id)
    target_node_id = int(target_node_id)

    snapped_longitude = float(
        snapped_longitude
    )

    snapped_latitude = float(
        snapped_latitude
    )

    fraction = float(
        fraction
    )

    distance_m = float(
        distance_m
    )

    expanded_candidate_count = int(
        expanded_candidate_count
    )

    if not 0.0 <= fraction <= 1.0:
        raise SnapContractError(
            "Routing-edge snap fraction is outside [0, 1]."
        )

    if not math.isfinite(distance_m):
        raise SnapContractError(
            "Routing-edge geography distance is invalid."
        )

    if distance_m < 0.0:
        raise SnapContractError(
            "Routing-edge geography distance is invalid."
        )

    if expanded_candidate_count < validated_candidate_limit:
        raise SnapContractError(
            "Tie-aware boundary expansion returned fewer "
            "candidates than requested."
        )

    forward_cost_value = (
        None
        if forward_cost is None
        else float(forward_cost)
    )

    reverse_cost_value = (
        None
        if reverse_cost is None
        else float(reverse_cost)
    )

    forward_enabled = (
        forward_cost_value is not None
        and
        forward_cost_value >= 0.0
    )

    reverse_enabled = (
        reverse_cost_value is not None
        and
        reverse_cost_value >= 0.0
    )

    forward_state_id = (
        edge_id * 2
        if forward_enabled
        else None
    )

    reverse_state_id = (
        edge_id * 2 + 1
        if reverse_enabled
        else None
    )

    if forward_enabled or reverse_enabled:
        status = "ok"
    else:
        status = "no_routable_direction"

    return {
        "status": status,
        "profile": validated_profile,
        "input_longitude": validated_longitude,
        "input_latitude": validated_latitude,
        "edge_id": edge_id,
        "source_node_id": source_node_id,
        "target_node_id": target_node_id,
        "snapped_longitude": snapped_longitude,
        "snapped_latitude": snapped_latitude,
        "fraction": fraction,
        "distance_m": distance_m,
        "candidate_limit": validated_candidate_limit,
        "expanded_candidate_count": expanded_candidate_count,
        "forward_enabled": forward_enabled,
        "reverse_enabled": reverse_enabled,
        "forward_state_id": forward_state_id,
        "reverse_state_id": reverse_state_id,
        "forward_cost": forward_cost_value,
        "reverse_cost": reverse_cost_value,
        "radius_status": RADIUS_STATUS,
    }