from __future__ import annotations

import math
from typing import Any

from django.db import connections


ROUTING_DATABASE_ALIAS = "routing"

CAR_TRANSITION_EDGE_SQL = """
SELECT
    transition_id AS id,
    source_state_id AS source,
    target_state_id AS target,
    cost
FROM maps_routing_stage.routing_state_transitions
WHERE profile = 'car'
""".strip()


ROUTE_COST_SQL = """
WITH route_rows AS (
    SELECT *
    FROM pgr_dijkstra(
        %s,
        %s,
        true
    )
)
SELECT
    max(agg_cost)::double precision AS total_cost,
    count(*)::bigint AS result_rows
FROM route_rows
""".strip()


class RoutingBackendNotConfigured(RuntimeError):
    """Raised when the routing database alias is unavailable."""


class RoutingBackendError(RuntimeError):
    """Raised when the routing backend violates the validated contract."""


def _validated_state_id(
    value: int,
    *,
    field_name: str,
) -> int:
    if isinstance(value, bool) or not isinstance(value, int):
        raise ValueError(
            f"{field_name} must be an integer state id."
        )

    if value < 0:
        raise ValueError(
            f"{field_name} must be non-negative."
        )

    return value


def _single_pair_sql(
    start_state_id: int,
    end_state_id: int,
) -> str:
    """
    Build the combinations SQL consumed by the validated
    pgr_dijkstra(text, text, directed boolean) signature.

    Values are strictly validated integers before interpolation.
    """

    return (
        "SELECT "
        f"{start_state_id}::bigint AS source, "
        f"{end_state_id}::bigint AS target"
    )


def route_state_to_state(
    *,
    start_state_id: int,
    end_state_id: int,
    using: str = ROUTING_DATABASE_ALIAS,
) -> dict[str, Any]:
    """
    Compute the validated minimum routing cost between two
    car-routing state ids.

    Block 12 contract:
    - directed graph
    - profile = car
    - start == end is handled by the application
    - no pgRouting row means unreachable
    - only reachability and minimum total cost are frozen here

    Path geometry, snapping and production runtime parameters
    are deliberately outside this service contract.
    """

    start_state_id = _validated_state_id(
        start_state_id,
        field_name="start_state_id",
    )

    end_state_id = _validated_state_id(
        end_state_id,
        field_name="end_state_id",
    )

    # Block 12 V5/V6 contract:
    # pgRouting returns no raw row for start=end.
    # The application must short-circuit it.
    if start_state_id == end_state_id:
        return {
            "reachable": True,
            "total_cost": 0.0,
            "start_state_id": start_state_id,
            "end_state_id": end_state_id,
        }

    if using not in connections.databases:
        raise RoutingBackendNotConfigured(
            f"Routing database alias {using!r} is not configured."
        )

    combinations_sql = _single_pair_sql(
        start_state_id,
        end_state_id,
    )

    with connections[using].cursor() as cursor:
        cursor.execute(
            ROUTE_COST_SQL,
            [
                CAR_TRANSITION_EDGE_SQL,
                combinations_sql,
            ],
        )

        row = cursor.fetchone()

    if row is None or len(row) != 2:
        raise RoutingBackendError(
            "Routing backend returned an invalid aggregate result."
        )

    raw_total_cost, raw_result_rows = row

    try:
        result_rows = int(raw_result_rows)
    except (TypeError, ValueError) as exc:
        raise RoutingBackendError(
            "Routing backend returned an invalid result row count."
        ) from exc

    if result_rows < 0:
        raise RoutingBackendError(
            "Routing backend returned a negative result row count."
        )

    if result_rows == 0:
        if raw_total_cost is not None:
            raise RoutingBackendError(
                "Unreachable route returned a non-null total cost."
            )

        return {
            "reachable": False,
            "total_cost": None,
            "start_state_id": start_state_id,
            "end_state_id": end_state_id,
        }

    if raw_total_cost is None:
        raise RoutingBackendError(
            "Reachable route returned a null total cost."
        )

    try:
        total_cost = float(raw_total_cost)
    except (TypeError, ValueError) as exc:
        raise RoutingBackendError(
            "Routing backend returned a non-numeric total cost."
        ) from exc

    if not math.isfinite(total_cost):
        raise RoutingBackendError(
            "Routing backend returned a non-finite total cost."
        )

    if total_cost < 0.0:
        raise RoutingBackendError(
            "Routing backend returned a negative total cost."
        )

    return {
        "reachable": True,
        "total_cost": total_cost,
        "start_state_id": start_state_id,
        "end_state_id": end_state_id,
    }