from __future__ import annotations

import hashlib
import math

from django.conf import settings


if not settings.configured:
    settings.configure(
        SECRET_KEY=(
            "block14-p8e11-unit"
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
    compose_gps_route,
)

from routing.state_od import (
    PGR_CALL_SQL,
    StateODContractError,
    StateODValidationError,
    execute_state_od_matrix,
    render_edge_sql,
)


EXPECTED_EDGE_HASHES = {
    "car": (
        "da35bd9fc5402be9883d4db9af033fa51cdbbfd2bbfefa94f9e2eedb6d8e554e"
    ),

    "motorcycle": (
        "332fe118bdd4386ebe63381b8da06c6a7ed4d4ec593fda7a23253fb3f4fea1bf"
    ),

    "foot": (
        "60b8a59c52e77c00381ae9ef1b717820ffed94a245475ab042b79a80343258a4"
    ),
}


class FakeCursor:
    def __init__(
        self,
        rows=None,
        error=None,
    ):
        self.rows = list(
            rows or []
        )

        self.error = error
        self.execute_calls = []

    def __enter__(
        self,
    ):
        return self

    def __exit__(
        self,
        exc_type,
        exc,
        tb,
    ):
        return False

    def execute(
        self,
        sql,
        parameters,
    ):
        self.execute_calls.append(
            (
                sql,
                parameters,
            )
        )

        if self.error is not None:
            raise self.error

    def fetchall(
        self,
    ):
        return list(
            self.rows
        )


class FakeConnection:
    def __init__(
        self,
        rows=None,
        error=None,
    ):
        self.cursor_obj = (
            FakeCursor(
                rows=rows,
                error=error,
            )
        )

        self.cursor_calls = 0

    def cursor(
        self,
    ):
        self.cursor_calls += 1
        return self.cursor_obj


def terminal_row(
    start_state_id,
    end_state_id,
    total_cost,
    *,
    seq=1,
    path_seq=1,
):
    return (
        seq,
        path_seq,
        start_state_id,
        end_state_id,
        end_state_id,
        -1,
        0.0,
        total_cost,
    )


def make_snap(
    *,
    edge_id,
    fraction,
    profile="car",
    forward=True,
    reverse=False,
    forward_cost=100.0,
    reverse_cost=100.0,
):
    return {
        "status": "ok",
        "profile": profile,
        "input_longitude": 0.0,
        "input_latitude": 0.0,
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
        "snapped_longitude": 0.0,
        "snapped_latitude": 0.0,
        "fraction": fraction,
        "distance_m": 1.0,
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
        start,
        end,
    ):
        self.values = [
            start,
            end,
        ]

        self.calls = []

    def __call__(
        self,
        **kwargs,
    ):
        self.calls.append(
            kwargs
        )

        return self.values[
            len(
                self.calls
            )
            -
            1
        ]


class StateODExecutorTests(
    unittest.TestCase
):
    def test_rendered_profile_hashes_are_exact(
        self,
    ):
        for profile, expected in (
            EXPECTED_EDGE_HASHES.items()
        ):
            actual = hashlib.sha256(
                render_edge_sql(
                    profile
                ).encode(
                    "utf-8"
                )
            ).hexdigest()

            self.assertEqual(
                actual,
                expected,
            )


    def test_exact_binding_order_and_single_execute(
        self,
    ):
        connection = FakeConnection(
            rows=[
                terminal_row(
                    10,
                    20,
                    5.0,
                )
            ]
        )

        result = execute_state_od_matrix(
            profile="car",
            source_state_ids=[
                10
            ],
            target_state_ids=[
                20
            ],
            connection_obj=(
                connection
            ),
        )

        self.assertEqual(
            connection.cursor_calls,
            1,
        )

        self.assertEqual(
            len(
                connection
                .cursor_obj
                .execute_calls
            ),
            1,
        )

        sql, parameters = (
            connection
            .cursor_obj
            .execute_calls[
                0
            ]
        )

        self.assertEqual(
            sql,
            PGR_CALL_SQL,
        )

        self.assertEqual(
            parameters[
                0
            ],
            render_edge_sql(
                "car"
            ),
        )

        self.assertEqual(
            parameters[
                1
            ],
            [
                10
            ],
        )

        self.assertEqual(
            parameters[
                2
            ],
            [
                20
            ],
        )

        self.assertEqual(
            result[
                0
            ][
                "total_cost"
            ],
            5.0,
        )


    def test_multirow_path_uses_terminal_aggregate_cost(
        self,
    ):
        rows = [
            (
                1,
                1,
                10,
                20,
                15,
                99,
                3.0,
                3.0,
            ),
            (
                2,
                2,
                10,
                20,
                20,
                -1,
                0.0,
                8.5,
            ),
        ]

        result = execute_state_od_matrix(
            profile="car",
            source_state_ids=[
                10
            ],
            target_state_ids=[
                20
            ],
            connection_obj=(
                FakeConnection(
                    rows=rows
                )
            ),
        )

        self.assertEqual(
            result,
            [
                {
                    "start_state_id": 10,
                    "end_state_id": 20,
                    "reachable": True,
                    "total_cost": 8.5,
                }
            ],
        )


    def test_missing_pair_materializes_unreachable(
        self,
    ):
        result = execute_state_od_matrix(
            profile="car",
            source_state_ids=[
                10
            ],
            target_state_ids=[
                20,
                21,
            ],
            connection_obj=(
                FakeConnection(
                    rows=[
                        terminal_row(
                            10,
                            20,
                            5.0,
                        )
                    ]
                )
            ),
        )

        self.assertEqual(
            result[
                0
            ][
                "reachable"
            ],
            True,
        )

        self.assertEqual(
            result[
                1
            ],
            {
                "start_state_id": 10,
                "end_state_id": 21,
                "reachable": False,
                "total_cost": None,
            },
        )


    def test_four_pair_cartesian_output(
        self,
    ):
        rows = [
            terminal_row(
                10,
                20,
                1.0,
                seq=1,
            ),
            terminal_row(
                10,
                21,
                2.0,
                seq=2,
            ),
            terminal_row(
                11,
                20,
                3.0,
                seq=3,
            ),
            terminal_row(
                11,
                21,
                4.0,
                seq=4,
            ),
        ]

        result = execute_state_od_matrix(
            profile="motorcycle",
            source_state_ids=[
                10,
                11,
            ],
            target_state_ids=[
                20,
                21,
            ],
            connection_obj=(
                FakeConnection(
                    rows=rows
                )
            ),
        )

        self.assertEqual(
            len(
                result
            ),
            4,
        )

        self.assertEqual(
            [
                (
                    item[
                        "start_state_id"
                    ],
                    item[
                        "end_state_id"
                    ],
                )
                for item
                in result
            ],
            [
                (
                    10,
                    20,
                ),
                (
                    10,
                    21,
                ),
                (
                    11,
                    20,
                ),
                (
                    11,
                    21,
                ),
            ],
        )


    def test_unexpected_pair_is_rejected(
        self,
    ):
        with self.assertRaises(
            StateODContractError
        ):
            execute_state_od_matrix(
                profile="car",
                source_state_ids=[
                    10
                ],
                target_state_ids=[
                    20
                ],
                connection_obj=(
                    FakeConnection(
                        rows=[
                            terminal_row(
                                99,
                                20,
                                1.0,
                            )
                        ]
                    )
                ),
            )


    def test_duplicate_path_sequence_is_rejected(
        self,
    ):
        rows = [
            (
                1,
                1,
                10,
                20,
                15,
                99,
                1.0,
                1.0,
            ),
            (
                2,
                1,
                10,
                20,
                20,
                -1,
                0.0,
                1.0,
            ),
        ]

        with self.assertRaises(
            StateODContractError
        ):
            execute_state_od_matrix(
                profile="foot",
                source_state_ids=[
                    10
                ],
                target_state_ids=[
                    20
                ],
                connection_obj=(
                    FakeConnection(
                        rows=rows
                    )
                ),
            )


    def test_invalid_profile_is_rejected_before_database_use(
        self,
    ):
        connection = FakeConnection()

        with self.assertRaises(
            StateODValidationError
        ):
            execute_state_od_matrix(
                profile=(
                    "car'; DROP TABLE x; --"
                ),
                source_state_ids=[
                    10
                ],
                target_state_ids=[
                    20
                ],
                connection_obj=(
                    connection
                ),
            )

        self.assertEqual(
            connection.cursor_calls,
            0,
        )


    def test_invalid_state_lists_are_rejected(
        self,
    ):
        invalid_sources = [
            [],
            [
                1,
                2,
                3,
            ],
            [
                1,
                1,
            ],
            [
                True,
            ],
            [
                -1,
            ],
            "1",
        ]

        for value in invalid_sources:
            with self.subTest(
                value=value
            ):
                with self.assertRaises(
                    StateODValidationError
                ):
                    execute_state_od_matrix(
                        profile="car",
                        source_state_ids=(
                            value
                        ),
                        target_state_ids=[
                            20
                        ],
                        connection_obj=(
                            FakeConnection()
                        ),
                    )


    def test_negative_and_nonfinite_route_costs_are_rejected(
        self,
    ):
        invalid_values = [
            -1.0,
            math.inf,
            math.nan,
        ]

        for value in invalid_values:
            with self.subTest(
                value=value
            ):
                with self.assertRaises(
                    StateODContractError
                ):
                    execute_state_od_matrix(
                        profile="car",
                        source_state_ids=[
                            10
                        ],
                        target_state_ids=[
                            20
                        ],
                        connection_obj=(
                            FakeConnection(
                                rows=[
                                    terminal_row(
                                        10,
                                        20,
                                        value,
                                    )
                                ]
                            )
                        ),
                    )


    def test_database_exception_is_not_retried(
        self,
    ):
        connection = FakeConnection(
            error=RuntimeError(
                "synthetic database failure"
            )
        )

        with self.assertRaisesRegex(
            RuntimeError,
            "synthetic database failure",
        ):
            execute_state_od_matrix(
                profile="car",
                source_state_ids=[
                    10
                ],
                target_state_ids=[
                    20
                ],
                connection_obj=(
                    connection
                ),
            )

        self.assertEqual(
            len(
                connection
                .cursor_obj
                .execute_calls
            ),
            1,
        )


    def test_gps_route_composition_integration(
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

        connection = FakeConnection(
            rows=[
                terminal_row(
                    2,
                    4,
                    50.0,
                )
            ]
        )

        def executor(
            **kwargs,
        ):
            return execute_state_od_matrix(
                connection_obj=(
                    connection
                ),
                **kwargs,
            )

        result = compose_gps_route(
            start_longitude=0.0,
            start_latitude=0.0,
            end_longitude=1.0,
            end_latitude=1.0,
            profile="car",
            candidate_limit=64,
            state_od_executor=(
                executor
            ),
            snapper=(
                SequenceSnapper(
                    start,
                    end,
                )
            ),
        )

        self.assertEqual(
            result[
                "status"
            ],
            "ok",
        )

        self.assertEqual(
            result[
                "matrix_executor_calls"
            ],
            1,
        )

        self.assertEqual(
            result[
                "selected_candidate"
            ][
                "total_cost"
            ],
            105.0,
        )

        self.assertEqual(
            len(
                connection
                .cursor_obj
                .execute_calls
            ),
            1,
        )


if __name__ == "__main__":
    unittest.main()
