/** C14-P3: conservative native GPS motion classification.
 * Native speed is corroborating evidence, NEVER movement proof on its own.
 * No synthetic GPS coordinate, inertial estimate, or route snap is produced here.
 */
import { pointDistanceM, type MotionGateState, type NavigationPoint } from "./viago-navigation-position";

export type NativeMotionSample = {
  point: NavigationPoint;
  at: number;
  accuracyM: number;
  speedMps: number | null;
};

function initial(sample: NativeMotionSample): MotionGateState {
  return {
    anchor: sample.point, anchorAt: sample.at, anchorAccuracyM: sample.accuracyM,
    lastAt: sample.at, phase: "uncertain", evidence: 0,
    stableSince: sample.at, stableCount: 0,
  };
}

/**
 * Requires multiple fresh, spatially consistent GPS measurements and native
 * velocity. Do not interpret null Android speed as a zero-velocity reading.
 * Data with >25 m horizontal uncertainty stays uncertain (visual hold).
 */
export function updateNativeMotionGate(
  previous: MotionGateState | null,
  sample: NativeMotionSample,
): MotionGateState {
  const { point, at, accuracyM, speedMps } = sample;
  if (!Number.isFinite(at) || !Number.isFinite(point.lat) ||
      !Number.isFinite(point.lng) || Math.abs(point.lat) > 90 ||
      Math.abs(point.lng) > 180 || !Number.isFinite(accuracyM) ||
      accuracyM < 0 || accuracyM > 100 ||
      (speedMps !== null && (!Number.isFinite(speedMps) || speedMps < 0))) {
    return previous ?? initial({ ...sample, point: { lat: 0, lng: 0 }, accuracyM: 100 });
  }
  if (!previous || at - previous.lastAt > 20000) return initial(sample);
  if (at <= previous.lastAt) return previous;

  // A poor fix cannot confirm movement or stop; preserve existing anchor.
  if (accuracyM > 25 || previous.anchorAccuracyM > 25) {
    return {
      ...previous, lastAt: at, phase: "uncertain", evidence: 0,
      stableCount: 0, stableSince: at,
      candidateDisplacementM: undefined, candidateBearing: undefined,
      // Recover only the reference, not the displayed vehicle, when GPS improves.
      ...(accuracyM <= 25 && previous.anchorAccuracyM > 25 ? {
        anchor: point, anchorAt: at, anchorAccuracyM: accuracyM,
      } : {}),
    };
  }

  const elapsed = (at - previous.anchorAt) / 1000;
  const drift = pointDistanceM(previous.anchor, point);
  const quietRadius = Math.max(9, Math.min(18, Math.max(accuracyM, previous.anchorAccuracyM)));
  const accurate = accuracyM <= 20 && previous.anchorAccuracyM <= 20;
  const speedZero = speedMps !== null && speedMps <= 0.45;
  const speedMoving = speedMps !== null && speedMps >= 2.5;
  const plausible = drift <= Math.max(0, elapsed) * 45 + accuracyM + previous.anchorAccuracyM;
  const coherentTravel = accurate && speedMoving && plausible && elapsed >= 3 &&
    drift >= Math.max(18, 1.7 * (accuracyM + previous.anchorAccuracyM));

  // A confirmed moving state is not stopped by a single zero-speed sample.
  if (previous.phase === "moving") {
    if (speedZero && drift <= quietRadius) {
      const count = previous.stableCount + 1;
      const stableSince = previous.stableCount ? previous.stableSince : at;
      if (count >= 3 && at - stableSince >= 5000) return {
        ...previous, anchor: point, anchorAt: at, anchorAccuracyM: accuracyM,
        lastAt: at, phase: "stationary", evidence: 0,
        stableCount: count, stableSince,
      };
      return { ...previous, lastAt: at, stableCount: count, stableSince };
    }
    if (speedMoving && accurate && plausible) return {
      ...previous, anchor: point, anchorAt: at, anchorAccuracyM: accuracyM,
      lastAt: at, stableCount: 0, stableSince: at,
    };
    return { ...previous, lastAt: at, phase: "uncertain", evidence: 0,
      stableCount: 0, stableSince: at };
  }

  // A stationary claim requires native zero velocity + clustered, separated fixes.
  if (speedZero && drift <= quietRadius) {
    const count = previous.stableCount + 1;
    const stableSince = previous.stableCount ? previous.stableSince : at;
    return {
      ...previous, lastAt: at, stableCount: count, stableSince, evidence: 0,
      phase: count >= 3 && at - stableSince >= 5000 ? "stationary" :
        (previous.phase === "stationary" ? "stationary" : "uncertain"),
      candidateDisplacementM: undefined, candidateBearing: undefined,
    };
  }

  // Native speed without reliable spatial confirmation is untrusted.
  if (!coherentTravel || (previous.candidateDisplacementM !== undefined &&
      drift < previous.candidateDisplacementM + 8)) {
    return { ...previous, lastAt: at, phase: "uncertain", evidence: 0,
      stableCount: 0, stableSince: at,
      candidateDisplacementM: undefined, candidateBearing: undefined };
  }
  const evidence = previous.evidence + 1;
  if (evidence >= 3 && elapsed >= 9) return {
    ...previous, anchor: point, anchorAt: at, anchorAccuracyM: accuracyM,
    lastAt: at, phase: "moving", evidence: 0,
    stableCount: 0, stableSince: at,
    candidateDisplacementM: undefined, candidateBearing: undefined,
  };
  return { ...previous, lastAt: at, phase: "uncertain", evidence,
    candidateDisplacementM: drift, stableCount: 0, stableSince: at };
}
