import type { RouteProgress } from "./viago-progress";
/** G1-P2 — GPS-backed, conservative manoeuvre guidance. No inferred turns. */
export type ConfirmedGuidanceProgress = {
  travelledMeters: number;
  remainingMeters: number;
  at: number;
};

type GuidanceInput = {
  maneuvers: readonly { distanceFromStartM: number }[];
  gpsSignal: "idle" | "waiting" | "valid" | "imprecise" | "stale" | "invalid";
  motionPhase: "moving" | "stationary" | "uncertain";
  routeProgress: RouteProgress | null;
  lastConfirmed: ConfirmedGuidanceProgress | null;
  nowMs: number;
};

type GuidanceResult = {
  mode: "live" | "held" | "planned" | "unconfirmed";
  nextIndex: number;
  metersToTurn: number | null;
  remainingMeters: number | null;
};

/**
 * LIVE: current accepted road match. HELD: the last accepted match at rest,
 * never advanced by GPS drift. PLANNED: route-start estimate BEFORE a match.
 * UNCONFIRMED: no numeric countdown when a previous lock was lost.
 *
 * The input manoeuvres already passed the backend contract validator.
 */
export function deriveViagoGuidance(input: GuidanceInput): GuidanceResult {
  const { maneuvers, gpsSignal, motionPhase, routeProgress, lastConfirmed, nowMs } = input;
  const live = gpsSignal === "valid" && routeProgress?.status === "on_route" &&
    Number.isFinite(routeProgress.travelledMeters) && routeProgress.travelledMeters >= 0 &&
    Number.isFinite(routeProgress.remainingMeters) && routeProgress.remainingMeters >= 0
      ? routeProgress : null;
  const held = live === null && gpsSignal === "valid" && motionPhase === "stationary" &&
    lastConfirmed !== null && Number.isFinite(lastConfirmed.travelledMeters) &&
    lastConfirmed.travelledMeters >= 0 && Number.isFinite(lastConfirmed.remainingMeters) &&
    lastConfirmed.remainingMeters >= 0 && Number.isFinite(nowMs) &&
    nowMs - lastConfirmed.at >= 0 && nowMs - lastConfirmed.at <= 60000
      ? lastConfirmed : null;
  const beforeFirstLock = lastConfirmed === null &&
    (gpsSignal === "idle" || gpsSignal === "waiting" || gpsSignal === "valid") &&
    routeProgress?.status !== "off_route";
  const mode: GuidanceResult["mode"] = live !== null ? "live"
    : held !== null ? "held" : beforeFirstLock ? "planned" : "unconfirmed";
  // After a lost fix, retain only the *identity* of the upcoming verified turn,
  // not a fake metric countdown.
  const anchor = live?.travelledMeters ?? held?.travelledMeters ??
    lastConfirmed?.travelledMeters ?? 0;
  const nextIndex = maneuvers.findIndex((m) =>
    Number.isFinite(m.distanceFromStartM) && m.distanceFromStartM >= anchor - 10
  );
  const reference = live?.travelledMeters ?? held?.travelledMeters ??
    (mode === "planned" ? 0 : null);
  const metersToTurn = nextIndex >= 0 && reference !== null
    ? Math.max(0, Math.round(maneuvers[nextIndex].distanceFromStartM - reference))
    : null;
  const remainingMeters = live?.remainingMeters ?? held?.remainingMeters ?? null;
  return { mode, nextIndex, metersToTurn, remainingMeters };
}

/**
 * Fallback speed from TWO independently accepted positions on the same route.
 * This is never invoked to unlock GPS movement or promote a raw GPS fix.
 * Missing, stale, implausible or sub-accuracy progress => no speed displayed.
 */
export function confirmedRouteSpeedKmh(
  previous: { meters: number; at: number } | null,
  current: { travelledMeters: number; at: number },
  accuracyM: number,
  maxSpeedMps: number,
): number | null {
  if (!previous || !Number.isFinite(previous.meters) || previous.meters < 0 ||
      !Number.isFinite(previous.at) || !Number.isFinite(current.travelledMeters) ||
      current.travelledMeters < 0 || !Number.isFinite(current.at) ||
      !Number.isFinite(accuracyM) || accuracyM < 0 ||
      !Number.isFinite(maxSpeedMps) || maxSpeedMps <= 0) return null;
  const seconds = (current.at - previous.at) / 1000;
  const gained = current.travelledMeters - previous.meters;
  if (seconds < 1.5 || seconds > 20 || !Number.isFinite(gained) ||
      gained < Math.max(6, accuracyM * 0.5)) return null;
  const metersPerSecond = gained / seconds;
  if (metersPerSecond < 0.5 || metersPerSecond > maxSpeedMps) return null;
  return Math.round(metersPerSecond * 3.6);
}
