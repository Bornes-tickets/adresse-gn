from __future__ import annotations

import math
from collections.abc import Callable, Iterable, Mapping
from decimal import Decimal, InvalidOperation
from typing import Any, Final

from .snap import snap_point_to_routing_graph


SUPPORTED_PROFILES: Final[tuple[str, ...]] = (
    "car",
    "motorcycle",
    "foot",
)

ARBITRATION_TIE_STATUS: Final[str] = (
    "tie_requires_policy"
)

_DECIMAL_ZERO: Final[Decimal] = Decimal("0")
_DECIMAL_ONE: Final[Decimal] = Decimal("1")


class GPSRouteValidationError(ValueError):
    pass


class GPSRouteContractError(RuntimeError):
    pass


def _decimal_number(
    value: Any,
    *,
    label: str,
) -> Decimal:
    try:
        result = Decimal(
            str(
                value
            )
        )
    except (
        InvalidOperation,
        TypeError,
        ValueError,
    ) as exc:
        raise GPSRouteContractError(
            f"{label} is not a valid decimal number."
        ) from exc

    if not result.is_finite():
        raise GPSRouteContractError(
            f"{label} must be finite."
        )

    return result


def _validate_profile(
    profile: Any,
) -> str:
    if not isinstance(
        profile,
        str,
    ):
        raise GPSRouteValidationError(
            "profile must be car, motorcycle, or foot."
        )

    normalized = (
        profile
        .strip()
        .lower()
    )

    if normalized not in SUPPORTED_PROFILES:
        raise GPSRouteValidationError(
            "profile must be car, motorcycle, or foot."
        )

    return normalized


def _validate_candidate_limit(
    candidate_limit: Any,
) -> int:
    if (
        isinstance(
            candidate_limit,
            bool,
        )
        or
        not isinstance(
            candidate_limit,
            int,
        )
        or
        candidate_limit <= 0
    ):
        raise GPSRouteValidationError(
            "candidate_limit must be a positive integer."
        )

    return candidate_limit


def _snap_direction_options(
    snap: Mapping[str, Any],
    *,
    role: str,
) -> list[dict[str, Any]]:
    if role not in {
        "start",
        "end",
    }:
        raise GPSRouteContractError(
            "invalid endpoint role."
        )

    fraction_decimal = (
        _decimal_number(
            snap[
                "fraction"
            ],
            label=(
                "snap fraction"
            ),
        )
    )

    if not (
        _DECIMAL_ZERO
        <=
        fraction_decimal
        <=
        _DECIMAL_ONE
    ):
        raise GPSRouteContractError(
            "snap fraction is outside [0, 1]."
        )

    options = []

    if bool(
        snap[
            "forward_enabled"
        ]
    ):
        state_id = snap[
            "forward_state_id"
        ]

        cost = snap[
            "forward_cost"
        ]

        if (
            state_id is None
            or
            cost is None
        ):
            raise GPSRouteContractError(
                "forward direction is enabled without state/cost."
            )

        full_cost_decimal = (
            _decimal_number(
                cost,
                label=(
                    "forward full cost"
                ),
            )
        )

        if (
            full_cost_decimal
            <
            _DECIMAL_ZERO
        ):
            raise GPSRouteContractError(
                "forward full cost is negative."
            )

        adjustment_decimal = (
            (
                _DECIMAL_ONE
                -
                fraction_decimal
            )
            *
            full_cost_decimal
        )

        options.append(
            {
                "direction": (
                    "forward"
                ),
                "state_id": int(
                    state_id
                ),
                "full_cost": float(
                    full_cost_decimal
                ),
                "_full_cost_decimal": (
                    full_cost_decimal
                ),
                "adjustment": float(
                    adjustment_decimal
                ),
                "_adjustment_decimal": (
                    adjustment_decimal
                ),
            }
        )

    if bool(
        snap[
            "reverse_enabled"
        ]
    ):
        state_id = snap[
            "reverse_state_id"
        ]

        cost = snap[
            "reverse_cost"
        ]

        if (
            state_id is None
            or
            cost is None
        ):
            raise GPSRouteContractError(
                "reverse direction is enabled without state/cost."
            )

        full_cost_decimal = (
            _decimal_number(
                cost,
                label=(
                    "reverse full cost"
                ),
            )
        )

        if (
            full_cost_decimal
            <
            _DECIMAL_ZERO
        ):
            raise GPSRouteContractError(
                "reverse full cost is negative."
            )

        adjustment_decimal = (
            fraction_decimal
            *
            full_cost_decimal
        )

        options.append(
            {
                "direction": (
                    "reverse"
                ),
                "state_id": int(
                    state_id
                ),
                "full_cost": float(
                    full_cost_decimal
                ),
                "_full_cost_decimal": (
                    full_cost_decimal
                ),
                "adjustment": float(
                    adjustment_decimal
                ),
                "_adjustment_decimal": (
                    adjustment_decimal
                ),
            }
        )

    return options


def _validate_snap_profile(
    snap: Mapping[str, Any],
    *,
    expected_profile: str,
    label: str,
) -> None:
    actual = str(
        snap.get(
            "profile",
            "",
        )
    )

    if actual != expected_profile:
        raise GPSRouteContractError(
            f"{label} snap profile mismatch."
        )


def _normalize_matrix_rows(
    *,
    rows: Iterable[
        Mapping[str, Any]
    ],
    source_state_ids: list[int],
    target_state_ids: list[int],
) -> dict[
    tuple[int, int],
    dict[str, Any],
]:
    expected_pairs = {
        (
            source_state,
            target_state,
        )
        for source_state
        in source_state_ids
        for target_state
        in target_state_ids
    }

    normalized = {}

    for raw in rows:
        pair = (
            int(
                raw[
                    "start_state_id"
                ]
            ),
            int(
                raw[
                    "end_state_id"
                ]
            ),
        )

        if pair not in expected_pairs:
            raise GPSRouteContractError(
                "route matrix returned an unexpected state pair."
            )

        if pair in normalized:
            raise GPSRouteContractError(
                "route matrix returned a duplicate state pair."
            )

        reachable = bool(
            raw[
                "reachable"
            ]
        )

        total_cost = raw.get(
            "total_cost"
        )

        if reachable:
            if total_cost is None:
                raise GPSRouteContractError(
                    "reachable matrix row has no total_cost."
                )

            total_cost_decimal = (
                _decimal_number(
                    total_cost,
                    label=(
                        "route matrix total cost"
                    ),
                )
            )

            if (
                total_cost_decimal
                <
                _DECIMAL_ZERO
            ):
                raise GPSRouteContractError(
                    "reachable matrix cost is negative."
                )

            total_cost_float = float(
                total_cost_decimal
            )

            if not math.isfinite(
                total_cost_float
            ):
                raise GPSRouteContractError(
                    "reachable matrix cost is invalid."
                )
        else:
            if total_cost is not None:
                raise GPSRouteContractError(
                    "unreachable matrix row must have total_cost=None."
                )

            total_cost_decimal = None
            total_cost_float = None

        normalized[
            pair
        ] = {
            "start_state_id": (
                pair[0]
            ),
            "end_state_id": (
                pair[1]
            ),
            "reachable": (
                reachable
            ),
            "total_cost": (
                total_cost_float
            ),
            "_total_cost_decimal": (
                total_cost_decimal
            ),
        }

    missing = (
        expected_pairs
        -
        set(
            normalized
        )
    )

    if missing:
        raise GPSRouteContractError(
            "route matrix omitted one or more expected state pairs."
        )

    return normalized


def _same_edge_direct_candidates(
    *,
    start_snap: Mapping[str, Any],
    end_snap: Mapping[str, Any],
) -> list[dict[str, Any]]:
    if int(
        start_snap[
            "edge_id"
        ]
    ) != int(
        end_snap[
            "edge_id"
        ]
    ):
        return []

    start_fraction = (
        _decimal_number(
            start_snap[
                "fraction"
            ],
            label=(
                "start fraction"
            ),
        )
    )

    end_fraction = (
        _decimal_number(
            end_snap[
                "fraction"
            ],
            label=(
                "end fraction"
            ),
        )
    )

    candidates = []

    if (
        start_fraction
        <=
        end_fraction
        and
        bool(
            start_snap[
                "forward_enabled"
            ]
        )
        and
        bool(
            end_snap[
                "forward_enabled"
            ]
        )
    ):
        start_cost = (
            _decimal_number(
                start_snap[
                    "forward_cost"
                ],
                label=(
                    "same-edge start forward cost"
                ),
            )
        )

        end_cost = (
            _decimal_number(
                end_snap[
                    "forward_cost"
                ],
                label=(
                    "same-edge end forward cost"
                ),
            )
        )

        if start_cost != end_cost:
            raise GPSRouteContractError(
                "same-edge forward full costs differ."
            )

        total_decimal = (
            (
                end_fraction
                -
                start_fraction
            )
            *
            start_cost
        )

        candidates.append(
            {
                "kind": (
                    "same_edge_direct"
                ),
                "direction": (
                    "forward"
                ),
                "total_cost": float(
                    total_decimal
                ),
                "_arbitration_cost": (
                    total_decimal
                ),
            }
        )

    if (
        start_fraction
        >=
        end_fraction
        and
        bool(
            start_snap[
                "reverse_enabled"
            ]
        )
        and
        bool(
            end_snap[
                "reverse_enabled"
            ]
        )
    ):
        start_cost = (
            _decimal_number(
                start_snap[
                    "reverse_cost"
                ],
                label=(
                    "same-edge start reverse cost"
                ),
            )
        )

        end_cost = (
            _decimal_number(
                end_snap[
                    "reverse_cost"
                ],
                label=(
                    "same-edge end reverse cost"
                ),
            )
        )

        if start_cost != end_cost:
            raise GPSRouteContractError(
                "same-edge reverse full costs differ."
            )

        total_decimal = (
            (
                start_fraction
                -
                end_fraction
            )
            *
            start_cost
        )

        candidates.append(
            {
                "kind": (
                    "same_edge_direct"
                ),
                "direction": (
                    "reverse"
                ),
                "total_cost": float(
                    total_decimal
                ),
                "_arbitration_cost": (
                    total_decimal
                ),
            }
        )

    return candidates


def _public_candidate(
    candidate: Mapping[str, Any],
) -> dict[str, Any]:
    return {
        key: value
        for key, value
        in candidate.items()
        if not key.startswith(
            "_"
        )
    }


def _public_candidates(
    candidates: Iterable[
        Mapping[str, Any]
    ],
) -> list[dict[str, Any]]:
    return [
        _public_candidate(
            candidate
        )
        for candidate
        in candidates
    ]


def compose_gps_route(
    *,
    start_longitude,
    start_latitude,
    end_longitude,
    end_latitude,
    profile,
    candidate_limit,
    state_od_executor: Callable[
        ...,
        Iterable[
            Mapping[str, Any]
        ],
    ],
    snapper: Callable[
        ...,
        Mapping[str, Any],
    ] = snap_point_to_routing_graph,
) -> dict[str, Any]:
    normalized_profile = (
        _validate_profile(
            profile
        )
    )

    validated_candidate_limit = (
        _validate_candidate_limit(
            candidate_limit
        )
    )

    if not callable(
        state_od_executor
    ):
        raise GPSRouteValidationError(
            "state_od_executor must be callable."
        )

    if not callable(
        snapper
    ):
        raise GPSRouteValidationError(
            "snapper must be callable."
        )

    start_snap = snapper(
        longitude=(
            start_longitude
        ),
        latitude=(
            start_latitude
        ),
        profile=(
            normalized_profile
        ),
        candidate_limit=(
            validated_candidate_limit
        ),
    )

    end_snap = snapper(
        longitude=(
            end_longitude
        ),
        latitude=(
            end_latitude
        ),
        profile=(
            normalized_profile
        ),
        candidate_limit=(
            validated_candidate_limit
        ),
    )

    _validate_snap_profile(
        start_snap,
        expected_profile=(
            normalized_profile
        ),
        label="start",
    )

    _validate_snap_profile(
        end_snap,
        expected_profile=(
            normalized_profile
        ),
        label="end",
    )

    common = {
        "profile": (
            normalized_profile
        ),
        "candidate_limit": (
            validated_candidate_limit
        ),
        "start_snap": dict(
            start_snap
        ),
        "end_snap": dict(
            end_snap
        ),
    }

    if str(
        start_snap.get(
            "status"
        )
    ) != "ok":
        return {
            **common,
            "status": (
                "no_routable_start"
            ),
            "matrix_executor_calls": 0,
            "candidates": [],
            "selected_candidate": None,
        }

    if str(
        end_snap.get(
            "status"
        )
    ) != "ok":
        return {
            **common,
            "status": (
                "no_routable_end"
            ),
            "matrix_executor_calls": 0,
            "candidates": [],
            "selected_candidate": None,
        }

    start_options = (
        _snap_direction_options(
            start_snap,
            role="start",
        )
    )

    end_options = (
        _snap_direction_options(
            end_snap,
            role="end",
        )
    )

    if not start_options:
        raise GPSRouteContractError(
            "start snap status is ok but has no enabled direction."
        )

    if not end_options:
        raise GPSRouteContractError(
            "end snap status is ok but has no enabled direction."
        )

    start_fraction_decimal = (
        _decimal_number(
            start_snap[
                "fraction"
            ],
            label=(
                "start fraction"
            ),
        )
    )

    end_fraction_decimal = (
        _decimal_number(
            end_snap[
                "fraction"
            ],
            label=(
                "end fraction"
            ),
        )
    )

    if (
        int(
            start_snap[
                "edge_id"
            ]
        )
        ==
        int(
            end_snap[
                "edge_id"
            ]
        )
        and
        start_fraction_decimal
        ==
        end_fraction_decimal
    ):
        zero_candidate = {
            "kind": (
                "same_edge_zero"
            ),
            "direction": None,
            "total_cost": 0.0,
        }

        return {
            **common,
            "status": (
                "ok"
            ),
            "matrix_executor_calls": 0,
            "candidates": [
                zero_candidate
            ],
            "selected_candidate": (
                zero_candidate
            ),
        }

    source_state_ids = [
        int(
            item[
                "state_id"
            ]
        )
        for item
        in start_options
    ]

    target_state_ids = [
        int(
            item[
                "state_id"
            ]
        )
        for item
        in end_options
    ]

    matrix_rows = (
        state_od_executor(
            profile=(
                normalized_profile
            ),
            source_state_ids=(
                source_state_ids
            ),
            target_state_ids=(
                target_state_ids
            ),
        )
    )

    matrix = (
        _normalize_matrix_rows(
            rows=(
                matrix_rows
            ),
            source_state_ids=(
                source_state_ids
            ),
            target_state_ids=(
                target_state_ids
            ),
        )
    )

    start_by_state = {
        int(
            item[
                "state_id"
            ]
        ): item
        for item
        in start_options
    }

    end_by_state = {
        int(
            item[
                "state_id"
            ]
        ): item
        for item
        in end_options
    }

    candidates = []

    for pair in sorted(
        matrix
    ):
        row = matrix[
            pair
        ]

        if not row[
            "reachable"
        ]:
            continue

        if (
            pair[0]
            ==
            pair[1]
        ):
            continue

        start_option = (
            start_by_state[
                pair[0]
            ]
        )

        end_option = (
            end_by_state[
                pair[1]
            ]
        )

        start_residual_decimal = (
            start_option[
                "_adjustment_decimal"
            ]
        )

        end_unused_decimal = (
            end_option[
                "_adjustment_decimal"
            ]
        )

        pg_cost_decimal = (
            row[
                "_total_cost_decimal"
            ]
        )

        if pg_cost_decimal is None:
            raise GPSRouteContractError(
                "reachable matrix row lacks canonical cost."
            )

        total_decimal = (
            start_residual_decimal
            +
            pg_cost_decimal
            -
            end_unused_decimal
        )

        if (
            total_decimal
            <
            _DECIMAL_ZERO
        ):
            raise GPSRouteContractError(
                "composed network cost is negative."
            )

        total_float = float(
            total_decimal
        )

        if not math.isfinite(
            total_float
        ):
            raise GPSRouteContractError(
                "composed network cost is invalid."
            )

        candidates.append(
            {
                "kind": (
                    "network"
                ),
                "start_state_id": (
                    pair[0]
                ),
                "end_state_id": (
                    pair[1]
                ),
                "start_direction": (
                    start_option[
                        "direction"
                    ]
                ),
                "end_direction": (
                    end_option[
                        "direction"
                    ]
                ),
                "start_residual": float(
                    start_residual_decimal
                ),
                "pg_cost": float(
                    pg_cost_decimal
                ),
                "end_unused": float(
                    end_unused_decimal
                ),
                "total_cost": (
                    total_float
                ),
                "_arbitration_cost": (
                    total_decimal
                ),
            }
        )

    candidates.extend(
        _same_edge_direct_candidates(
            start_snap=(
                start_snap
            ),
            end_snap=(
                end_snap
            ),
        )
    )

    if not candidates:
        return {
            **common,
            "status": (
                "no_route"
            ),
            "matrix_executor_calls": 1,
            "source_state_ids": (
                source_state_ids
            ),
            "target_state_ids": (
                target_state_ids
            ),
            "candidates": [],
            "selected_candidate": None,
        }

    minimum_cost = min(
        item[
            "_arbitration_cost"
        ]
        for item
        in candidates
    )

    winners = [
        item
        for item
        in candidates
        if item[
            "_arbitration_cost"
        ]
        ==
        minimum_cost
    ]

    public_candidates = (
        _public_candidates(
            candidates
        )
    )

    if len(
        winners
    ) != 1:
        return {
            **common,
            "status": (
                ARBITRATION_TIE_STATUS
            ),
            "matrix_executor_calls": 1,
            "source_state_ids": (
                source_state_ids
            ),
            "target_state_ids": (
                target_state_ids
            ),
            "candidates": (
                public_candidates
            ),
            "best_candidates": (
                _public_candidates(
                    winners
                )
            ),
            "selected_candidate": None,
        }

    selected = (
        _public_candidate(
            winners[0]
        )
    )

    return {
        **common,
        "status": (
            "ok"
        ),
        "matrix_executor_calls": 1,
        "source_state_ids": (
            source_state_ids
        ),
        "target_state_ids": (
            target_state_ids
        ),
        "candidates": (
            public_candidates
        ),
        "selected_candidate": (
            selected
        ),
    }
