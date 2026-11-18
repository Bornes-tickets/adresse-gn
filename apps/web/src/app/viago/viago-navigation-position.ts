/** Navigation-only position helpers. GPS observations are never fabricated. */
export type NavigationPoint = { lat: number; lng: number };
const EARTH_M = 6371008.8;
const rad = (n: number) => n * Math.PI / 180;

export function pointDistanceM(a: NavigationPoint, b: NavigationPoint): number {
  const dLat = rad(b.lat - a.lat);
  const dLon = rad(b.lng - a.lng);
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_M * Math.atan2(Math.sqrt(x), Math.sqrt(Math.max(0, 1 - x)));
}

export function movementBearing(a: NavigationPoint, b: NavigationPoint): number {
  const dl = rad(b.lng - a.lng);
  const y = Math.sin(dl) * Math.cos(rad(b.lat));
  const x = Math.cos(rad(a.lat)) * Math.sin(rad(b.lat)) - Math.sin(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.cos(dl);
  return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
}

export function smoothBearing(previous: number | null, next: number): number {
  if (!Number.isFinite(next)) return previous ?? 0;
  const normalized = ((next % 360) + 360) % 360;
  if (previous === null || !Number.isFinite(previous)) return normalized;
  const delta = ((normalized - previous + 540) % 360) - 180;
  return (previous + delta * 0.35 + 360) % 360;
}

/** Choose a point only near the *confirmed* route progress; never use an ambiguous snap. */
export function snappedPosition(
  route: readonly NavigationPoint[], raw: NavigationPoint,
  confirmedDistanceM: number, accuracyM: number,
): NavigationPoint | null {
  if (route.length < 2 || !Number.isFinite(accuracyM) || accuracyM > 50 || accuracyM < 0 ||
      !Number.isFinite(confirmedDistanceM)) return null;
  const latScale = EARTH_M;
  const lonScale = EARTH_M * Math.cos(rad(raw.lat));
  let travelled = 0;
  let best: { point: NavigationPoint; lateral: number } | null = null;
  for (let i = 0; i < route.length - 1; i++) {
    const a = route[i], b = route[i + 1];
    const length = pointDistanceM(a, b);
    if (!Number.isFinite(length) || length < 0.01) { travelled += Math.max(0, length); continue; }
    const ax = rad(a.lng - raw.lng) * lonScale, ay = rad(a.lat - raw.lat) * latScale;
    const dx = rad(b.lng - a.lng) * lonScale, dy = rad(b.lat - a.lat) * latScale;
    const t = Math.max(0, Math.min(1, -(ax * dx + ay * dy) / (dx * dx + dy * dy)));
    const along = travelled + length * t;
    const lateral = Math.hypot(ax + t * dx, ay + t * dy);
    if (Math.abs(along - confirmedDistanceM) <= 30 &&
        lateral <= Math.min(accuracyM * 1.5, 30) &&
        (best === null || lateral < best.lateral)) {
      best = { point: { lat: a.lat + t * (b.lat - a.lat), lng: a.lng + t * (b.lng - a.lng) }, lateral };
    }
    travelled += length;
  }
  return best?.point ?? null;
}


export type RouteObservation = {
  point: NavigationPoint;
  accuracyM: number;
  travelledM: number;
  at: number;
};

/** Retain a bounded monotonic history of verified on-route GPS observations. */
export function appendRouteObservation(
  previous: readonly RouteObservation[], next: RouteObservation,
): RouteObservation[] {
  if (!Number.isFinite(next.at) || !Number.isFinite(next.travelledM) ||
      !Number.isFinite(next.accuracyM) || next.accuracyM < 0 || next.accuracyM > 50 ||
      !Number.isFinite(next.point.lat) || !Number.isFinite(next.point.lng)) return [...previous];
  const recent = previous.filter(o => next.at > o.at && next.at - o.at <= 15000).slice(-3);
  return [...recent, next];
}

/**
 * Visual-only route snap: two independent, plausible observations are needed.
 * Authoritative maneuver progression remains in matchRouteProgress and is not
 * advanced here. In ambiguous cases the caller displays the raw GPS point.
 */
export function corroboratedRoutePosition(
  route: readonly NavigationPoint[], raw: NavigationPoint,
  confirmedDistanceM: number, accuracyM: number,
  observations: readonly RouteObservation[],
): NavigationPoint | null {
  const candidate = snappedPosition(route, raw, confirmedDistanceM, accuracyM);
  if (!candidate || observations.length < 2) return null;
  const newest = observations[observations.length - 1];
  const prior = observations[observations.length - 2];
  if (!newest || !prior || newest.at <= prior.at || newest.at - prior.at > 15000) return null;
  const elapsed = (newest.at - prior.at) / 1000;
  const travelledDelta = newest.travelledM - prior.travelledM;
  if (travelledDelta < -15 || travelledDelta > elapsed * 38 + 30) return null;
  const physicalDistance = pointDistanceM(prior.point, newest.point);
  if (physicalDistance > elapsed * 38 + Math.max(prior.accuracyM, newest.accuracyM) * 2 + 20) return null;
  if (Math.abs(newest.travelledM - confirmedDistanceM) > 5) return null;
  return candidate;
}

/**
 * C13 P1: Conservative camera-only fusion. GPS and route progress remain authoritative.
 * A single suspicious jump cannot teleport the displayed vehicle. The camera estimate
 * expires after 12 seconds; this function never extrapolates a missing GPS fix.
 */
export type VisualGpsFix = { point: NavigationPoint; at: number; accuracyM: number };
export function fuseVisualGpsFix(
  previous: VisualGpsFix | null,
  candidate: VisualGpsFix,
): VisualGpsFix | null {
  const { point, at, accuracyM } = candidate;
  if (!Number.isFinite(point.lat) || !Number.isFinite(point.lng) ||
      Math.abs(point.lat) > 90 || Math.abs(point.lng) > 180 ||
      !Number.isFinite(at) || !Number.isFinite(accuracyM) ||
      accuracyM < 0 || accuracyM > 100) return null;
  if (!previous) return candidate;
  const elapsed = (at - previous.at) / 1000;
  if (elapsed <= 0) return previous;
  if (elapsed > 12) return candidate;
  const separation = pointDistanceM(previous.point, point);
  // 50 m/s generous upper driving bound + uncertainty of both fixes.
  if (separation > 50 * elapsed + previous.accuracyM + accuracyM) return previous;
  // At real road speeds use more of the current observation; at low speeds
  // suppress small independent jitter. This never affects map matching.
  const blend = Math.min(1, Math.max(0.25, elapsed / 3));
  return {
    point: {
      lat: previous.point.lat + (point.lat - previous.point.lat) * blend,
      lng: previous.point.lng + (point.lng - previous.point.lng) * blend,
    },
    at,
    accuracyM,
  };
}

/**
 * C13-P2: Conservative three-state motion inference. Browser GPS alone cannot
 * prove actual movement or a true stop. Report uncertain until consecutive,
 * temporally separated observations corroborate an event.
 * This state machine is for HUD/camera gating; it never emits route progress.
 */
export type MotionPhase = "uncertain" | "stationary" | "moving";
export type MotionGateState = {
  anchor: NavigationPoint;
  anchorAt: number;
  anchorAccuracyM: number;
  lastAt: number;
  phase: MotionPhase;
  evidence: number;
  stableSince: number;
  stableCount: number;
  candidateDisplacementM?: number;
  candidateBearing?: number;
};
export function updateMotionGate(
  previous: MotionGateState | null,
  sample: { point: NavigationPoint; at: number; accuracyM: number },
): MotionGateState {
  const { point, at, accuracyM } = sample;
  const valid = Number.isFinite(at) && Number.isFinite(point.lat) &&
    Number.isFinite(point.lng) && Math.abs(point.lat) <= 90 &&
    Math.abs(point.lng) <= 180 && Number.isFinite(accuracyM) &&
    accuracyM >= 0 && accuracyM <= 50;
  if (!valid) return previous ?? {
    anchor: { lat: 0, lng: 0 }, anchorAt: 0, anchorAccuracyM: 50,
    lastAt: 0, phase: "uncertain", evidence: 0, stableSince: 0, stableCount: 0,
  };
  if (!previous || at - previous.lastAt > 20000) return {
    anchor: point, anchorAt: at, anchorAccuracyM: accuracyM,
    lastAt: at, phase: "uncertain", evidence: 0, stableSince: at, stableCount: 1,
  };
  if (at <= previous.lastAt) return previous;

  // C13-P2-A-R4: With a horizontal uncertainty above 25 m, sequential
  // browser positions cannot reliably distinguish motion from drift. A
  // directionally coherent GPS error is NOT evidence that a car moved.
  // Hold the last visual vehicle position and never expose browser speed
  // as driving speed until the fix is suitable for motion confirmation.
  if (accuracyM > 25 || previous.anchorAccuracyM > 25) {
    return {
      ...previous, lastAt: at, phase: "uncertain", evidence: 0,
      stableSince: at, stableCount: 0,
      candidateBearing: undefined, candidateDisplacementM: undefined,
      // Refresh the reference only when transitioning from a low-quality
      // anchor; do not move the displayed vehicle (held by MapLibre).
      anchor: previous.anchorAccuracyM > 25 ? point : previous.anchor,
      anchorAt: previous.anchorAccuracyM > 25 ? at : previous.anchorAt,
      anchorAccuracyM: previous.anchorAccuracyM > 25 ? accuracyM : previous.anchorAccuracyM,
    };
  }

  const elapsed = (at - previous.anchorAt) / 1000;
  const displacement = pointDistanceM(previous.anchor, point);
  // Small GPS drift should not look like driving, but large uncertainty is
  // not proof of stationary either. Require repeated clustered observations.
  const quietRadius = Math.max(10, Math.min(22, Math.max(previous.anchorAccuracyM, accuracyM) * 0.6));
  const movementThreshold = Math.max(22, Math.min(85, 1.3 * (previous.anchorAccuracyM + accuracyM)));
  const physicallyPlausible = displacement <= elapsed * 45 +
    previous.anchorAccuracyM + accuracyM;
  const stable = displacement <= quietRadius;

  if (previous.phase === "moving") {
    if (!physicallyPlausible) return { ...previous, lastAt: at, phase: "uncertain", evidence: 0,
      stableSince: at, stableCount: 0 };
    if (!stable) return { ...previous, anchor: point, anchorAt: at,
      anchorAccuracyM: accuracyM, lastAt: at, stableSince: at, stableCount: 0 };
    const stableSince = previous.stableCount === 0 ? at : previous.stableSince;
    const stableCount = previous.stableCount + 1;
    if (stableCount >= 3 && at - stableSince >= 6000) return {
      ...previous, lastAt: at, phase: "stationary", evidence: 0,
      stableSince, stableCount,
    };
    return { ...previous, lastAt: at, stableSince, stableCount };
  }

  if (stable) {
    const stableSince = previous.stableCount === 0 ? at : previous.stableSince;
    const stableCount = previous.stableCount + 1;
    if (stableCount >= 3 && at - stableSince >= 5000) return {
      ...previous, lastAt: at, phase: "stationary", evidence: 0,
      stableSince, stableCount,
    };
    return { ...previous, lastAt: at, phase: previous.phase === "stationary" ?
      "stationary" : "uncertain", evidence: 0, stableSince, stableCount };
  }

  if (!physicallyPlausible) return { ...previous, lastAt: at, phase: "uncertain",
    evidence: 0, stableSince: at, stableCount: 0 };

  // Distinguish a moving trajectory from two independent GPS jumps.
  // Require displacements that grow along essentially the same bearing,
  // outside the combined positional-uncertainty envelope.
  // A confidence envelope must exceed both fixes' horizontal errors.
  // Accumulated displacement is a prerequisite, not sufficient evidence.
  const corroborated = elapsed >= 8 && displacement > Math.max(
    45, movementThreshold, 2.2 * (previous.anchorAccuracyM + accuracyM) + 10,
  );
  if (!corroborated) return { ...previous, lastAt: at, evidence: 0,
    candidateBearing: undefined, candidateDisplacementM: undefined,
    phase: previous.phase === "stationary" ? "stationary" : "uncertain",
    stableSince: at, stableCount: 0 };
  const bearing = movementBearing(previous.anchor, point);
  const angleDifference = previous.candidateBearing === undefined ? 0 :
    Math.abs(((bearing - previous.candidateBearing + 540) % 360) - 180);
  const growing = previous.candidateDisplacementM === undefined ||
    displacement >= previous.candidateDisplacementM + Math.max(9, accuracyM * 0.25);
  const coherent = angleDifference <= 35 && growing;
  const evidence = coherent ? previous.evidence + 1 : 1;
  // Four corroborated fixes, each separated by enough new distance, prevent
  // short-lived drift sequences from repeatedly toggling the vehicle state.
  if (evidence >= 4 && elapsed >= 14) return {
    anchor: point, anchorAt: at, anchorAccuracyM: accuracyM,
    lastAt: at, phase: "moving", evidence: 0, stableSince: at, stableCount: 0,
    candidateBearing: undefined, candidateDisplacementM: undefined,
  };
  return { ...previous, lastAt: at, phase: "uncertain", evidence,
    candidateBearing: bearing, candidateDisplacementM: displacement,
    stableSince: at, stableCount: 0 };
}
