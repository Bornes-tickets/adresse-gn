"""VIAGO D7-D2: offline metric evidence integration.

Does not access a database, GPS device, API, or navigation runtime.
Metric data must be supplied by a separately validated provider.
Never confirms a road or enables driving guidance.
"""

from __future__ import annotations

import math

from .viago_map_matching_pipeline import assess_matching_pipeline
from .viago_map_matching_edge_metrics import (
    assess_exact_metric_transition,
)

METRIC_FIELDS = (
    "edge_length_m",
    "distance_to_source_m",
    "distance_to_target_m",
)


def _metrics(candidate):
    if any(name not in candidate for name in METRIC_FIELDS):
        return "missing"

    values = []

    for name in METRIC_FIELDS:
        raw = candidate[name]

        if isinstance(raw, bool):
            return "invalid"

        try:
            value = float(raw)
        except (TypeError, ValueError, OverflowError):
            return "invalid"

        if not math.isfinite(value) or value < 0:
            return "invalid"

        values.append(value)

    length, source, target = values

    if length <= 0:
        return "invalid"

    if source > length + 0.5 or target > length + 0.5:
        return "invalid"

    if abs(source + target - length) > max(
        0.5, 0.005 * length
    ):
        return "invalid"

    return "ok"


def assess_metric_matching_pipeline(samples):
    """Combine D4 evidence with independently supplied road metrics.

    Status values describe evidence only; no status confirms travel.
    """

    def output(status, edge_id=None):
        return {
            "status": status,
            "edge_id": edge_id,
            "confirmed": False,
            "navigation_authorized": False,
        }

    baseline = assess_matching_pipeline(samples)
    status = baseline["status"]

    if status not in ("candidate_stable", "topology_possible"):
        return output(status)

    chosen = []

    try:
        for sample in samples:
            candidates = sorted(
                (
                    candidate
                    for candidate in sample["candidates"]
                    if candidate.get("routable") is True
                ),
                key=lambda candidate: (
                    candidate["distance_m"],
                    candidate["edge_id"],
                ),
            )

            if not candidates:
                return output("no_candidates")

            item = candidates[0]

            check = _metrics(item)

            if check == "missing":
                return output("metric_unverified")

            if check != "ok":
                return output("invalid")

            chosen.append(item)

        for previous, current in zip(chosen, chosen[1:]):
            if previous["edge_id"] == current["edge_id"]:
                old_length = float(previous["edge_length_m"])
                new_length = float(current["edge_length_m"])

                if abs(old_length - new_length) > max(
                    0.5, 0.005 * old_length
                ):
                    return output("invalid")

                # D4 verifies allowed directions and fractions.
                # Here verify that metric progress agrees with them.
                delta_fraction = (
                    float(current["fraction"])
                    - float(previous["fraction"])
                )
                delta_metres = (
                    float(current["distance_to_source_m"])
                    - float(previous["distance_to_source_m"])
                )

                if (
                    delta_fraction * delta_metres <= 0
                    or abs(delta_metres) < 1e-9
                ):
                    return output("invalid")

                continue

            decision = assess_exact_metric_transition(
                previous,
                current,
            )

            metric_status = decision["status"]

            if metric_status == "metric_unverified":
                return output("metric_unverified")

            if metric_status == "invalid":
                return output("invalid")

            if metric_status != "metric_plausible":
                return output("ambiguous")

        if status == "candidate_stable":
            return output(
                "metric_candidate_stable",
                baseline.get("edge_id"),
            )

        return output("metric_transition_plausible")

    except (
        KeyError, TypeError, ValueError,
        OverflowError, AttributeError,
    ):
        return output("invalid")