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
    "config.settings_routing_http_e2e",
)


import django  # noqa: E402


django.setup()


from django.db import connections  # noqa: E402
from rest_framework.test import APIClient  # noqa: E402


ROUTE_PATH = (
    "/internal/routing/state-to-state/"
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


class E2EAuthenticatedUser:
    is_authenticated = True


def fail(
    message: str,
) -> None:
    raise RuntimeError(
        message
    )


def response_json(
    response,
):
    try:
        return response.json()
    except Exception as exc:
        fail(
            "HTTP response is not valid JSON: "
            f"{exc!r}"
        )


def capture_queries(
    connection,
):
    statements = []

    def wrapper(
        execute,
        sql,
        params,
        many,
        context,
    ):
        statements.append(
            str(sql)
        )

        return execute(
            sql,
            params,
            many,
            context,
        )

    return statements, wrapper


def main() -> None:
    routing_connection = (
        connections["routing"]
    )

    # --------------------------------------------------------
    # Confirm the dedicated connection is truly read-only.
    # This is a SELECT only and not a pgRouting call.
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
            "Invalid routing database identity."
        )

    (
        database,
        database_user,
        transaction_read_only,
        default_transaction_read_only,
    ) = identity

    if database != "adresse_gn_real_lab":
        fail(
            "Unexpected routing database."
        )

    if database_user != "postgres":
        fail(
            "Unexpected routing database user."
        )

    if transaction_read_only != "on":
        fail(
            "Routing transaction is not read-only."
        )

    if default_transaction_read_only != "on":
        fail(
            "Routing default transaction is not read-only."
        )

    print(
        f"ROUTING_DATABASE={database}"
    )

    print(
        f"ROUTING_USER={database_user}"
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
    # HTTP permission boundary.
    #
    # No force_authenticate here.
    # IsAuthenticated must reject the request before post().
    # --------------------------------------------------------

    anonymous_client = APIClient()

    anonymous_response = (
        anonymous_client.post(
            ROUTE_PATH,
            {
                "start_state_id": (
                    PAIR2_START
                ),
                "end_state_id": (
                    PAIR2_END
                ),
            },
            format="json",
        )
    )

    if (
        anonymous_response.status_code
        != 403
    ):
        fail(
            "Unauthenticated request expected HTTP 403, "
            f"received {anonymous_response.status_code}."
        )

    print(
        "UNAUTHENTICATED_HTTP_STATUS=403"
    )

    print(
        "AUTHENTICATION_BOUNDARY=PASS"
    )

    # --------------------------------------------------------
    # Authenticated E2E client.
    # force_authenticate is deliberately limited to this local
    # transport E2E and does not redefine application auth.
    # --------------------------------------------------------

    client = APIClient()

    client.force_authenticate(
        user=E2EAuthenticatedUser()
    )

    # --------------------------------------------------------
    # Pair2 positive control.
    # Exactly one service SQL statement must contain
    # pgr_dijkstra.
    # --------------------------------------------------------

    pair2_queries, pair2_wrapper = (
        capture_queries(
            routing_connection
        )
    )

    with routing_connection.execute_wrapper(
        pair2_wrapper
    ):
        pair2_response = client.post(
            ROUTE_PATH,
            {
                "start_state_id": (
                    PAIR2_START
                ),
                "end_state_id": (
                    PAIR2_END
                ),
            },
            format="json",
        )

    if pair2_response.status_code != 200:
        fail(
            "Pair2 HTTP status mismatch: "
            f"{pair2_response.status_code}"
        )

    pair2_body = response_json(
        pair2_response
    )

    if pair2_body.get("status") != "ok":
        fail(
            "Pair2 HTTP status field mismatch."
        )

    if pair2_body.get("profile") != "car":
        fail(
            "Pair2 profile mismatch."
        )

    if pair2_body.get("reachable") is not True:
        fail(
            "Pair2 unexpectedly unreachable."
        )

    pair2_cost = float(
        pair2_body["total_cost"]
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
            "Pair2 HTTP cost mismatch: "
            f"{pair2_delta!r}"
        )

    pair2_pgr_queries = [
        sql
        for sql in pair2_queries
        if "pgr_dijkstra" in sql.lower()
    ]

    if len(pair2_pgr_queries) != 1:
        fail(
            "Pair2 expected exactly one "
            "pgr_dijkstra SQL execution."
        )

    print(
        "PAIR2_HTTP_STATUS=200"
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
        "PAIR2_PGR_DIJKSTRA_CALLS=1"
    )

    print(
        "PAIR2_HTTP_E2E=PASS"
    )

    # --------------------------------------------------------
    # Real unreachable control.
    # Exactly one second pgr_dijkstra execution.
    # --------------------------------------------------------

    unreachable_queries, unreachable_wrapper = (
        capture_queries(
            routing_connection
        )
    )

    with routing_connection.execute_wrapper(
        unreachable_wrapper
    ):
        unreachable_response = client.post(
            ROUTE_PATH,
            {
                "start_state_id": (
                    UNREACHABLE_START
                ),
                "end_state_id": (
                    UNREACHABLE_END
                ),
            },
            format="json",
        )

    if unreachable_response.status_code != 200:
        fail(
            "Unreachable HTTP status mismatch."
        )

    unreachable_body = response_json(
        unreachable_response
    )

    if (
        unreachable_body.get("reachable")
        is not False
    ):
        fail(
            "Frozen unreachable control "
            "unexpectedly became reachable."
        )

    if (
        unreachable_body.get("total_cost")
        is not None
    ):
        fail(
            "Unreachable HTTP response "
            "returned a cost."
        )

    unreachable_pgr_queries = [
        sql
        for sql in unreachable_queries
        if "pgr_dijkstra" in sql.lower()
    ]

    if len(unreachable_pgr_queries) != 1:
        fail(
            "Unreachable case expected exactly one "
            "pgr_dijkstra SQL execution."
        )

    print(
        "UNREACHABLE_HTTP_STATUS=200"
    )

    print(
        "UNREACHABLE_REACHABLE=False"
    )

    print(
        "UNREACHABLE_COST=None"
    )

    print(
        "UNREACHABLE_PGR_DIJKSTRA_CALLS=1"
    )

    print(
        "UNREACHABLE_HTTP_E2E=PASS"
    )

    # --------------------------------------------------------
    # start=end.
    #
    # Real HTTP -> DRF -> service, but the validated service
    # must short-circuit before any routing DB SQL.
    # --------------------------------------------------------

    same_queries, same_wrapper = (
        capture_queries(
            routing_connection
        )
    )

    with routing_connection.execute_wrapper(
        same_wrapper
    ):
        same_response = client.post(
            ROUTE_PATH,
            {
                "start_state_id": (
                    SAME_STATE
                ),
                "end_state_id": (
                    SAME_STATE
                ),
            },
            format="json",
        )

    if same_response.status_code != 200:
        fail(
            "start=end HTTP status mismatch."
        )

    same_body = response_json(
        same_response
    )

    if same_body.get("reachable") is not True:
        fail(
            "start=end must be reachable."
        )

    if float(
        same_body.get("total_cost")
    ) != 0.0:
        fail(
            "start=end total_cost must be zero."
        )

    same_pgr_queries = [
        sql
        for sql in same_queries
        if "pgr_dijkstra" in sql.lower()
    ]

    if same_queries:
        fail(
            "start=end unexpectedly executed "
            "routing database SQL."
        )

    if same_pgr_queries:
        fail(
            "start=end unexpectedly called "
            "pgr_dijkstra."
        )

    print(
        "START_EQUALS_END_HTTP_STATUS=200"
    )

    print(
        "START_EQUALS_END_REACHABLE=True"
    )

    print(
        "START_EQUALS_END_COST=0.0"
    )

    print(
        "START_EQUALS_END_DB_SQL_CALLS=0"
    )

    print(
        "START_EQUALS_END_PGR_DIJKSTRA_CALLS=0"
    )

    print(
        "START_EQUALS_END_HTTP_E2E=PASS"
    )

    total_pgr_calls = (
        len(pair2_pgr_queries)
        + len(unreachable_pgr_queries)
        + len(same_pgr_queries)
    )

    if total_pgr_calls != 2:
        fail(
            "Expected exactly two total "
            "pgr_dijkstra calls."
        )

    result = {
        "database": database,
        "database_user": database_user,
        "transaction_read_only": (
            transaction_read_only
        ),
        "default_transaction_read_only": (
            default_transaction_read_only
        ),
        "url": ROUTE_PATH,
        "unauthenticated_status": (
            anonymous_response.status_code
        ),
        "pair2": {
            "http_status": (
                pair2_response.status_code
            ),
            "body": pair2_body,
            "absolute_delta": (
                pair2_delta
            ),
            "pgr_dijkstra_calls": (
                len(pair2_pgr_queries)
            ),
        },
        "unreachable": {
            "http_status": (
                unreachable_response.status_code
            ),
            "body": unreachable_body,
            "pgr_dijkstra_calls": (
                len(
                    unreachable_pgr_queries
                )
            ),
        },
        "start_equals_end": {
            "http_status": (
                same_response.status_code
            ),
            "body": same_body,
            "database_sql_calls": (
                len(same_queries)
            ),
            "pgr_dijkstra_calls": (
                len(same_pgr_queries)
            ),
        },
        "total_pgr_dijkstra_calls": (
            total_pgr_calls
        ),
        "production_root_mount": False,
        "external_network": False,
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
        "BLOCK13_INTERNAL_ROUTING_HTTP_STACK_E2E_PASS"
    )


if __name__ == "__main__":
    main()