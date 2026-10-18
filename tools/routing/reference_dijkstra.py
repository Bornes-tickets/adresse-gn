from __future__ import annotations

import argparse
import csv
import heapq
import json
import math
from dataclasses import dataclass
from typing import Any, Iterable


@dataclass(frozen=True)
class Arc:
    state_id: int
    edge_id: int
    source: int
    target: int
    cost: float
    direction: str


class GraphContractError(ValueError):
    pass


def _plain_int(name: str, value: Any) -> int:
    if not isinstance(value, int) or isinstance(value, bool):
        raise GraphContractError(f"{name} must be an integer")
    return value


def _cost(value: Any) -> float:
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        raise GraphContractError("cost must be numeric")

    result = float(value)

    if not math.isfinite(result):
        raise GraphContractError("cost must be finite")

    if result < 0.0:
        raise GraphContractError("cost must be non-negative")

    return result


def _arc(raw: dict[str, Any]) -> Arc:
    required = {
        "state_id",
        "edge_id",
        "source",
        "target",
        "cost",
        "direction",
    }

    missing = required.difference(raw)

    if missing:
        raise GraphContractError(
            "missing required fields: " + ",".join(sorted(missing))
        )

    state_id = _plain_int("state_id", raw["state_id"])
    edge_id = _plain_int("edge_id", raw["edge_id"])
    source = _plain_int("source", raw["source"])
    target = _plain_int("target", raw["target"])
    cost = _cost(raw["cost"])
    direction = raw["direction"]

    if state_id < 0:
        raise GraphContractError("state_id must be non-negative")

    if edge_id != state_id // 2:
        raise GraphContractError(
            "edge_id must equal floor(state_id/2)"
        )

    expected_direction = (
        "FORWARD" if state_id % 2 == 0 else "REVERSE"
    )

    if direction != expected_direction:
        raise GraphContractError(
            "direction does not match state_id parity"
        )

    return Arc(
        state_id=state_id,
        edge_id=edge_id,
        source=source,
        target=target,
        cost=cost,
        direction=direction,
    )


def normalize_graph(
    raw_arcs: Iterable[dict[str, Any]],
) -> list[Arc]:
    result: list[Arc] = []
    seen: set[int] = set()

    for raw in raw_arcs:
        if not isinstance(raw, dict):
            raise GraphContractError(
                "every graph record must be an object"
            )

        arc = _arc(raw)

        if arc.state_id in seen:
            raise GraphContractError(
                f"duplicate state_id: {arc.state_id}"
            )

        seen.add(arc.state_id)
        result.append(arc)

    return result


def dijkstra_shortest_path(
    raw_arcs: Iterable[dict[str, Any]],
    start: int,
    end: int,
) -> dict[str, Any]:
    start = _plain_int("start", start)
    end = _plain_int("end", end)

    arcs = normalize_graph(raw_arcs)

    if start == end:
        return {
            "reachable": True,
            "total_cost": 0.0,
            "vertex_sequence": [start],
            "state_sequence": [],
            "edge_sequence": [],
            "direction_sequence": [],
        }

    adjacency: dict[int, list[Arc]] = {}

    for arc in arcs:
        adjacency.setdefault(arc.source, []).append(arc)

    for outgoing in adjacency.values():
        outgoing.sort(
            key=lambda item: (
                item.target,
                item.state_id,
            )
        )

    distances: dict[int, float] = {start: 0.0}
    predecessor: dict[int, tuple[int, Arc]] = {}

    queue: list[tuple[float, int]] = [(0.0, start)]

    while queue:
        current_cost, vertex = heapq.heappop(queue)

        best = distances.get(vertex)

        if best is None:
            continue

        if current_cost > best:
            continue

        if vertex == end:
            break

        for arc in adjacency.get(vertex, []):
            candidate = current_cost + arc.cost
            known = distances.get(arc.target)

            if known is None or candidate < known:
                distances[arc.target] = candidate
                predecessor[arc.target] = (vertex, arc)

                heapq.heappush(
                    queue,
                    (candidate, arc.target),
                )

    if end not in distances:
        return {
            "reachable": False,
            "total_cost": None,
            "vertex_sequence": [],
            "state_sequence": [],
            "edge_sequence": [],
            "direction_sequence": [],
        }

    vertices_reversed = [end]
    arcs_reversed: list[Arc] = []

    cursor = end

    while cursor != start:
        step = predecessor.get(cursor)

        if step is None:
            raise RuntimeError(
                "internal path reconstruction failure"
            )

        previous, arc = step

        arcs_reversed.append(arc)
        vertices_reversed.append(previous)
        cursor = previous

    vertices = list(reversed(vertices_reversed))
    path_arcs = list(reversed(arcs_reversed))

    reconstructed_cost = math.fsum(
        arc.cost for arc in path_arcs
    )

    total_cost = distances[end]

    if not math.isclose(
        reconstructed_cost,
        total_cost,
        rel_tol=0.0,
        abs_tol=1e-9,
    ):
        raise RuntimeError(
            "reconstructed path cost differs from reported cost"
        )

    for index, arc in enumerate(path_arcs):
        if arc.source != vertices[index]:
            raise RuntimeError(
                "invalid reconstructed arc source"
            )

        if arc.target != vertices[index + 1]:
            raise RuntimeError(
                "invalid reconstructed arc target"
            )

    return {
        "reachable": True,
        "total_cost": total_cost,
        "vertex_sequence": vertices,
        "state_sequence": [
            arc.state_id for arc in path_arcs
        ],
        "edge_sequence": [
            arc.edge_id for arc in path_arcs
        ],
        "direction_sequence": [
            arc.direction for arc in path_arcs
        ],
    }


def _load_json(path: str) -> list[dict[str, Any]]:
    with open(path, "r", encoding="utf-8") as handle:
        payload = json.load(handle)

    if isinstance(payload, list):
        arcs = payload
    elif isinstance(payload, dict):
        arcs = payload.get("arcs")
    else:
        raise GraphContractError(
            "JSON input must be an array or object containing arcs"
        )

    if not isinstance(arcs, list):
        raise GraphContractError(
            "JSON arcs must be an array"
        )

    return arcs


def _load_csv(path: str) -> list[dict[str, Any]]:
    result: list[dict[str, Any]] = []

    with open(
        path,
        "r",
        encoding="utf-8",
        newline="",
    ) as handle:
        reader = csv.DictReader(handle)

        required = {
            "state_id",
            "edge_id",
            "source",
            "target",
            "cost",
            "direction",
        }

        if reader.fieldnames is None:
            raise GraphContractError("CSV header is missing")

        missing = required.difference(reader.fieldnames)

        if missing:
            raise GraphContractError(
                "CSV missing required fields: "
                + ",".join(sorted(missing))
            )

        for row in reader:
            result.append(
                {
                    "state_id": int(row["state_id"]),
                    "edge_id": int(row["edge_id"]),
                    "source": int(row["source"]),
                    "target": int(row["target"]),
                    "cost": float(row["cost"]),
                    "direction": row["direction"],
                }
            )

    return result


def _expect_contract_error(
    graph: list[dict[str, Any]],
    start: int,
    end: int,
) -> None:
    try:
        dijkstra_shortest_path(graph, start, end)
    except GraphContractError:
        return

    raise AssertionError(
        "expected GraphContractError was not raised"
    )


def _self_test() -> None:
    simple = [
        {
            "state_id": 2,
            "edge_id": 1,
            "source": 1,
            "target": 2,
            "cost": 1.0,
            "direction": "FORWARD",
        },
        {
            "state_id": 4,
            "edge_id": 2,
            "source": 2,
            "target": 3,
            "cost": 1.0,
            "direction": "FORWARD",
        },
        {
            "state_id": 6,
            "edge_id": 3,
            "source": 1,
            "target": 3,
            "cost": 5.0,
            "direction": "FORWARD",
        },
    ]

    result = dijkstra_shortest_path(simple, 1, 3)

    assert result["reachable"] is True
    assert result["total_cost"] == 2.0
    assert result["vertex_sequence"] == [1, 2, 3]
    assert result["state_sequence"] == [2, 4]
    assert result["edge_sequence"] == [1, 2]

    parallel = [
        {
            "state_id": 8,
            "edge_id": 4,
            "source": 10,
            "target": 20,
            "cost": 3.0,
            "direction": "FORWARD",
        },
        {
            "state_id": 10,
            "edge_id": 5,
            "source": 10,
            "target": 20,
            "cost": 1.0,
            "direction": "FORWARD",
        },
    ]

    result = dijkstra_shortest_path(parallel, 10, 20)

    assert result["reachable"] is True
    assert result["total_cost"] == 1.0
    assert result["state_sequence"] == [10]

    reverse = [
        {
            "state_id": 3,
            "edge_id": 1,
            "source": 2,
            "target": 1,
            "cost": 4.0,
            "direction": "REVERSE",
        }
    ]

    result = dijkstra_shortest_path(reverse, 2, 1)

    assert result["reachable"] is True
    assert result["total_cost"] == 4.0
    assert result["direction_sequence"] == ["REVERSE"]

    unreachable = [
        {
            "state_id": 12,
            "edge_id": 6,
            "source": 100,
            "target": 101,
            "cost": 1.0,
            "direction": "FORWARD",
        }
    ]

    result = dijkstra_shortest_path(
        unreachable,
        100,
        999,
    )

    assert result["reachable"] is False
    assert result["total_cost"] is None

    result = dijkstra_shortest_path(
        simple,
        7,
        7,
    )

    assert result["reachable"] is True
    assert result["total_cost"] == 0.0
    assert result["vertex_sequence"] == [7]

    _expect_contract_error(
        [
            {
                "state_id": 14,
                "edge_id": 7,
                "source": 1,
                "target": 2,
                "cost": -1.0,
                "direction": "FORWARD",
            }
        ],
        1,
        2,
    )

    _expect_contract_error(
        [
            {
                "state_id": 16,
                "edge_id": 8,
                "source": 1,
                "target": 2,
                "cost": 1.0,
                "direction": "FORWARD",
            },
            {
                "state_id": 16,
                "edge_id": 8,
                "source": 2,
                "target": 3,
                "cost": 1.0,
                "direction": "FORWARD",
            },
        ],
        1,
        3,
    )

    _expect_contract_error(
        [
            {
                "state_id": 19,
                "edge_id": 9,
                "source": 1,
                "target": 2,
                "cost": 1.0,
                "direction": "FORWARD",
            }
        ],
        1,
        2,
    )

    _expect_contract_error(
        [
            {
                "state_id": 20,
                "edge_id": 10,
                "source": 1,
                "target": 2,
                "cost": float("inf"),
                "direction": "FORWARD",
            }
        ],
        1,
        2,
    )

    _expect_contract_error(
        [
            {
                "state_id": 22,
                "edge_id": 11,
                "source": 1,
                "target": 2,
                "cost": float("nan"),
                "direction": "FORWARD",
            }
        ],
        1,
        2,
    )

    _expect_contract_error(
        [
            {
                "state_id": 24,
                "edge_id": 12,
                "source": 1,
                "cost": 1.0,
                "direction": "FORWARD",
            }
        ],
        1,
        2,
    )

    print("REFERENCE_DIJKSTRA_SELF_TEST_PASS")


def main() -> None:
    parser = argparse.ArgumentParser(
        description=(
            "Independent Dijkstra reference engine for "
            "Adresse GN frozen directed graph exports."
        )
    )

    parser.add_argument(
        "--self-test",
        action="store_true",
    )

    parser.add_argument("--input")

    parser.add_argument(
        "--format",
        choices=("json", "csv"),
    )

    parser.add_argument(
        "--start",
        type=int,
    )

    parser.add_argument(
        "--end",
        type=int,
    )

    args = parser.parse_args()

    if args.self_test:
        _self_test()
        return

    if (
        args.input is None
        or args.format is None
        or args.start is None
        or args.end is None
    ):
        parser.error(
            "--input, --format, --start and --end "
            "are required unless --self-test is used"
        )

    if args.format == "json":
        arcs = _load_json(args.input)
    else:
        arcs = _load_csv(args.input)

    result = dijkstra_shortest_path(
        arcs,
        args.start,
        args.end,
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