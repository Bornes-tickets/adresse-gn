/** VIAGO C14-P4-D — conservative on-route ambiguity and progress confirmation.
 * This module never invents coordinates, changes a route, or substitutes routing.
 * A position is only eligible when Android motion has already been confirmed.
 */
export type RoadPoint = { lat: number; lng: number };
export type RoadLockState = {
  confirmedMeters: number | null;
  confirmedAt: number;
  pendingMeters: number | null;
  pendingAt: number;
  pendingCount: number;
};
export type RoadLockInput = {
  route: RoadPoint[];
  raw: RoadPoint;
  accuracyM: number;
  travelledMeters: number | null;
  at: number;
  speedMps: number | null;
  maxSpeedMps: number;
};
export type RoadLockDecision = {
  state: RoadLockState;
  accepted: boolean;
  reason: "gps_uncertain" | "route_ambiguous" | "jump_rejected" | "confirming" | "locked";
};

export function initialRoadLock(): RoadLockState {
  return { confirmedMeters: null, confirmedAt: 0, pendingMeters: null, pendingAt: 0, pendingCount: 0 };
}

function meters(a: RoadPoint, b: RoadPoint): number {
  const lat = ((a.lat + b.lat) / 2) * Math.PI / 180;
  const dx = (b.lng - a.lng) * 111195 * Math.cos(lat);
  const dy = (b.lat - a.lat) * 111195;
  return Math.hypot(dx, dy);
}

/** Detect when different, non-neighboring sections of the *same route* are
 * equally plausible within GPS uncertainty, e.g. tight hairpin/parallel loop.
 * This does NOT compare roads absent from the backend itinerary.
 */
export function routeGeometryAmbiguous(route: RoadPoint[], raw: RoadPoint, accuracyM: number): boolean {
  if (route.length < 3 || !Number.isFinite(accuracyM) || accuracyM < 0) return false;
  const cosLat = Math.cos(raw.lat * Math.PI / 180);
  const radius = Math.max(8, Math.min(40, accuracyM));
  const candidates: Array<{ offset: number; separation: number }> = [];
  let along = 0;
  for (let i = 1; i < route.length; i++) {
    const a = route[i - 1], b = route[i];
    if (![a.lat, a.lng, b.lat, b.lng].every(Number.isFinite)) return true;
    const len = meters(a, b);
    if (!Number.isFinite(len)) return true;
    if (len < 0.05) continue;
    const ax = (a.lng - raw.lng) * 111195 * cosLat;
    const ay = (a.lat - raw.lat) * 111195;
    const bx = (b.lng - raw.lng) * 111195 * cosLat;
    const by = (b.lat - raw.lat) * 111195;
    const vx = bx - ax, vy = by - ay;
    const t = Math.max(0, Math.min(1, -(ax * vx + ay * vy) / (vx * vx + vy * vy)));
    const distance = Math.hypot(ax + t * vx, ay + t * vy);
    if (distance <= radius) candidates.push({ offset: along + t * len, separation: distance });
    along += len;
  }
  candidates.sort((a, b) => a.separation - b.separation);
  if (!candidates.length) return false; // route-match function separately rejects off-route GPS.
  const best = candidates[0];
  // Distinct segments must be far apart *along* the route to count as competing.
  return candidates.some(c => Math.abs(c.offset - best.offset) >= 75 &&
    c.separation <= best.separation + Math.max(5, accuracyM * 0.35));
}

export function updateRoadLock(previous: RoadLockState | null, input: RoadLockInput): RoadLockDecision {
  const earlier = previous ?? initialRoadLock();
  const state = earlier.confirmedAt > 0 &&
    input.at - earlier.confirmedAt > 45000
    ? initialRoadLock() : earlier;
  const { route, raw, accuracyM, travelledMeters, at, speedMps, maxSpeedMps } = input;
  const fail = (reason: RoadLockDecision["reason"]): RoadLockDecision => ({
    state: { ...state, pendingMeters: null, pendingAt: 0, pendingCount: 0 }, accepted: false, reason,
  });
  if (!Number.isFinite(at) || !Number.isFinite(raw.lat) || !Number.isFinite(raw.lng) ||
      !Number.isFinite(accuracyM) || accuracyM < 0 || accuracyM > 25 ||
      travelledMeters === null || !Number.isFinite(travelledMeters) || travelledMeters < 0 ||
      !Number.isFinite(maxSpeedMps) || maxSpeedMps <= 0 ||
      speedMps === null || !Number.isFinite(speedMps) || speedMps < 1.5) {
    return fail("gps_uncertain");
  }
  if (routeGeometryAmbiguous(route, raw, accuracyM)) return fail("route_ambiguous");
  if (state.confirmedMeters !== null) {
    const dt = (at - state.confirmedAt) / 1000;
    if (dt <= 0 || dt > 45 || travelledMeters < state.confirmedMeters - Math.max(10, accuracyM * .5) ||
        travelledMeters > state.confirmedMeters + Math.max(18, dt * maxSpeedMps + accuracyM)) {
      return fail("jump_rejected");
    }
    return {
      state: { confirmedMeters: travelledMeters, confirmedAt: at, pendingMeters: null, pendingAt: 0, pendingCount: 0 },
      accepted: true, reason: "locked",
    };
  }
  // A first plausible point is not enough for a new lock/reacquisition.
  const pendingFresh = state.pendingMeters !== null && at > state.pendingAt && at - state.pendingAt <= 12000;
  const consistent = pendingFresh && travelledMeters >= state.pendingMeters! - Math.max(8, accuracyM * .4) &&
    travelledMeters <= state.pendingMeters! + Math.max(15, (at - state.pendingAt) / 1000 * maxSpeedMps + accuracyM);
  if (!consistent) return {
    state: { ...state, pendingMeters: travelledMeters, pendingAt: at, pendingCount: 1 },
    accepted: false, reason: "confirming",
  };
  return {
    state: { confirmedMeters: travelledMeters, confirmedAt: at, pendingMeters: null, pendingAt: 0, pendingCount: 0 },
    accepted: true, reason: "locked",
  };
}
