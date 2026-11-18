/** G1-P4 — Conservative native GPS off-route confirmation (pure and deterministic).
 * Never infer a road, maneuver, or position from this gate. The backend must
 * return an actual routable geometry before replacing the current route.
 */
export type OffRouteGate = {
  consecutive: number;
  sinceMs: number | null;
  previousAt: number | null;
  lastAttemptAt: number | null;
};
export type OffRouteSample = {
  at: number;
  accuracyM: number;
  lateralMeters: number | null;
  status: string;
  moving: boolean;
};

export function freshOffRouteGate(): OffRouteGate {
  return { consecutive: 0, sinceMs: null, previousAt: null, lastAttemptAt: null };
}

export function nextOffRouteGate(
  gate: OffRouteGate,
  sample: OffRouteSample,
): { state: OffRouteGate; shouldReroute: boolean } {
  const cooldownMs = 90000;
  const clear = (): OffRouteGate => ({ ...gate, consecutive: 0, sinceMs: null, previousAt: sample.at });
  // Require at least 55m separation from the route, with <=20m accuracy,
  // plus motion already corroborated by the existing native movement gate.
  const reliable = sample.moving && sample.status === "off_route" &&
    Number.isFinite(sample.at) && sample.at >= 0 &&
    Number.isFinite(sample.accuracyM) && sample.accuracyM >= 0 && sample.accuracyM <= 20 &&
    sample.lateralMeters !== null && Number.isFinite(sample.lateralMeters) &&
    sample.lateralMeters >= Math.max(55, sample.accuracyM * 2.5);
  if (gate.previousAt !== null && (!Number.isFinite(sample.at) || sample.at <= gate.previousAt)) {
    return { state: gate, shouldReroute: false };
  }
  if (!reliable) return { state: clear(), shouldReroute: false };
  const continuous = gate.previousAt !== null && sample.at - gate.previousAt <= 15000 &&
    gate.sinceMs !== null;
  const sinceMs = continuous ? gate.sinceMs! : sample.at;
  const consecutive = continuous ? gate.consecutive + 1 : 1;
  const cooled = gate.lastAttemptAt === null || sample.at - gate.lastAttemptAt >= cooldownMs;
  const ready = consecutive >= 3 && sample.at - sinceMs >= 5000 && cooled;
  return {
    state: {
      consecutive: ready ? 0 : consecutive,
      sinceMs: ready ? null : sinceMs,
      previousAt: sample.at,
      lastAttemptAt: ready ? sample.at : gate.lastAttemptAt,
    },
    shouldReroute: ready,
  };
}
