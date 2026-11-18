"""VIAGO D7-D1: exact road-edge metric evidence.

Pure functions. SQL is generated but NEVER executed here.
No navigation confirmation or production integration.
"""

from __future__ import annotations

import math
from collections.abc import Mapping

from .viago_map_matching_topology import assess_edge_transition


def metric_projection_sql() -> str:
    """SQL expressions for a LineString edge and its projection.

    Input aliases: e.geom (EPSG:4326), p.geom (EPSG:4326).
    The containing query must validate geometry type and SRID.
    """
    return """
        CROSS JOIN LATERAL (
            SELECT ST_LineLocatePoint(
                e.geom,
                ST_ClosestPoint(e.geom, p.geom)
            )::double precision AS fraction
        ) AS loc
        CROSS JOIN LATERAL (
            SELECT
                ST_Length(e.geom::geography)::double precision
                    AS edge_length_m,
                CASE
                    WHEN loc.fraction <= 0 THEN 0.0
                    WHEN loc.fraction >= 1
                        THEN ST_Length(e.geom::geography)
                    ELSE ST_Length(
                        ST_LineSubstring(
                            e.geom, 0.0, loc.fraction
                        )::geography
                    )
                END::double precision AS distance_to_source_m,
                CASE
                    WHEN loc.fraction >= 1 THEN 0.0
                    WHEN loc.fraction <= 0
                        THEN ST_Length(e.geom::geography)
                    ELSE ST_Length(
                        ST_LineSubstring(
                            e.geom, loc.fraction, 1.0
                        )::geography
                    )
                END::double precision AS distance_to_target_m
        ) AS metric
    """


def _number(candidate, field):
    value = candidate[field]

    if isinstance(value, bool):
        raise ValueError("Invalid metric")

    number = float(value)

    if not math.isfinite(number) or number < 0:
        raise ValueError("Invalid metric")

    return number


def assess_exact_metric_transition(
    previous: Mapping,
    current: Mapping,
    *,
    tolerance_m: float = 15.0,
) -> dict:
    """Compare measured endpoint distances on adjacent graph edges.

    Same-edge transitions are deliberately not evaluated here.
    Always advisory, never navigation-authorizing.
    """

    def output(status):
        return {
            "status": status,
            "confirmed": False,
            "navigation_authorized": False,
        }

    try:
        tolerance = float(tolerance_m)

        if (
            isinstance(tolerance_m, bool)
            or not math.isfinite(tolerance)
            or not 0 < tolerance <= 50
        ):
            return output("invalid")

        topology = assess_edge_transition(previous, current)

        if topology["status"] != "topology_plausible":
            return output(topology["status"])

        if previous["edge_id"] == current["edge_id"]:
            return output("metric_unverified")

        required = (
            "distance_to_source_m",
            "distance_to_target_m",
            "edge_length_m",
        )

        if not all(
            name in item
            for item in (previous, current)
            for name in required
        ):
            return output("metric_unverified")

        for item in (previous, current):
            length = _number(item, "edge_length_m")
            source = _number(item, "distance_to_source_m")
            target = _number(item, "distance_to_target_m")

            if length <= 0:
                return output("invalid")

            # Allow small numeric differences from geography operations.
            if source > length + 0.5 or target > length + 0.5:
                return output("invalid")

            if abs((source + target) - length) > max(
                0.5, 0.005 * length
            ):
                return output("invalid")

        for directions in topology["directions"]:
            old_direction, new_direction = directions.split("->")

            distance_out = _number(
                previous,
                "distance_to_target_m"
                if old_direction == "forward"
                else "distance_to_source_m",
            )

            distance_in = _number(
                current,
                "distance_to_source_m"
                if new_direction == "forward"
                else "distance_to_target_m",
            )

            if distance_out <= tolerance and distance_in <= tolerance:
                return output("metric_plausible")

        return output("metric_disconnected")

    except (
        KeyError,
        TypeError,
        ValueError,
        OverflowError,
        AttributeError,
    ):
        return output("invalid")