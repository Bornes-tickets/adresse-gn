"""VIAGO D4 - isolated map-matching evidence pipeline.

This module only combines spatial, temporal and topological evidence.
It never confirms GPS position, advances a route, or unlocks guidance.
No database, network or Android access.
"""

from __future__ import annotations

import math

from collections.abc import Mapping

from .viago_map_matching_candidates import (
    assess_candidate_ambiguity,
)
from .viago_map_matching_temporal import (
    assess_temporal_candidates,
)
from .viago_map_matching_topology import (
    assess_topology_sequence,
)


def assess_matching_pipeline(samples):
    """Assess observations whose candidate lists are already complete.

    "candidate_stable" and "topology_possible" are advisory only.
    Both are deliberately unconfirmed.
    """

    def output(status, edge_id=None):
        return {
            "status": status,
            "edge_id": edge_id,
            "confirmed": False,
            "navigation_authorized": False,
        }

    if not isinstance(samples, (list, tuple)):
        return output("invalid")

    if not 4 <= len(samples) <= 12:
        return output("insufficient")

    selected = []

    try:
        for sample in samples:
            if not isinstance(sample, Mapping):
                return output("invalid")

            candidates = sample["candidates"]

            if not isinstance(candidates, (list, tuple)):
                return output("invalid")

            if not candidates:
                return output("no_candidates")

            if sample.get("truncated", True) is not False:
                return output("ambiguous")

            spatial = assess_candidate_ambiguity(
                candidates,
                sample["accuracy_m"],
                truncated=False,
            )

            if spatial == "ambiguous":
                return output("ambiguous")

            if spatial == "no_candidates":
                return output("no_candidates")

            routable = [
                candidate
                for candidate in candidates
                if candidate.get("routable") is True
            ]

            if not routable:
                return output("no_candidates")

            routable.sort(
                key=lambda candidate: (
                    candidate["distance_m"],
                    candidate["edge_id"],
                )
            )

            # D7-B: distance must be consistent with GPS uncertainty.
            # This is a conservative evidence gate, not a road lock.
            nearest_distance = float(routable[0]["distance_m"])
            accuracy = float(sample["accuracy_m"])

            if (
                not math.isfinite(nearest_distance)
                or nearest_distance < 0
                or not math.isfinite(accuracy)
                or not 0 <= accuracy <= 100
            ):
                return output("invalid")

            if nearest_distance > max(8.0, accuracy):
                return output("insufficient")

            selected.append(routable[0])

        temporal = assess_temporal_candidates(samples)
        temporal_status = temporal["status"]

        if temporal_status in ("invalid", "insufficient"):
            return output(temporal_status)

        topology = assess_topology_sequence(selected)
        topology_status = topology["status"]

        if topology_status == "invalid":
            return output("invalid")

        if topology_status != "topology_plausible":
            return output("ambiguous")

        if temporal_status == "candidate_stable":
            return output(
                "candidate_stable",
                temporal.get("edge_id"),
            )

        # Temporal analysis cannot yet validate an edge change.
        # Topology alone cannot establish a confirmed road.
        return output("topology_possible")

    except (
        KeyError,
        TypeError,
        ValueError,
        OverflowError,
        AttributeError,
    ):
        return output("invalid")