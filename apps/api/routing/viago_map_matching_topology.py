"""VIAGO P4-P4-D3: conservative graph-topology evidence.

Pure functions only. No database, routing request, GPS extrapolation
or navigation confirmation.

Graph connectivity establishes only a possible transition, not
proof that the vehicle actually followed that transition.
"""

from __future__ import annotations

import math
from collections.abc import Mapping, Sequence
from typing import Any

# A transition must occur close to the relevant graph endpoint.
# This is a fraction of the edge, NOT a distance in metres.
ENDPOINT_FRACTION_TOLERANCE = 0.10
FRACTION_EPSILON = 1e-9


def _edge(candidate: Mapping[str, Any]) -> dict:
    if not isinstance(candidate, Mapping):
        raise ValueError("Candidate must be a mapping")

    result = {}

    for name in ("edge_id", "source_node_id", "target_node_id"):
        value = candidate[name]
        if type(value) is not int or value < 0:
            raise ValueError(f"Invalid {name}")
        result[name] = value

    fraction = candidate["fraction"]

    if isinstance(fraction, bool):
        raise ValueError("Invalid fraction")

    fraction = float(fraction)

    if not math.isfinite(fraction) or not 0 <= fraction <= 1:
        raise ValueError("Fraction outside [0,1]")

    result["fraction"] = fraction

    for name in ("forward_enabled", "reverse_enabled"):
        value = candidate[name]
        if type(value) is not bool:
            raise ValueError(f"Invalid {name}")
        result[name] = value

    return result


def _directions(edge: dict) -> list[str]:
    result = []

    if edge["forward_enabled"]:
        result.append("forward")

    if edge["reverse_enabled"]:
        result.append("reverse")

    return result


def _exit_node(edge: dict, direction: str):
    fraction = edge["fraction"]

    if direction == "forward":
        if fraction >= 1 - ENDPOINT_FRACTION_TOLERANCE:
            return edge["target_node_id"]
        return None

    if fraction <= ENDPOINT_FRACTION_TOLERANCE:
        return edge["source_node_id"]

    return None


def _entry_node(edge: dict, direction: str):
    fraction = edge["fraction"]

    if direction == "forward":
        if fraction <= ENDPOINT_FRACTION_TOLERANCE:
            return edge["source_node_id"]
        return None

    if fraction >= 1 - ENDPOINT_FRACTION_TOLERANCE:
        return edge["target_node_id"]

    return None


def assess_edge_transition(
    previous: Mapping[str, Any],
    current: Mapping[str, Any],
) -> dict:
    """Assess whether an edge-to-edge transition is possible.

    Status:
      topology_plausible: graph and directions permit a transition
      ambiguous: no observed movement on a bidirectional edge
      disconnected: transition cannot be established
      invalid: malformed source data

    confirmed is always False.
    """

    def result(status, directions=None):
        return {
            "status": status,
            "directions": directions or [],
            "confirmed": False,
        }

    try:
        a = _edge(previous)
        b = _edge(current)

        if not _directions(a) or not _directions(b):
            return result("disconnected")

        if a["edge_id"] == b["edge_id"]:
            if (
                a["source_node_id"] != b["source_node_id"]
                or a["target_node_id"] != b["target_node_id"]
            ):
                return result("invalid")

            delta = b["fraction"] - a["fraction"]

            if abs(delta) <= FRACTION_EPSILON:
                return result("ambiguous")

            if delta > 0 and a["forward_enabled"] and b["forward_enabled"]:
                return result("topology_plausible", ["forward"])

            if delta < 0 and a["reverse_enabled"] and b["reverse_enabled"]:
                return result("topology_plausible", ["reverse"])

            return result("disconnected")

        valid_pairs = []

        for old_direction in _directions(a):
            exit_node = _exit_node(a, old_direction)

            if exit_node is None:
                continue

            for new_direction in _directions(b):
                entry_node = _entry_node(b, new_direction)

                if entry_node is not None and exit_node == entry_node:
                    valid_pairs.append(
                        f"{old_direction}->{new_direction}"
                    )

        if not valid_pairs:
            return result("disconnected")

        return result("topology_plausible", valid_pairs)

    except (KeyError, TypeError, ValueError, OverflowError):
        return result("invalid")


def assess_topology_sequence(candidates: Sequence[Mapping]) -> dict:
    """Review an explicit sequence of edge candidates.

    This does not infer missing candidates or choose among parallel
    roads. Upstream must handle multi-candidate ambiguity.
    """

    def output(status):
        return {"status": status, "confirmed": False}

    if not isinstance(candidates, (list, tuple)):
        return output("invalid")

    if not 2 <= len(candidates) <= 12:
        return output("insufficient")

    for i in range(1, len(candidates)):
        decision = assess_edge_transition(
            candidates[i - 1],
            candidates[i],
        )

        if decision["status"] != "topology_plausible":
            return output(decision["status"])

    return output("topology_plausible")

def assess_metric_edge_transition(
    previous: Mapping[str, Any],
    current: Mapping[str, Any],
    *,
    endpoint_tolerance_m: float = 15.0,
) -> dict:
    """Assess graph junctions using physical edge lengths in metres.

    Advisory only. Never confirms a vehicle location.
    Missing lengths fail closed as metric_unverified.
    """

    def result(status):
        return {
            "status": status,
            "confirmed": False,
            "navigation_authorized": False,
        }

    try:
        tolerance = float(endpoint_tolerance_m)
        if (
            isinstance(endpoint_tolerance_m, bool)
            or not math.isfinite(tolerance)
            or not 0.0 < tolerance <= 50.0
        ):
            return result("invalid")

        a = _edge(previous)
        b = _edge(current)

        legacy = assess_edge_transition(previous, current)

        if legacy["status"] != "topology_plausible":
            return result(legacy["status"])

        for item in (previous, current):
            if "edge_length_m" not in item:
                return result("metric_unverified")

        lengths = []

        for item in (previous, current):
            value = item["edge_length_m"]

            if isinstance(value, bool):
                return result("invalid")

            length = float(value)

            if not math.isfinite(length) or length <= 0.0:
                return result("invalid")

            lengths.append(length)

        length_a, length_b = lengths

        if a["edge_id"] == b["edge_id"]:
            # Direction is already checked by the existing topology
            # function. Physical displacement remains only advisory.
            return result("metric_plausible")

        for old_direction in _directions(a):
            if old_direction == "forward":
                exit_node = a["target_node_id"]
                distance_to_exit = (
                    1.0 - a["fraction"]
                ) * length_a
            else:
                exit_node = a["source_node_id"]
                distance_to_exit = a["fraction"] * length_a

            if distance_to_exit > tolerance:
                continue

            for new_direction in _directions(b):
                if new_direction == "forward":
                    entry_node = b["source_node_id"]
                    distance_from_entry = b["fraction"] * length_b
                else:
                    entry_node = b["target_node_id"]
                    distance_from_entry = (
                        1.0 - b["fraction"]
                    ) * length_b

                if (
                    exit_node == entry_node
                    and distance_from_entry <= tolerance
                ):
                    return result("metric_plausible")

        return result("metric_disconnected")

    except (
        KeyError,
        TypeError,
        ValueError,
        OverflowError,
        AttributeError,
    ):
        return result("invalid")