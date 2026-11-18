/** C14-P5-P2-C. Opt-in, memory-only GPS quality counters. No coordinate fields. */
import type { ViagoGpsPosition } from "./viago-native-location";

export type GpsTelemetry = {
  startedAt: number;
  observations: number;
  accuracies: number[];
  intervalsMs: number[];
  agesMs: number[];
  speedPresent: number;
  headingPresent: number;
  rejectedAccuracy: number;
  rejectedStale: number;
  rejectedInvalid: number;
  roadAccepted: number;
  roadRejected: number;
  motionStationary: number;
  motionMoving: number;
  motionUncertain: number;
  nativeErrors: number;
  permissionErrors: number;
  restarts: number;
  lastArrival: number | null;
  lastErrorAt: number | null;
};

const LIMIT = 300;
function sample(values: number[], value: number): void {
  if (!Number.isFinite(value)) return;
  values.push(Math.round(value * 10) / 10);
  if (values.length > LIMIT) values.shift();
}
function median(values: number[]): number | null {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return Math.round((sorted.length % 2 ? sorted[mid] : (sorted[mid-1] + sorted[mid]) / 2) * 10) / 10;
}
function avg(values: number[]): number | null {
  return values.length ? Math.round(values.reduce((a, b) => a+b, 0) / values.length * 10) / 10 : null;
}
export function newGpsTelemetry(): GpsTelemetry {
  return { startedAt: Date.now(), observations: 0, accuracies: [], intervalsMs: [], agesMs: [],
    speedPresent: 0, headingPresent: 0, rejectedAccuracy: 0, rejectedStale: 0,
    rejectedInvalid: 0, roadAccepted: 0, roadRejected: 0, motionStationary: 0,
    motionMoving: 0, motionUncertain: 0, nativeErrors: 0, permissionErrors: 0,
    restarts: 0, lastArrival: null, lastErrorAt: null };
}
export function recordGpsSample(t: GpsTelemetry, p: ViagoGpsPosition, receivedAt: number): void {
  t.observations++;
  const c = p.coords;
  sample(t.accuracies, c.accuracy);
  if (t.lastArrival !== null) sample(t.intervalsMs, receivedAt - t.lastArrival);
  t.lastArrival = receivedAt;
  sample(t.agesMs, Math.max(0, receivedAt - p.timestamp));
  if (typeof c.speed === 'number' && Number.isFinite(c.speed)) t.speedPresent++;
  if (typeof c.heading === 'number' && Number.isFinite(c.heading)) t.headingPresent++;
}
export type GpsTelemetryReport = ReturnType<typeof summarizeGpsTelemetry>;
export function summarizeGpsTelemetry(t: GpsTelemetry, now = Date.now()) {
  return {
    schema: 'viago-gps-quality-v1',
    scenario: 'local-opt-in',
    elapsedSec: Math.round(Math.max(0, now - t.startedAt) / 1000),
    observations: t.observations,
    accuracyMedianM: median(t.accuracies),
    accuracyMeanM: avg(t.accuracies),
    accuracyWorstM: t.accuracies.length ? Math.max(...t.accuracies) : null,
    intervalMedianSec: median(t.intervalsMs) === null ? null : Math.round(median(t.intervalsMs)! / 100) / 10,
    ageMedianSec: median(t.agesMs) === null ? null : Math.round(median(t.agesMs)! / 100) / 10,
    speedAvailablePct: t.observations ? Math.round(100 * t.speedPresent / t.observations) : null,
    headingAvailablePct: t.observations ? Math.round(100 * t.headingPresent / t.observations) : null,
    staleNow: t.lastArrival === null ? null : now - t.lastArrival > 15000,
    rejected: { accuracy: t.rejectedAccuracy, stale: t.rejectedStale, invalid: t.rejectedInvalid,
      route: t.roadRejected },
    roadAccepted: t.roadAccepted,
    motion: { stationary: t.motionStationary, moving: t.motionMoving, uncertain: t.motionUncertain },
    nativeErrors: t.nativeErrors,
    permissionErrors: t.permissionErrors,
    restarts: t.restarts,
    privacy: 'Aucune latitude, longitude, trajectoire ou identifiant d’appareil collecté.',
  };
}
