// Stockage serveur des signalements Viago (type Waze) : fichier JSON LOCAL, nouveau, hors de toute base existante.
// Aucune donnee personnelle : l'identifiant d'appareil est hache, l'adresse IP n'est jamais enregistree.
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import path from "node:path";

export const ALERT_TYPES = {
  police: { ttlMs: 2 * 3600e3 },
  accident: { ttlMs: 3 * 3600e3 },
  traffic: { ttlMs: 1 * 3600e3 },
  pothole: { ttlMs: 7 * 24 * 3600e3 },
  flood: { ttlMs: 12 * 3600e3 },
  blocked: { ttlMs: 12 * 3600e3 },
  bad_track: { ttlMs: 3 * 24 * 3600e3 },
  local_access: { ttlMs: 3 * 24 * 3600e3 },
  unpaved: { ttlMs: 30 * 24 * 3600e3 },
  no_car: { ttlMs: 14 * 24 * 3600e3 },
  bridge: { ttlMs: 14 * 24 * 3600e3 },
  hazard: { ttlMs: 6 * 3600e3 },
} as const;
export type AlertType = keyof typeof ALERT_TYPES;

export type StoredAlert = {
  id: string;
  type: AlertType;
  lat: number;
  lng: number;
  createdAt: number;
  expiresAt: number;
  voters: Record<string, "still" | "gone">; // identifiant d'appareil hache -> vote
};
export type PublicAlert = Omit<StoredAlert, "voters"> & { confirms: number; denies: number };

const GUINEA = { minLat: 7.1, maxLat: 12.8, minLng: -15.2, maxLng: -7.6 };
const MAX_ALERTS = 5000;
const DEDUPE_RADIUS_M = 120;
const REPORTS_PER_HOUR = 8;

const dir = process.env.VIAGO_ALERTS_DIR || path.resolve(process.cwd(), "..", "..", ".viago-data");
const file = path.join(dir, "alerts.json");

let alerts: StoredAlert[] | null = null;

function load(): StoredAlert[] {
  if (alerts) return alerts;
  try {
    if (existsSync(file)) {
      const parsed = JSON.parse(readFileSync(file, "utf-8")) as { alerts?: StoredAlert[] };
      alerts = Array.isArray(parsed.alerts) ? parsed.alerts : [];
    } else alerts = [];
  } catch {
    alerts = [];
  }
  return alerts;
}

function persist(): void {
  try {
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    const tmp = `${file}.tmp`;
    writeFileSync(tmp, JSON.stringify({ version: 1, alerts: load() }), "utf-8");
    renameSync(tmp, file); // ecriture atomique
  } catch {
    /* stockage indisponible : les signalements restent en memoire jusqu'au redemarrage */
  }
}

function purge(now: number): void {
  const list = load();
  const kept = list.filter((a) => a.expiresAt > now);
  if (kept.length !== list.length) { alerts = kept; persist(); }
}

export function hashDevice(deviceId: string): string {
  return createHash("sha256").update(`viago:${deviceId}`).digest("hex").slice(0, 16);
}

function distanceM(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const R = 6371008.8, rad = Math.PI / 180;
  const dLat = (bLat - aLat) * rad, dLng = (bLng - aLng) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(aLat * rad) * Math.cos(bLat * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

function toPublic(a: StoredAlert): PublicAlert {
  const votes = Object.values(a.voters);
  const { voters: _voters, ...rest } = a;
  void _voters;
  return { ...rest, confirms: votes.filter((v) => v === "still").length, denies: votes.filter((v) => v === "gone").length };
}

export function inGuinea(lat: number, lng: number): boolean {
  return Number.isFinite(lat) && Number.isFinite(lng) &&
    lat >= GUINEA.minLat && lat <= GUINEA.maxLat && lng >= GUINEA.minLng && lng <= GUINEA.maxLng;
}

export function listAlerts(bbox: { minLat: number; minLng: number; maxLat: number; maxLng: number }): PublicAlert[] {
  const now = Date.now();
  purge(now);
  return load()
    .filter((a) => a.lat >= bbox.minLat && a.lat <= bbox.maxLat && a.lng >= bbox.minLng && a.lng <= bbox.maxLng)
    .slice(0, 300)
    .map(toPublic);
}

const reportLog = new Map<string, number[]>();

export function createAlert(input: { type: AlertType; lat: number; lng: number; device: string }):
  { ok: true; alert: PublicAlert; merged: boolean } | { ok: false; reason: "rate_limited" | "store_full" } {
  const now = Date.now();
  purge(now);
  const device = hashDevice(input.device);
  const recent = (reportLog.get(device) ?? []).filter((t) => now - t < 3600e3);
  if (recent.length >= REPORTS_PER_HOUR) return { ok: false, reason: "rate_limited" };
  recent.push(now);
  reportLog.set(device, recent);

  const list = load();
  const twin = list.find((a) => a.type === input.type && distanceM(a.lat, a.lng, input.lat, input.lng) <= DEDUPE_RADIUS_M);
  if (twin) {
    // Meme signalement deja la : c'est une confirmation, pas un doublon.
    twin.voters[device] = "still";
    twin.expiresAt = Math.max(twin.expiresAt, now + ALERT_TYPES[twin.type].ttlMs / 2);
    persist();
    return { ok: true, alert: toPublic(twin), merged: true };
  }
  if (list.length >= MAX_ALERTS) return { ok: false, reason: "store_full" };
  const alert: StoredAlert = {
    id: `${now.toString(36)}${Math.random().toString(36).slice(2, 8)}`,
    type: input.type, lat: input.lat, lng: input.lng,
    createdAt: now, expiresAt: now + ALERT_TYPES[input.type].ttlMs,
    voters: { [device]: "still" },
  };
  list.push(alert);
  persist();
  return { ok: true, alert: toPublic(alert), merged: false };
}

export function voteAlert(id: string, deviceId: string, vote: "still" | "gone"): PublicAlert | null | "removed" {
  const now = Date.now();
  purge(now);
  const list = load();
  const alert = list.find((a) => a.id === id);
  if (!alert) return null;
  alert.voters[hashDevice(deviceId)] = vote;
  const votes = Object.values(alert.voters);
  const gone = votes.filter((v) => v === "gone").length;
  const still = votes.length - gone;
  if (gone >= 3 && gone > still) {
    alerts = list.filter((a) => a.id !== id);
    persist();
    return "removed";
  }
  if (vote === "still") alert.expiresAt = Math.max(alert.expiresAt, now + ALERT_TYPES[alert.type].ttlMs / 2);
  persist();
  return toPublic(alert);
}
