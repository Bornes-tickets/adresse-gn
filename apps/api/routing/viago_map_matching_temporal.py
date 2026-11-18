"""VIAGO D2: temporal evidence, never an authoritative road lock.

No database, network, routing mutation or GPS extrapolation.
The output is advisory and cannot enable voice or route progress.
"""

from __future__ import annotations

import math

EARTH_M = 6371008.8


def _distance(a, b):
    r = math.pi / 180
    dlat = (b["lat"] - a["lat"]) * r
    dlon = (b["lng"] - a["lng"]) * r
    h = (
        math.sin(dlat / 2) ** 2
        + math.cos(a["lat"] * r)
        * math.cos(b["lat"] * r)
        * math.sin(dlon / 2) ** 2
    )
    return 2 * EARTH_M * math.atan2(
        math.sqrt(max(0.0, min(1.0, h))),
        math.sqrt(max(0.0, 1.0 - h)),
    )


def _number(value, minimum, maximum):
    if isinstance(value, bool):
        raise ValueError("Invalid numeric value")
    n = float(value)
    if not math.isfinite(n) or not minimum <= n <= maximum:
        raise ValueError("Numeric value outside contract")
    return n


def assess_temporal_candidates(samples):
    """Review a short, chronological sequence of GPS observations.

    Possible statuses:
      insufficient, ambiguous, candidate_stable, invalid.

    Every status has confirmed=False. Candidate stability is not
    evidence that no unobserved nearby road exists.
    """
    def output(status, edge_id=None):
        return {
            "status": status,
            "edge_id": edge_id,
            "confirmed": False,
        }

    if not isinstance(samples, (list, tuple)):
        return output("invalid")
    if len(samples) < 4:
        return output("insufficient")
    if len(samples) > 12:
        return output("invalid")

    selected = []
    previous = None

    try:
        for sample in samples:
            at = _number(sample["at_ms"], 1, 1e16)
            lat = _number(sample["lat"], -90, 90)
            lng = _number(sample["lng"], -180, 180)
            accuracy = _number(sample["accuracy_m"], 0, 100)
            speed = sample["speed_mps"]

            if speed is None:
                return output("insufficient")
            speed = _number(speed, 0, 70)

            if accuracy > 50:
                return output("insufficient")
            if speed < 1.5:
                return output("insufficient")
            if sample.get("truncated", True):
                return output("ambiguous")

            candidates = sample["candidates"]
            if not isinstance(candidates, (list, tuple)):
                return output("invalid")
            if not candidates:
                return output("insufficient")

            eligible = []
            edges_seen = set()

            for candidate in candidates:
                edge = candidate["edge_id"]
                if isinstance(edge, bool) or not isinstance(edge, int):
                    return output("invalid")
                if edge < 0 or edge in edges_seen:
                    return output("invalid")
                edges_seen.add(edge)

                dist = _number(candidate["distance_m"], 0, 100)

                if candidate.get("routable") is True:
                    eligible.append((dist, edge))

            if not eligible:
                return output("insufficient")

            eligible.sort(key=lambda item: (item[0], item[1]))
            first_distance, first_edge = eligible[0]

            # If another road is plausible inside the GPS error
            # envelope, the sequence must not select one arbitrarily.
            if len(eligible) >= 2:
                second_distance = eligible[1][0]
                if second_distance - first_distance <= max(8, accuracy):
                    return output("ambiguous")

            point = {"lat": lat, "lng": lng}
            normalized = {
                "at_ms": at,
                "lat": lat,
                "lng": lng,
                "accuracy_m": accuracy,
                "speed_mps": speed,
            }

            if previous is not None:
                dt = (at - previous["at_ms"]) / 1000.0
                if not 1 <= dt <= 15:
                    return output("insufficient")

                movement = _distance(previous, point)

                if movement > 45 * dt + accuracy + previous["accuracy_m"]:
                    return output("invalid")

            previous = normalized
            selected.append((normalized, first_edge))

        ids = {edge for _, edge in selected}

        # D2 deliberately does not join adjacent graph edges.
        # That requires verified topology in a later stage.
        if len(ids) != 1:
            return output("ambiguous")

        first = selected[0][0]
        last = selected[-1][0]
        duration = (last["at_ms"] - first["at_ms"]) / 1000.0

        if duration < 10 or duration > 90:
            return output("insufficient")

        displacement = _distance(first, last)
        uncertainty = max(
            item["accuracy_m"] for item, _ in selected
        )

        if displacement < max(30, uncertainty * 2):
            return output("insufficient")

        return output("candidate_stable", selected[-1][1])

    except (KeyError, TypeError, ValueError, OverflowError):
        return output("invalid")