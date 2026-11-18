/** G1-P4-P3: conservative trip summary. Never manufactures unverified progress. */
export type ViagoTripEstimateInput = {
  routeDistanceM: number | null;
  routeDurationS: number | null;
  routeArrivalAtMs: number | null;
  guidanceMode: "live" | "held" | "planned" | "unconfirmed";
  liveRemainingM: number | null;
  lastConfirmed: { remainingMeters: number; at: number } | null;
  nowMs: number;
};

export type ViagoTripEstimate = {
  remainingMeters: number | null;
  durationS: number | null;
  arrivalAtMs: number | null;
  source: "live" | "last_confirmed" | "planned" | "unknown";
};

const HOLD_CONFIRMED_METRICS_MS = 120000;

function nonnegative(value: number | null): number | null {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : null;
}

function scaledDuration(remainingM: number, totalM: number | null, totalS: number | null): number | null {
  const distance = nonnegative(totalM);
  const duration = nonnegative(totalS);
  if (distance === null || distance <= 0 || duration === null) return null;
  return Math.max(0, Math.round(duration * Math.min(1, remainingM / distance)));
}

/**
 * LIVE: fresh accepted route progress and an ETA based on current time.
 * LAST_CONFIRMED: last accepted progress, frozen in time for at most 120 seconds.
 * PLANNED: original server estimate before any route lock.
 * UNKNOWN: original distance labelled as initial; server duration/ETA kept as indicative.
 */
export function deriveViagoTripEstimate(input: ViagoTripEstimateInput): ViagoTripEstimate {
  const { routeDistanceM, routeDurationS, routeArrivalAtMs, guidanceMode,
    liveRemainingM, lastConfirmed, nowMs } = input;
  const initialM = nonnegative(routeDistanceM);
  const remainingLive = nonnegative(liveRemainingM);
  const validNow = Number.isFinite(nowMs) && nowMs > 0;

  if (guidanceMode === "live" && remainingLive !== null) {
    const durationS = scaledDuration(remainingLive, initialM, routeDurationS);
    return { remainingMeters: remainingLive, durationS,
      arrivalAtMs: durationS !== null && validNow ? nowMs + durationS * 1000 : null,
      source: "live" };
  }

  const lastRemaining = nonnegative(lastConfirmed?.remainingMeters ?? null);
  const lastAt = lastConfirmed?.at ?? NaN;
  if (guidanceMode !== "planned" && validNow && Number.isFinite(lastAt) &&
      nowMs >= lastAt && nowMs - lastAt <= HOLD_CONFIRMED_METRICS_MS &&
      lastAt > 0 && lastRemaining !== null) {
    const durationS = scaledDuration(lastRemaining, initialM, routeDurationS);
    // Snapshot arrival is NOT recomputed from nowMs while GPS lock is lost.
    return { remainingMeters: lastRemaining, durationS,
      arrivalAtMs: durationS !== null ? lastAt + durationS * 1000 : null,
      source: "last_confirmed" };
  }

  if (guidanceMode === "planned") {
    return { remainingMeters: initialM, durationS: nonnegative(routeDurationS),
      arrivalAtMs: nonnegative(routeArrivalAtMs), source: "planned" };
  }
  // GPS not confirmed (e.g. desktop browser, poor fix): show the SERVER estimate,
  // clearly indicative, instead of nothing. Never recomputed from "now".
  return { remainingMeters: initialM, durationS: nonnegative(routeDurationS),
    arrivalAtMs: nonnegative(routeArrivalAtMs), source: "unknown" };
}
