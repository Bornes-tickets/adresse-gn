from __future__ import annotations

import argparse
import csv
import heapq
import json
import math
from typing import Any, Iterable


class TransitionGraphContractError(ValueError):
    pass


def _plain_int(name: str, value: Any) -> int:
    if not isinstance(value, int) or isinstance(value, bool):
        raise TransitionGraphContractError(
            f"{name} must be an integer"
        )

    if value < 0:
        raise TransitionGraphContractError(
            f"{name} must be non-negative"
        )

    return value


def _cost(value: Any) -> float:
    if (
        isinstance(value, bool)
        or not isinstance(value, (int, float))
    ):
        raise TransitionGraphContractError(
            "cost must be numeric"
        )

    result = float(value)

    if not math.isfinite(result):
        raise TransitionGraphContractError(
            "cost must be finite"
        )

    if result < 0.0:
        raise TransitionGraphContractError(
            "cost must be non-negative"
        )

    return result


def _transition(
    raw: dict[str, Any],
) -> tuple[int, int, int, float]:
    required = {
        "transition_id",
        "source_state_id",
        "target_state_id",
        "cost",
    }

    missing = required.difference(raw)

    if missing:
        raise TransitionGraphContractError(
            "missing required fields: "
            + ",".join(sorted(missing))
        )

    transition_id = _plain_int(
        "transition_id",
        raw["transition_id"],
    )

    source_state_id = _plain_int(
        "source_state_id",
        raw["source_state_id"],
    )

    target_state_id = _plain_int(
        "target_state_id",
        raw["target_state_id"],
    )

    cost = _cost(raw["cost"])

    return (
        transition_id,
        source_state_id,
        target_state_id,
        cost,
    )


def dijkstra_shortest_path(
    raw_transitions: Iterable[dict[str, Any]],
    start_state_id: int,
    end_state_id: int,
) -> dict[str, Any]:
    start_state_id = _plain_int(
        "start_state_id",
        start_state_id,
    )

    end_state_id = _plain_int(
        "end_state_id",
        end_state_id,
    )

    if start_state_id == end_state_id:
        return {
            "reachable": True,
            "total_cost": 0.0,
            "state_sequence": [start_state_id],
            "transition_sequence": [],
        }

    adjacency: dict[
        int,
        list[tuple[int, float, int]],
    ] = {}

    seen_transition_ids: set[int] = set()

    for raw in raw_transitions:
        if not isinstance(raw, dict):
            raise TransitionGraphContractError(
                "every transition record must be an object"
            )

        (
            transition_id,
            source_state_id,
            target_state_id,
            cost,
        ) = _transition(raw)

        if transition_id in seen_transition_ids:
            raise TransitionGraphContractError(
                f"duplicate transition_id: {transition_id}"
            )

        seen_transition_ids.add(transition_id)

        adjacency.setdefault(
            source_state_id,
            [],
        ).append(
            (
                target_state_id,
                cost,
                transition_id,
            )
        )

    for outgoing in adjacency.values():
        outgoing.sort(
            key=lambda item: (
                item[0],
                item[2],
            )
        )

    distances: dict[int, float] = {
        start_state_id: 0.0
    }

    predecessor: dict[
        int,
        tuple[int, int],
    ] = {}

    queue: list[tuple[float, int]] = [
        (0.0, start_state_id)
    ]

    while queue:
        current_cost, current_state_id = heapq.heappop(queue)

        best_cost = distances.get(current_state_id)

        if best_cost is None:
            continue

        if current_cost > best_cost:
            continue

        if current_state_id == end_state_id:
            break

        for (
            target_state_id,
            transition_cost,
            transition_id,
        ) in adjacency.get(current_state_id, []):

            candidate_cost = current_cost + transition_cost

            known_cost = distances.get(target_state_id)

            if known_cost is None or candidate_cost < known_cost:

                distances[target_state_id] = candidate_cost

                predecessor[target_state_id] = (
                    current_state_id,
                    transition_id,
                )

                heapq.heappush(
                    queue,
                    (
                        candidate_cost,
                        target_state_id,
                    ),
                )

    if end_state_id not in distances:
        return {
            "reachable": False,
            "total_cost": None,
            "state_sequence": [],
            "transition_sequence": [],
        }

    reversed_states = [end_state_id]
    reversed_transitions: list[int] = []

    cursor = end_state_id

    while cursor != start_state_id:
        step = predecessor.get(cursor)

        if step is None:
            raise RuntimeError(
                "internal path reconstruction failure"
            )

        previous_state_id, transition_id = step

        reversed_transitions.append(transition_id)
        reversed_states.append(previous_state_id)

        cursor = previous_state_id

    state_sequence = list(
        reversed(reversed_states)
    )

    transition_sequence = list(
        reversed(reversed_transitions)
    )

    return {
        "reachable": True,
        "total_cost": distances[end_state_id],
        "state_sequence": state_sequence,
        "transition_sequence": transition_sequence,
    }


def _load_csv(
    path: str,
) -> Iterable[dict[str, Any]]:
    with open(
        path,
        "r",
        encoding="utf-8",
        newline="",
    ) as handle:

        reader = csv.DictReader(handle)

        required = {
            "transition_id",
            "source_state_id",
            "target_state_id",
            "cost",
        }

        if reader.fieldnames is None:
            raise TransitionGraphContractError(
                "CSV header missing"
            )

        missing = required.difference(reader.fieldnames)

        if missing:
            raise TransitionGraphContractError(
                "CSV missing required fields: "
                + ",".join(sorted(missing))
            )

        for row in reader:
            yield {
                "transition_id":
                    int(row["transition_id"]),

                "source_state_id":
                    int(row["source_state_id"]),

                "target_state_id":
                    int(row["target_state_id"]),

                "cost":
                    float(row["cost"]),
            }


def _expect_contract_error(
    graph: list[dict[str, Any]],
    start: int,
    end: int,
) -> None:
    try:
        dijkstra_shortest_path(
            graph,
            start,
            end,
        )
    except TransitionGraphContractError:
        return

    raise AssertionError(
        "expected TransitionGraphContractError"
    )


def _self_test() -> None:
    graph = [
        {
            "transition_id": 1,
            "source_state_id": 100,
            "target_state_id": 200,
            "cost": 5.0,
        },
        {
            "transition_id": 2,
            "source_state_id": 200,
            "target_state_id": 300,
            "cost": 7.0,
        },
        {
            "transition_id": 3,
            "source_state_id": 100,
            "target_state_id": 300,
            "cost": 20.0,
        },
        {
            "transition_id": 4,
            "source_state_id": 300,
            "target_state_id": 400,
            "cost": 0.5,
        },
    ]

    result = dijkstra_shortest_path(
        graph,
        100,
        300,
    )

    assert result["reachable"] is True
    assert result["total_cost"] == 12.0

    assert result["state_sequence"] == [
        100,
        200,
        300,
    ]

    assert result["transition_sequence"] == [
        1,
        2,
    ]

    same = dijkstra_shortest_path(
        graph,
        123,
        123,
    )

    assert same == {
        "reachable": True,
        "total_cost": 0.0,
        "state_sequence": [123],
        "transition_sequence": [],
    }

    unreachable = dijkstra_shortest_path(
        graph,
        400,
        999,
    )

    assert unreachable == {
        "reachable": False,
        "total_cost": None,
        "state_sequence": [],
        "transition_sequence": [],
    }

    zero_cost_graph = [
        {
            "transition_id": 10,
            "source_state_id": 1,
            "target_state_id": 2,
            "cost": 0.0,
        },
        {
            "transition_id": 11,
            "source_state_id": 2,
            "target_state_id": 3,
            "cost": 0.0,
        },
    ]

    zero_result = dijkstra_shortest_path(
        zero_cost_graph,
        1,
        3,
    )

    assert zero_result["reachable"] is True
    assert zero_result["total_cost"] == 0.0

    _expect_contract_error(
        [
            {
                "transition_id": 20,
                "source_state_id": 1,
                "target_state_id": 2,
                "cost": -1.0,
            }
        ],
        1,
        2,
    )

    _expect_contract_error(
        [
            {
                "transition_id": 21,
                "source_state_id": 1,
                "target_state_id": 2,
                "cost": float("nan"),
            }
        ],
        1,
        2,
    )

    _expect_contract_error(
        [
            {
                "transition_id": 30,
                "source_state_id": 1,
                "target_state_id": 2,
                "cost": 1.0,
            },
            {
                "transition_id": 30,
                "source_state_id": 2,
                "target_state_id": 3,
                "cost": 1.0,
            },
        ],
        1,
        3,
    )

    print(
        "REFERENCE_TRANSITION_DIJKSTRA_SELF_TEST_PASS"
    )


def main() -> None:
    parser = argparse.ArgumentParser(
        description=(
            "Independent Dijkstra reference engine "
            "for Adresse GN routing state transitions."
        )
    )

    parser.add_argument(
        "--self-test",
        action="store_true",
    )

    parser.add_argument(
        "--input",
    )

    parser.add_argument(
        "--start-state",
        type=int,
    )

    parser.add_argument(
        "--end-state",
        type=int,
    )

    args = parser.parse_args()

    if args.self_test:
        _self_test()
        return

    if (
        args.input is None
        or args.start_state is None
        or args.end_state is None
    ):
        parser.error(
            "--input, --start-state and --end-state "
            "are required unless --self-test is used"
        )

    result = dijkstra_shortest_path(
        _load_csv(args.input),
        args.start_state,
        args.end_state,
    )

    print(
        json.dumps(
            result,
            ensure_ascii=False,
            separators=(",", ":"),
            sort_keys=True,
        )
    )


if __name__ == "__main__":
    main()