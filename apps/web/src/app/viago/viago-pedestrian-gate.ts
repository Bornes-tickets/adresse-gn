/** VIAGO G1-P4-P2: conservative walking confirmation independent of car motion.
 *
 * Raw fixes can be visualised separately with their accuracy. This module ONLY
 * confirms distance guidance after corroborated forward movement on a
 * non-ambiguous route. No fabricated speed, turn or route geometry.
 */
type Point = { lat: number; lng: number };
type FootFix = {
  at: number;
  point: Point;
  accuracyM: number;
  travelledM: number;
};
export type PedestrianGateState = {
  anchor: FootFix | null;
  last: FootFix | null;
  lastAccepted: FootFix | null;
  samples: number;
  phase: "uncertain" | "stationary" | "moving";
  slowSince: number | null;
};
export type PedestrianSample = {
  at: number;
  point: Point;
  accuracyM: number;
  speedMps: number | null;
  travelledM: number | null;
};

export function freshPedestrianGate(): PedestrianGateState {
  return { anchor: null, last: null, lastAccepted: null,
    samples: 0, phase: "uncertain", slowSince: null };
}

function groundDistanceM(a: Point, b: Point): number {
  const dy = (b.lat - a.lat) * 111195;
  const dx = (b.lng - a.lng) * 111195 * Math.cos((a.lat + b.lat) * Math.PI / 360);
  return Math.hypot(dx, dy);
}

function finitePoint(p: Point): boolean {
  return Number.isFinite(p.lat) && Number.isFinite(p.lng) &&
    Math.abs(p.lat) <= 90 && Math.abs(p.lng) <= 180;
}

/** "confirmed" means THIS fix may advance the manoeuvre countdown.
 * It is intentionally not returned for a stationary/uncertain GPS sample.
 */
export function nextPedestrianGate(
  old: PedestrianGateState,
  sample: PedestrianSample,
): { state: PedestrianGateState; confirmed: boolean } {
  const { at, point, accuracyM, travelledM } = sample;
  const speed = sample.speedMps;
  const valid = Number.isFinite(at) && at >= 0 && finitePoint(point) &&
    Number.isFinite(accuracyM) && accuracyM >= 0 && accuracyM <= 50 &&
    travelledM !== null && Number.isFinite(travelledM) && travelledM >= 0 &&
    (speed === null || (Number.isFinite(speed) && speed >= 0 && speed <= 4));
  if (!valid) {
    return { state: { ...old, phase: "uncertain", anchor: null, last: null,
      samples: 0, slowSince: null }, confirmed: false };
  }
  if (old.last && at <= old.last.at) return { state: old, confirmed: false };
  const fix: FootFix = { at, point, accuracyM, travelledM: travelledM! };
  if (!old.anchor || !old.last || at - old.last.at > 25000) {
    return { state: { ...old, anchor: fix, last: fix, samples: 1,
      phase: "uncertain", slowSince: null }, confirmed: false };
  }
  const count = old.samples + 1;
  const baseline = old.lastAccepted ?? old.anchor;
  const seconds = (at - baseline.at) / 1000;
  const gained = travelledM! - baseline.travelledM;
  const geo = groundDistanceM(baseline.point, point);
  const previousGain = travelledM! - old.last.travelledM;
  // A backward road snap or a geographically impossible jump breaks the chain.
  if (previousGain < -Math.max(8, accuracyM * 0.35) ||
      geo > 4 * seconds + Math.max(15, accuracyM * 1.5) ||
      gained < -Math.max(8, accuracyM * 0.35)) {
    return { state: { ...old, anchor: fix, last: fix, samples: 1,
      phase: "uncertain", slowSince: null }, confirmed: false };
  }
  const lowSpeed = speed !== null && speed < 0.4;
  const slowSince = lowSpeed ? (old.slowSince ?? at) : null;
  if (slowSince !== null && at - slowSince >= 5000) {
    return { state: { ...old, anchor: fix, last: fix, samples: 1,
      phase: "stationary", slowSince }, confirmed: false };
  }

  const hasSpeedEvidence = speed !== null && speed >= 0.55 && speed <= 4;
  const minTravel = Math.max(hasSpeedEvidence ? 20 : 32,
    accuracyM * (hasSpeedEvidence ? 1.15 : 1.8));
  const minGeo = Math.max(hasSpeedEvidence ? 15 : 24,
    accuracyM * (hasSpeedEvidence ? 0.7 : 1.2));
  const minSeconds = hasSpeedEvidence ? 8 : 15;
  const minSamples = hasSpeedEvidence ? 3 : 4;
  const plausibleAdvance = gained > 0 && seconds > 0 &&
    gained / seconds >= 0.35 && gained / seconds <= 4 &&
    gained <= 4 * seconds + Math.min(accuracyM, 16);
  const ready = count >= minSamples && seconds >= minSeconds &&
    geo >= minGeo && gained >= minTravel && plausibleAdvance &&
    (hasSpeedEvidence || speed === null);
  if (ready) {
    return { state: { anchor: fix, last: fix, lastAccepted: fix,
      samples: 1, phase: "moving", slowSince: null }, confirmed: true };
  }
  return { state: { ...old, last: fix, samples: count,
    slowSince, phase: old.phase === "moving" ? "moving" : "uncertain" },
    confirmed: false };
}
