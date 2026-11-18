"""Conservative graph-junction manoeuvres for isolated Viago routing.

Never classify bends inside an edge as turns; only a verified, connected
change of underlying OSM way may be eligible. When metadata is unavailable,
return no instructions. This is graph-derived guidance, not certified road
signage/turn-restriction coverage.
"""
from __future__ import annotations

import math

TOPOLOGY_SQL = """
SELECT edge_id, way_id, source, target
FROM maps_routing_stage.routing_edges
WHERE edge_id = ANY(%s::bigint[])
"""


def _bearing(a, b):
    lat1, lat2 = math.radians(a[1]), math.radians(b[1])
    delta = math.radians(b[0] - a[0])
    x = math.sin(delta) * math.cos(lat2)
    y = math.cos(lat1)*math.sin(lat2) - math.sin(lat1)*math.cos(lat2)*math.cos(delta)
    return math.degrees(math.atan2(x, y))


def _turn_difference(first, second):
    return (second - first + 180) % 360 - 180


def _haversine(a, b):
    r = 6371008.8
    lat1, lat2 = math.radians(a[1]), math.radians(b[1])
    dp, dl = lat2-lat1, math.radians(b[0]-a[0])
    h = math.sin(dp/2)**2 + math.cos(lat1)*math.cos(lat2)*math.sin(dl/2)**2
    return 2*r*math.asin(min(1.0, math.sqrt(h)))


def graph_maneuvers(*, portions, segments, total_m, db_connection):
    """Return conservative junction guidance or [] if any evidence is missing.

    portions: [(directed_state_id, start_fraction, end_fraction)]
    segments: [(directed_coordinates, verified_length_m)]
    """
    if not portions or len(portions) != len(segments) or len(portions) > 20000:
        return []
    if not math.isfinite(total_m) or total_m < 0:
        return []
    ids = sorted({int(p[0]) // 2 for p in portions})
    with db_connection.cursor() as cursor:
        cursor.execute(TOPOLOGY_SQL, [ids])
        rows = cursor.fetchall()
    edges = {}
    for row in rows:
        if len(row) < 4 or any(value is None for value in row[:4]):
            return []
        eid, wid, source, target = (int(v) for v in row[:4])
        if eid in edges:
            return []
        edges[eid] = (wid, source, target)
    if any(eid not in edges for eid in ids):
        return []

    result = []
    cumulative = 0.0
    for i in range(len(portions)-1):
        state = int(portions[i][0]); next_state = int(portions[i+1][0])
        road_a = edges[state//2]; road_b = edges[next_state//2]
        line_a, length_a = segments[i]
        line_b, length_b = segments[i+1]
        if (len(line_a) < 2 or len(line_b) < 2 or
            not math.isfinite(length_a) or length_a < 0 or
            not math.isfinite(length_b) or length_b < 0):
            return []
        cumulative += length_a
        # Verify actual graph-node continuity, not only drawn geometry.
        end_node = road_a[1] if state % 2 else road_a[2]
        start_node = road_b[2] if next_state % 2 else road_b[1]
        if end_node != start_node or _haversine(line_a[-1], line_b[0]) > 3.0:
            return []
        # Do not call a bend in the same way a 'turn'.
        if road_a[0] == road_b[0]:
            continue
        # Bearings use last/first actual distinct metres, never route-wide polyline curvature.
        incoming = next((p for p in reversed(line_a[:-1]) if _haversine(p, line_a[-1]) >= 3), None)
        outgoing = next((p for p in line_b[1:] if _haversine(line_b[0], p) >= 3), None)
        if incoming is None or outgoing is None:
            continue
        angle = _turn_difference(_bearing(incoming, line_a[-1]),
                                 _bearing(line_b[0], outgoing))
        if not math.isfinite(angle) or abs(angle) < 40 or abs(angle) > 145:
            continue
        # Clockwise positive -> right; anticlockwise -> left.
        result.append({"kind": "turn", "modifier": "right" if angle > 0 else "left",
                       "distance_from_start_m": round(min(total_m, cumulative), 2),
                       "street_name": None})
        if len(result) >= 498:
            break
    # Arrival is the verified end of the route, not a guessed manoeuvre.
    if total_m > 0:
        result.append({"kind": "arrive", "modifier": None,
                       "distance_from_start_m": round(total_m, 2), "street_name": None})
    return result
