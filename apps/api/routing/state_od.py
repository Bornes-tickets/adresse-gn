from __future__ import annotations

import math
from collections.abc import Sequence
from typing import Any, Final


ALLOWED_PROFILES: Final[tuple[str, ...]] = (
    "car",
    "motorcycle",
    "foot",
)

EDGE_SQL_TEMPLATE: Final[str] = "SELECT\n    transition_id AS id,\n    source_state_id AS source,\n    target_state_id AS target,\n    cost,\n    -1::double precision AS reverse_cost\nFROM maps_routing_stage.routing_state_transitions\nWHERE profile = '{PROFILE}'"

PGR_CALL_SQL: Final[str] = 'SELECT\n    seq,\n    path_seq,\n    start_vid,\n    end_vid,\n    node,\n    edge,\n    cost,\n    agg_cost\nFROM pgr_dijkstra(\n    %s::text,\n    %s::bigint[],\n    %s::bigint[],\n    directed := true\n)\nORDER BY\n    start_vid,\n    end_vid,\n    path_seq'


class StateODValidationError(ValueError):
    pass


class StateODContractError(RuntimeError):
    pass


def render_edge_sql(
    profile: Any,
) -> str:
    if not isinstance(
        profile,
        str,
    ):
        raise StateODValidationError(
            "profile must be car, motorcycle, or foot."
        )

    normalized = (
        profile
        .strip()
        .lower()
    )

    if normalized not in ALLOWED_PROFILES:
        raise StateODValidationError(
            "profile must be car, motorcycle, or foot."
        )

    return EDGE_SQL_TEMPLATE.replace(
        "{PROFILE}",
        normalized,
    )


def _validate_state_ids(
    value: Any,
    *,
    label: str,
) -> list[int]:
    if (
        isinstance(
            value,
            (
                str,
                bytes,
                bytearray,
            ),
        )
        or
        not isinstance(
            value,
            Sequence,
        )
    ):
        raise StateODValidationError(
            f"{label} must be a sequence of one or two integers."
        )

    items = list(
        value
    )

    if not (
        1
        <=
        len(
            items
        )
        <=
        2
    ):
        raise StateODValidationError(
            f"{label} must contain one or two state IDs."
        )

    normalized = []

    for item in items:
        if (
            isinstance(
                item,
                bool,
            )
            or
            not isinstance(
                item,
                int,
            )
        ):
            raise StateODValidationError(
                f"{label} must contain integers only."
            )

        if item < 0:
            raise StateODValidationError(
                f"{label} cannot contain a negative state ID."
            )

        normalized.append(
            int(
                item
            )
        )

    if len(
        set(
            normalized
        )
    ) != len(
        normalized
    ):
        raise StateODValidationError(
            f"{label} must contain unique state IDs."
        )

    return normalized


def _nonnegative_finite(
    value: Any,
    *,
    label: str,
) -> float:
    try:
        converted = float(
            value
        )
    except (
        TypeError,
        ValueError,
        OverflowError,
    ) as exc:
        raise StateODContractError(
            f"{label} is not numeric."
        ) from exc

    if not math.isfinite(
        converted
    ):
        raise StateODContractError(
            f"{label} must be finite."
        )

    if converted < 0.0:
        raise StateODContractError(
            f"{label} must be nonnegative."
        )

    return converted


def execute_state_od_matrix(
    *,
    profile: Any,
    source_state_ids: Any,
    target_state_ids: Any,
    connection_obj=None,
) -> list[dict[str, Any]]:
    normalized_sources = (
        _validate_state_ids(
            source_state_ids,
            label="source_state_ids",
        )
    )

    normalized_targets = (
        _validate_state_ids(
            target_state_ids,
            label="target_state_ids",
        )
    )

    rendered_edge_sql = (
        render_edge_sql(
            profile
        )
    )

    if connection_obj is None:
        from django.db import connection

        connection_obj = connection

    expected_pairs = [
        (
            source_state_id,
            target_state_id,
        )
        for source_state_id
        in normalized_sources
        for target_state_id
        in normalized_targets
    ]

    expected_pair_set = set(
        expected_pairs
    )

    with connection_obj.cursor() as cursor:
        cursor.execute(
            PGR_CALL_SQL,
            (
                rendered_edge_sql,
                normalized_sources,
                normalized_targets,
            ),
        )

        raw_rows = list(
            cursor.fetchall()
        )

    grouped: dict[
        tuple[int, int],
        list[dict[str, Any]],
    ] = {}

    path_sequences: dict[
        tuple[int, int],
        set[int],
    ] = {}

    for raw_row in raw_rows:
        if len(
            raw_row
        ) != 8:
            raise StateODContractError(
                "pgr_dijkstra row must contain exactly eight columns."
            )

        (
            seq,
            path_seq,
            start_vid,
            end_vid,
            node,
            edge,
            cost,
            agg_cost,
        ) = raw_row

        try:
            seq_int = int(
                seq
            )

            path_seq_int = int(
                path_seq
            )

            start_vid_int = int(
                start_vid
            )

            end_vid_int = int(
                end_vid
            )

            node_int = int(
                node
            )

            edge_int = int(
                edge
            )
        except (
            TypeError,
            ValueError,
            OverflowError,
        ) as exc:
            raise StateODContractError(
                "pgr_dijkstra identity columns must be integers."
            ) from exc

        if seq_int < 0:
            raise StateODContractError(
                "seq cannot be negative."
            )

        if path_seq_int < 0:
            raise StateODContractError(
                "path_seq cannot be negative."
            )

        pair = (
            start_vid_int,
            end_vid_int,
        )

        if pair not in expected_pair_set:
            raise StateODContractError(
                "pgr_dijkstra returned an unexpected state pair."
            )

        cost_float = (
            _nonnegative_finite(
                cost,
                label="cost",
            )
        )

        agg_cost_float = (
            _nonnegative_finite(
                agg_cost,
                label="agg_cost",
            )
        )

        existing_sequences = (
            path_sequences.setdefault(
                pair,
                set(),
            )
        )

        if path_seq_int in existing_sequences:
            raise StateODContractError(
                "duplicate path_seq for one state pair."
            )

        existing_sequences.add(
            path_seq_int
        )

        grouped.setdefault(
            pair,
            [],
        ).append(
            {
                "seq": (
                    seq_int
                ),
                "path_seq": (
                    path_seq_int
                ),
                "start_vid": (
                    start_vid_int
                ),
                "end_vid": (
                    end_vid_int
                ),
                "node": (
                    node_int
                ),
                "edge": (
                    edge_int
                ),
                "cost": (
                    cost_float
                ),
                "agg_cost": (
                    agg_cost_float
                ),
            }
        )

    result = []

    for pair in expected_pairs:
        rows = grouped.get(
            pair
        )

        if not rows:
            result.append(
                {
                    "start_state_id": (
                        pair[0]
                    ),
                    "end_state_id": (
                        pair[1]
                    ),
                    "reachable": False,
                    "total_cost": None,
                }
            )

            continue

        ordered_rows = sorted(
            rows,
            key=lambda item: (
                item[
                    "path_seq"
                ]
            ),
        )

        terminal = (
            ordered_rows[
                -1
            ]
        )

        if terminal[
            "node"
        ] != pair[
            1
        ]:
            raise StateODContractError(
                "terminal pgr_dijkstra row does not end at end_vid."
            )

        result.append(
            {
                "start_state_id": (
                    pair[0]
                ),
                "end_state_id": (
                    pair[1]
                ),
                "reachable": True,
                "total_cost": (
                    terminal[
                        "agg_cost"
                    ]
                ),
            }
        )

    return result
