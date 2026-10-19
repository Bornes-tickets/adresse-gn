from __future__ import annotations

from django.conf import settings


if not settings.configured:
    settings.configure(
        SECRET_KEY=(
            "block14-p8e9-unit-only"
        ),
        DATABASES={
            "default": {
                "ENGINE": (
                    "django.db.backends.dummy"
                )
            }
        },
        USE_TZ=True,
    )


import unittest

from routing.gps_route import (
    GPSRouteContractError,
    GPSRouteValidationError,
    compose_gps_route,
)


def make_snap(
    *,
    edge_id,
    fraction,
    profile="car",
    status="ok",
    forward=True,
    reverse=True,
    forward_cost=10.0,
    reverse_cost=12.0,
):
    return {
        "status": status,
        "profile": profile,
        "input_longitude": -13.0,
        "input_latitude": 9.0,
        "edge_id": edge_id,
        "source_node_id": (
            edge_id
            *
            10
        ),
        "target_node_id": (
            edge_id
            *
            10
            +
            1
        ),
        "snapped_longitude": -13.0,
        "snapped_latitude": 9.0,
        "fraction": fraction,
        "distance_m": 4.0,
        "candidate_limit": 64,
        "expanded_candidate_count": 64,
        "forward_enabled": forward,
        "reverse_enabled": reverse,
        "forward_state_id": (
            edge_id
            *
            2
            if forward
            else None
        ),
        "reverse_state_id": (
            edge_id
            *
            2
            +
            1
            if reverse
            else None
        ),
        "forward_cost": (
            forward_cost
            if forward
            else -1.0
        ),
        "reverse_cost": (
            reverse_cost
            if reverse
            else -1.0
        ),
        "radius_status": (
            "UNQUALIFIED_NO_PRODUCTION_RADIUS"
        ),
    }


class SequenceSnapper:
    def __init__(
        self,
        start_snap,
        end_snap,
    ):
        self.values = [
            start_snap,
            end_snap,
        ]

        self.calls = []

    def __call__(
        self,
        **kwargs,
    ):
        self.calls.append(
            dict(
                kwargs
            )
        )

        return self.values[
            len(
                self.calls
            )
            -
            1
        ]


class RecordingExecutor:
    def __init__(
        self,
        rows,
    ):
        self.rows = list(
            rows
        )

        self.calls = []

    def __call__(
        self,
        **kwargs,
    ):
        self.calls.append(
            dict(
                kwargs
            )
        )

        return list(
            self.rows
        )


def matrix_row(
    start_state_id,
    end_state_id,
    *,
    reachable=True,
    total_cost=100.0,
):
    return {
        "start_state_id": (
            start_state_id
        ),
        "end_state_id": (
            end_state_id
        ),
        "reachable": (
            reachable
        ),
        "total_cost": (
            total_cost
            if reachable
            else None
        ),
    }


class GPSRouteCompositionTests(
    unittest.TestCase
):
    def test_matrix_executor_called_once_for_four_pairs(
        self,
    ):
        start = make_snap(
            edge_id=10,
            fraction=0.2,
        )

        end = make_snap(
            edge_id=20,
            fraction=0.8,
        )

        executor = RecordingExecutor(
            [
                matrix_row(
                    20,
                    40,
                    total_cost=100,
                ),
                matrix_row(
                    20,
                    41,
                    total_cost=101,
                ),
                matrix_row(
                    21,
                    40,
                    total_cost=102,
                ),
                matrix_row(
                    21,
                    41,
                    total_cost=103,
                ),
            ]
        )

        result = compose_gps_route(
            start_longitude=-13.1,
            start_latitude=9.1,
            end_longitude=-13.2,
            end_latitude=9.2,
            profile="car",
            candidate_limit=64,
            state_od_executor=(
                executor
            ),
            snapper=SequenceSnapper(
                start,
                end,
            ),
        )

        self.assertEqual(
            len(
                executor.calls
            ),
            1,
        )

        self.assertEqual(
            executor.calls[0][
                "source_state_ids"
            ],
            [
                20,
                21,
            ],
        )

        self.assertEqual(
            executor.calls[0][
                "target_state_ids"
            ],
            [
                40,
                41,
            ],
        )

        self.assertEqual(
            result[
                "matrix_executor_calls"
            ],
            1,
        )


    def test_forward_rs_pg_ue_math(
        self,
    ):
        start = make_snap(
            edge_id=1,
            fraction=0.25,
            forward=True,
            reverse=False,
            forward_cost=100.0,
        )

        end = make_snap(
            edge_id=2,
            fraction=0.75,
            forward=True,
            reverse=False,
            forward_cost=80.0,
        )

        result = compose_gps_route(
            start_longitude=0,
            start_latitude=0,
            end_longitude=1,
            end_latitude=1,
            profile="car",
            candidate_limit=64,
            state_od_executor=(
                RecordingExecutor(
                    [
                        matrix_row(
                            2,
                            4,
                            total_cost=50.0,
                        )
                    ]
                )
            ),
            snapper=SequenceSnapper(
                start,
                end,
            ),
        )

        candidate = (
            result[
                "selected_candidate"
            ]
        )

        self.assertEqual(
            candidate[
                "start_residual"
            ],
            75.0,
        )

        self.assertEqual(
            candidate[
                "end_unused"
            ],
            20.0,
        )

        self.assertEqual(
            candidate[
                "pg_cost"
            ],
            50.0,
        )

        self.assertEqual(
            candidate[
                "total_cost"
            ],
            105.0,
        )


    def test_reverse_rs_pg_ue_math(
        self,
    ):
        start = make_snap(
            edge_id=1,
            fraction=0.25,
            forward=False,
            reverse=True,
            reverse_cost=100.0,
        )

        end = make_snap(
            edge_id=2,
            fraction=0.75,
            forward=False,
            reverse=True,
            reverse_cost=80.0,
        )

        result = compose_gps_route(
            start_longitude=0,
            start_latitude=0,
            end_longitude=1,
            end_latitude=1,
            profile="car",
            candidate_limit=64,
            state_od_executor=(
                RecordingExecutor(
                    [
                        matrix_row(
                            3,
                            5,
                            total_cost=100.0,
                        )
                    ]
                )
            ),
            snapper=SequenceSnapper(
                start,
                end,
            ),
        )

        candidate = (
            result[
                "selected_candidate"
            ]
        )

        self.assertEqual(
            candidate[
                "start_residual"
            ],
            25.0,
        )

        self.assertEqual(
            candidate[
                "end_unused"
            ],
            60.0,
        )

        self.assertEqual(
            candidate[
                "total_cost"
            ],
            65.0,
        )


    def test_same_edge_forward_direct_wins(
        self,
    ):
        start = make_snap(
            edge_id=8,
            fraction=0.2,
            forward=True,
            reverse=False,
            forward_cost=10.0,
        )

        end = make_snap(
            edge_id=8,
            fraction=0.7,
            forward=True,
            reverse=False,
            forward_cost=10.0,
        )

        result = compose_gps_route(
            start_longitude=0,
            start_latitude=0,
            end_longitude=1,
            end_latitude=1,
            profile="car",
            candidate_limit=64,
            state_od_executor=(
                RecordingExecutor(
                    [
                        matrix_row(
                            16,
                            16,
                            total_cost=20.0,
                        )
                    ]
                )
            ),
            snapper=SequenceSnapper(
                start,
                end,
            ),
        )

        candidate = (
            result[
                "selected_candidate"
            ]
        )

        self.assertEqual(
            candidate[
                "kind"
            ],
            "same_edge_direct",
        )

        self.assertEqual(
            candidate[
                "direction"
            ],
            "forward",
        )

        self.assertEqual(
            candidate[
                "total_cost"
            ],
            5.0,
        )


    def test_same_edge_reverse_direct_wins(
        self,
    ):
        start = make_snap(
            edge_id=8,
            fraction=0.8,
            forward=False,
            reverse=True,
            reverse_cost=10.0,
        )

        end = make_snap(
            edge_id=8,
            fraction=0.3,
            forward=False,
            reverse=True,
            reverse_cost=10.0,
        )

        result = compose_gps_route(
            start_longitude=0,
            start_latitude=0,
            end_longitude=1,
            end_latitude=1,
            profile="car",
            candidate_limit=64,
            state_od_executor=(
                RecordingExecutor(
                    [
                        matrix_row(
                            17,
                            17,
                            total_cost=20.0,
                        )
                    ]
                )
            ),
            snapper=SequenceSnapper(
                start,
                end,
            ),
        )

        candidate = (
            result[
                "selected_candidate"
            ]
        )

        self.assertEqual(
            candidate[
                "kind"
            ],
            "same_edge_direct",
        )

        self.assertEqual(
            candidate[
                "direction"
            ],
            "reverse",
        )

        self.assertEqual(
            candidate[
                "total_cost"
            ],
            5.0,
        )


    def test_same_location_zero_short_circuits_matrix(
        self,
    ):
        start = make_snap(
            edge_id=8,
            fraction=0.5,
        )

        end = make_snap(
            edge_id=8,
            fraction=0.5,
        )

        executor = (
            RecordingExecutor(
                []
            )
        )

        result = compose_gps_route(
            start_longitude=0,
            start_latitude=0,
            end_longitude=0,
            end_latitude=0,
            profile="car",
            candidate_limit=64,
            state_od_executor=(
                executor
            ),
            snapper=SequenceSnapper(
                start,
                end,
            ),
        )

        self.assertEqual(
            result[
                "selected_candidate"
            ][
                "total_cost"
            ],
            0.0,
        )

        self.assertEqual(
            result[
                "matrix_executor_calls"
            ],
            0,
        )

        self.assertEqual(
            len(
                executor.calls
            ),
            0,
        )


    def test_no_routable_start_short_circuits_matrix(
        self,
    ):
        start = make_snap(
            edge_id=1,
            fraction=0.2,
            status=(
                "no_routable_direction"
            ),
            forward=False,
            reverse=False,
        )

        end = make_snap(
            edge_id=2,
            fraction=0.8,
        )

        executor = (
            RecordingExecutor(
                []
            )
        )

        result = compose_gps_route(
            start_longitude=0,
            start_latitude=0,
            end_longitude=1,
            end_latitude=1,
            profile="car",
            candidate_limit=64,
            state_od_executor=(
                executor
            ),
            snapper=SequenceSnapper(
                start,
                end,
            ),
        )

        self.assertEqual(
            result[
                "status"
            ],
            "no_routable_start",
        )

        self.assertEqual(
            len(
                executor.calls
            ),
            0,
        )


    def test_no_routable_end_short_circuits_matrix(
        self,
    ):
        start = make_snap(
            edge_id=1,
            fraction=0.2,
        )

        end = make_snap(
            edge_id=2,
            fraction=0.8,
            status=(
                "no_routable_direction"
            ),
            forward=False,
            reverse=False,
        )

        executor = (
            RecordingExecutor(
                []
            )
        )

        result = compose_gps_route(
            start_longitude=0,
            start_latitude=0,
            end_longitude=1,
            end_latitude=1,
            profile="car",
            candidate_limit=64,
            state_od_executor=(
                executor
            ),
            snapper=SequenceSnapper(
                start,
                end,
            ),
        )

        self.assertEqual(
            result[
                "status"
            ],
            "no_routable_end",
        )

        self.assertEqual(
            len(
                executor.calls
            ),
            0,
        )


    def test_all_matrix_pairs_unreachable_returns_no_route(
        self,
    ):
        start = make_snap(
            edge_id=1,
            fraction=0.2,
            forward=True,
            reverse=False,
        )

        end = make_snap(
            edge_id=2,
            fraction=0.8,
            forward=True,
            reverse=False,
        )

        result = compose_gps_route(
            start_longitude=0,
            start_latitude=0,
            end_longitude=1,
            end_latitude=1,
            profile="car",
            candidate_limit=64,
            state_od_executor=(
                RecordingExecutor(
                    [
                        matrix_row(
                            2,
                            4,
                            reachable=False,
                        )
                    ]
                )
            ),
            snapper=SequenceSnapper(
                start,
                end,
            ),
        )

        self.assertEqual(
            result[
                "status"
            ],
            "no_route",
        )

        self.assertIsNone(
            result[
                "selected_candidate"
            ]
        )


    def test_missing_matrix_pair_raises(
        self,
    ):
        start = make_snap(
            edge_id=1,
            fraction=0.2,
        )

        end = make_snap(
            edge_id=2,
            fraction=0.8,
        )

        rows = [
            matrix_row(
                2,
                4,
            ),
            matrix_row(
                2,
                5,
            ),
            matrix_row(
                3,
                4,
            ),
        ]

        with self.assertRaises(
            GPSRouteContractError
        ):
            compose_gps_route(
                start_longitude=0,
                start_latitude=0,
                end_longitude=1,
                end_latitude=1,
                profile="car",
                candidate_limit=64,
                state_od_executor=(
                    RecordingExecutor(
                        rows
                    )
                ),
                snapper=(
                    SequenceSnapper(
                        start,
                        end,
                    )
                ),
            )


    def test_duplicate_matrix_pair_raises(
        self,
    ):
        start = make_snap(
            edge_id=1,
            fraction=0.2,
            forward=True,
            reverse=False,
        )

        end = make_snap(
            edge_id=2,
            fraction=0.8,
            forward=True,
            reverse=False,
        )

        with self.assertRaises(
            GPSRouteContractError
        ):
            compose_gps_route(
                start_longitude=0,
                start_latitude=0,
                end_longitude=1,
                end_latitude=1,
                profile="car",
                candidate_limit=64,
                state_od_executor=(
                    RecordingExecutor(
                        [
                            matrix_row(
                                2,
                                4,
                            ),
                            matrix_row(
                                2,
                                4,
                            ),
                        ]
                    )
                ),
                snapper=(
                    SequenceSnapper(
                        start,
                        end,
                    )
                ),
            )


    def test_snap_profile_mismatch_raises(
        self,
    ):
        start = make_snap(
            edge_id=1,
            fraction=0.2,
            profile="foot",
        )

        end = make_snap(
            edge_id=2,
            fraction=0.8,
            profile="car",
        )

        with self.assertRaises(
            GPSRouteContractError
        ):
            compose_gps_route(
                start_longitude=0,
                start_latitude=0,
                end_longitude=1,
                end_latitude=1,
                profile="car",
                candidate_limit=64,
                state_od_executor=(
                    RecordingExecutor(
                        []
                    )
                ),
                snapper=(
                    SequenceSnapper(
                        start,
                        end,
                    )
                ),
            )


    def test_equal_direct_and_network_cost_requires_policy(
        self,
    ):
        start = make_snap(
            edge_id=8,
            fraction=0.2,
            forward=True,
            reverse=False,
            forward_cost=10.0,
        )

        end = make_snap(
            edge_id=8,
            fraction=0.7,
            forward=True,
            reverse=False,
            forward_cost=10.0,
        )

        result = compose_gps_route(
            start_longitude=0,
            start_latitude=0,
            end_longitude=1,
            end_latitude=1,
            profile="car",
            candidate_limit=64,
            state_od_executor=(
                RecordingExecutor(
                    [
                        matrix_row(
                            16,
                            16,
                            total_cost=0.0,
                        )
                    ]
                )
            ),
            snapper=SequenceSnapper(
                start,
                end,
            ),
        )

        self.assertEqual(
            result[
                "status"
            ],
            "tie_requires_policy",
        )

        self.assertIsNone(
            result[
                "selected_candidate"
            ]
        )

        self.assertEqual(
            len(
                result[
                    "best_candidates"
                ]
            ),
            2,
        )


    def test_invalid_profile_and_candidate_limit_rejected(
        self,
    ):
        snapper = (
            SequenceSnapper(
                make_snap(
                    edge_id=1,
                    fraction=0.2,
                ),
                make_snap(
                    edge_id=2,
                    fraction=0.8,
                ),
            )
        )

        executor = (
            RecordingExecutor(
                []
            )
        )

        with self.assertRaises(
            GPSRouteValidationError
        ):
            compose_gps_route(
                start_longitude=0,
                start_latitude=0,
                end_longitude=1,
                end_latitude=1,
                profile="bicycle",
                candidate_limit=64,
                state_od_executor=(
                    executor
                ),
                snapper=(
                    snapper
                ),
            )

        with self.assertRaises(
            GPSRouteValidationError
        ):
            compose_gps_route(
                start_longitude=0,
                start_latitude=0,
                end_longitude=1,
                end_latitude=1,
                profile="car",
                candidate_limit=0,
                state_od_executor=(
                    executor
                ),
                snapper=(
                    snapper
                ),
            )


if __name__ == "__main__":
    unittest.main()
