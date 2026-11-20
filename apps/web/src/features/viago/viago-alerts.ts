// Signalements communautaires (type Waze) : types, icones, projection sur l'itineraire. Affichage uniquement.
import type { ViagoPoint } from "./viago-map";

export type AlertType = "police" | "accident" | "traffic" | "pothole" | "flood" | "blocked" | "bad_track" | "local_access" | "unpaved" | "no_car" | "bridge" | "hazard";
export type ViagoAlert = { id: string; type: AlertType; lat: number; lng: number; createdAt: number; expiresAt: number; confirms: number; denies: number };

export const ALERT_META: Record<AlertType, { emoji: string; label: string; spoken: string; color: string }> = {
  police: { emoji: "🚓", label: "Contrôle de police", spoken: "contrôle de police", color: "#2563eb" },
  accident: { emoji: "💥", label: "Accident", spoken: "accident", color: "#dc2626" },
  traffic: { emoji: "🚦", label: "Embouteillage", spoken: "embouteillage", color: "#ea580c" },
  pothole: { emoji: "🕳️", label: "Nid-de-poule", spoken: "nid-de-poule", color: "#7c5a2b" },
  flood: { emoji: "🌊", label: "Route inondée", spoken: "route inondée", color: "#0891b2" },
  blocked: { emoji: "⛔", label: "Route coupée", spoken: "route coupée", color: "#b91c1c" },
  bad_track: { emoji: "🟤", label: "Piste impraticable", spoken: "piste impraticable", color: "#8a5a2b" },
  local_access: { emoji: "🚧", label: "Accès local bloqué", spoken: "accès local bloqué", color: "#d97706" },
  unpaved: { emoji: "🟫", label: "Route non goudronnée", spoken: "route non goudronnée", color: "#a16207" },
  no_car: { emoji: "🚫", label: "Inaccessible en voiture", spoken: "passage inaccessible en voiture", color: "#7f1d1d" },
  bridge: { emoji: "🌉", label: "Pont ou passage endommagé", spoken: "pont ou passage endommagé", color: "#4338ca" },
  hazard: { emoji: "⚠️", label: "Danger", spoken: "danger sur la route", color: "#ca8a04" },
};
export const ALERT_ORDER: AlertType[] = ["police", "accident", "traffic", "pothole", "flood", "blocked", "bad_track", "local_access", "unpaved", "no_car", "bridge", "hazard"];

export function deviceId(): string {
  try {
    const existing = window.localStorage.getItem("viago-device-id");
    if (existing && existing.length >= 8) return existing;
    const fresh = (window.crypto?.randomUUID?.() ?? `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 12)}`);
    window.localStorage.setItem("viago-device-id", fresh);
    return fresh;
  } catch {
    return `session-${Math.random().toString(36).slice(2, 14)}`;
  }
}

/** Pastille ronde coloree avec l'emoji, pour la carte. */
export function renderAlertIcon(type: AlertType): ImageData | null {
  if (typeof document === "undefined") return null;
  const canvas = document.createElement("canvas");
  canvas.width = 96; canvas.height = 96;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.shadowColor = "rgba(0,0,0,0.35)"; ctx.shadowBlur = 6; ctx.shadowOffsetY = 2;
  ctx.beginPath(); ctx.arc(48, 46, 36, 0, Math.PI * 2); ctx.fillStyle = "#ffffff"; ctx.fill();
  ctx.shadowColor = "transparent";
  ctx.beginPath(); ctx.arc(48, 46, 30, 0, Math.PI * 2); ctx.fillStyle = ALERT_META[type].color; ctx.fill();
  ctx.font = "34px 'Apple Color Emoji','Segoe UI Emoji','Noto Color Emoji',sans-serif";
  ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.fillText(ALERT_META[type].emoji, 48, 49);
  return ctx.getImageData(0, 0, 96, 96);
}

export function alertFeatures(alerts: ViagoAlert[]): GeoJSON.FeatureCollection {
  return {
    type: "FeatureCollection",
    features: alerts.map((a) => ({ type: "Feature", properties: { id: a.id, type: a.type }, geometry: { type: "Point", coordinates: [a.lng, a.lat] } })),
  };
}

export function timeAgo(createdAt: number, now = Date.now()): string {
  const min = Math.max(0, Math.round((now - createdAt) / 60000));
  if (min < 1) return "à l’instant";
  if (min < 60) return `il y a ${min} min`;
  const h = Math.round(min / 60);
  return h < 24 ? `il y a ${h} h` : `il y a ${Math.round(h / 24)} j`;
}

/** Signalements situes sur l'itineraire (a moins de maxOffM) devant la position `alongM`, tries par distance. */
export function alertsAhead(route: ViagoPoint[] | null, alerts: ViagoAlert[], alongM: number, maxAheadM = 800, maxOffM = 45):
  { alert: ViagoAlert; aheadM: number }[] {
  if (!route || route.length < 2 || alerts.length === 0) return [];
  const rad = Math.PI / 180, R = 6371008.8;
  const cum = [0];
  for (let i = 1; i < route.length; i++) {
    const dLat = (route[i].lat - route[i - 1].lat) * rad, dLng = (route[i].lng - route[i - 1].lng) * rad;
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(route[i - 1].lat * rad) * Math.cos(route[i].lat * rad) * Math.sin(dLng / 2) ** 2;
    cum.push(cum[i - 1] + 2 * R * Math.asin(Math.min(1, Math.sqrt(h))));
  }
  const out: { alert: ViagoAlert; aheadM: number }[] = [];
  for (const alert of alerts) {
    let best = Infinity, bestAlong = 0;
    const cosLat = Math.cos(alert.lat * rad);
    for (let i = 1; i < route.length; i++) {
      const ax = (route[i - 1].lng - alert.lng) * rad * R * cosLat, ay = (route[i - 1].lat - alert.lat) * rad * R;
      const bx = (route[i].lng - alert.lng) * rad * R * cosLat, by = (route[i].lat - alert.lat) * rad * R;
      const dx = bx - ax, dy = by - ay, len2 = dx * dx + dy * dy;
      const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, -(ax * dx + ay * dy) / len2));
      const d = Math.hypot(ax + t * dx, ay + t * dy);
      if (d < best) { best = d; bestAlong = cum[i - 1] + t * (cum[i] - cum[i - 1]); }
    }
    const ahead = bestAlong - alongM;
    if (best <= maxOffM && ahead >= -20 && ahead <= maxAheadM) out.push({ alert, aheadM: Math.max(0, ahead) });
  }
  return out.sort((a, b) => a.aheadM - b.aheadM);
}
