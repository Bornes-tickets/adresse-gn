from __future__ import annotations

import json
import math
import os
import sys
from pathlib import Path


REPO_ROOT = (
    Path(__file__)
    .resolve()
    .parents[2]
)

API_ROOT = (
    REPO_ROOT
    / "apps"
    / "api"
)

sys.path.insert(
    0,
    str(API_ROOT),
)

os.environ.setdefault(
    "DJANGO_SETTINGS_MODULE",
    "config.settings_routing_e2e",
)


import django  # noqa: E402


django.setup()


from django.db import connections  # noqa: E402

from routing.services import (  # noqa: E402
    route_state_to_state,
)


PAIR2_START = 417992
PAIR2_END = 398405

PAIR2_EXPECTED_COST = (
    711.0470099089517
)

UNREACHABLE_START = 1030028
UNREACHABLE_END = 2

SAME_STATE = 2

TOLERANCE = 1e-9


def fail(
    message: str,
) -> None:
    raise RuntimeError(
        message
    )


def main() -> None:
    routing_connection = (
        connections["routing"]
    )

    # --------------------------------------------------------
    # Connection safety
    # --------------------------------------------------------

    with routing_connection.cursor() as cursor:
        cursor.execute(
            """
            SELECT
                current_database(),
                current_user,
                current_setting(
                    'transaction_read_only'
                ),
                current_setting(
                    'default_transaction_read_only'
                )
            """
        )

        identity = cursor.fetchone()

    if (
        identity is None
        or len(identity) != 4
    ):
        fail(
            "Invalid routing connection identity."
        )

    (
        database,
        user,
        transaction_read_only,
        default_transaction_read_only,
    ) = identity

    if database != "adresse_gn_real_lab":
        fail(
            "Unexpected routing database."
        )

    if user != "postgres":
        fail(
            "Unexpected routing database user."
        )

    if transaction_read_only != "on":
        fail(
            "Routing transaction is not read-only."
        )

    if default_transaction_read_only != "on":
        fail(
            "Routing connection default is not read-only."
        )

    print(
        f"ROUTING_DATABASE={database}"
    )

    print(
        f"ROUTING_USER={user}"
    )

    print(
        "TRANSACTION_READ_ONLY="
        f"{transaction_read_only}"
    )

    print(
        "DEFAULT_TRANSACTION_READ_ONLY="
        f"{default_transaction_read_only}"
    )

    # --------------------------------------------------------
    # Pair2 — historical frozen positive control
    # Real service -> real PostgreSQL -> real pgr_dijkstra.
    # --------------------------------------------------------

    pair2 = route_state_to_state(
        start_state_id=PAIR2_START,
        end_state_id=PAIR2_END,
    )

    if pair2["reachable"] is not True:
        fail(
            "Pair2 unexpectedly unreachable."
        )

    pair2_cost = float(
        pair2["total_cost"]
    )

    if not math.isfinite(
        pair2_cost
    ):
        fail(
            "Pair2 cost is non-finite."
        )

    pair2_delta = abs(
        pair2_cost
        - PAIR2_EXPECTED_COST
    )

    if pair2_delta > TOLERANCE:
        fail(
            "Pair2 cost mismatch: "
            f"delta={pair2_delta!r}"
        )

    print(
        "PAIR2_REACHABLE=True"
    )

    print(
        f"PAIR2_COST={pair2_cost!r}"
    )

    print(
        f"PAIR2_DELTA={pair2_delta!r}"
    )

    print(
        "PAIR2_E2E=PASS"
    )

    # --------------------------------------------------------
    # Real unreachable control
    # Second and final pgRouting application call.
    # --------------------------------------------------------

    unreachable = route_state_to_state(
        start_state_id=UNREACHABLE_START,
        end_state_id=UNREACHABLE_END,
    )

    if unreachable["reachable"] is not False:
        fail(
            "Frozen unreachable control "
            "unexpectedly became reachable."
        )

    if unreachable["total_cost"] is not None:
        fail(
            "Unreachable route returned a cost."
        )

    print(
        "UNREACHABLE_REACHABLE=False"
    )

    print(
        "UNREACHABLE_COST=None"
    )

    print(
        "UNREACHABLE_E2E=PASS"
    )

    # --------------------------------------------------------
    # start=end contract.
    #
    # Deliberately pass a NONEXISTENT database alias.
    # Success proves the service returned before attempting to
    # resolve or access a database connection.
    # --------------------------------------------------------

    same_state = route_state_to_state(
        start_state_id=SAME_STATE,
        end_state_id=SAME_STATE,
        using=(
            "block13_alias_must_never_be_used"
        ),
    )

    if same_state["reachable"] is not True:
        fail(
            "start=end must be reachable."
        )

    if float(
        same_state["total_cost"]
    ) != 0.0:
        fail(
            "start=end cost must be zero."
        )

    print(
        "START_EQUALS_END_REACHABLE=True"
    )

    print(
        "START_EQUALS_END_COST=0.0"
    )

    print(
        "START_EQUALS_END_DB_ACCESS=0"
    )

    print(
        "START_EQUALS_END_E2E=PASS"
    )

    result = {
        "database": database,
        "database_user": user,
        "transaction_read_only": (
            transaction_read_only
        ),
        "default_transaction_read_only": (
            default_transaction_read_only
        ),
        "pair2": pair2,
        "pair2_delta": pair2_delta,
        "unreachable": unreachable,
        "start_equals_end": same_state,
        "expected_pgr_dijkstra_calls": 2,
        "production_freeze": False,
        "pair3": "NOT_CREATED",
    }

    print(
        "RESULT_JSON="
        + json.dumps(
            result,
            sort_keys=True,
            separators=(",", ":"),
        )
    )

    routing_connection.close()

    print(
        "BLOCK13_DJANGO_ROUTING_REAL_SERVICE_E2E_PASS"
    )


if __name__ == "__main__":
    main()