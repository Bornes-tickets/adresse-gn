// Revetement de l'itineraire : affichage et avertissements uniquement.
// Donnees OSM partielles : "unknown" n'est jamais presente comme goudronne.
import type { ViagoPoint } from "./viago-map";

export type SurfaceKind = "unpaved" | "probable_unpaved" | "rough";
export type SurfaceSection = { kind: SurfaceKind; startM: number; endM: number };
export type SurfaceInfo = {
  sections: SurfaceSection[];
  unpavedM: number;
  probableM: number;
  roughM: number;
  unknownM: number;
};

// Affichage desactive tant que les donnees de revetement ne sont pas fiables.
export const SHOW_SURFACE = false;

const KINDS: readonly string[] = ["unpaved", "probable_unpaved", "rough"];

function num(v: unknown): number {
  return typeof v === "number" && Number.isFinite(v) && v >= 0 ? v : 0;
}

export function verifiedSurface(payload: unknown): SurfaceInfo | null {
  if (!SHOW_SURFACE || !payload || typeof payload !== "object") return null;
  const p = payload as { sections?: unknown; summary?: unknown };
  if (!Array.isArray(p.sections) || p.sections.length > 2000) return null;
  const sections: SurfaceSection[] = [];
  for (const raw of p.sections) {
    if (!raw || typeof raw !== "object") continue;
    const s = raw as { kind?: unknown; start_m?: unknown; end_m?: unknown };
    if (typeof s.kind !== "string" || !KINDS.includes(s.kind)) continue;
    if (typeof s.start_m !== "number" || typeof s.end_m !== "number") continue;
    if (!Number.isFinite(s.start_m) || !Number.isFinite(s.end_m) || s.end_m <= s.start_m || s.start_m < 0) continue;
    sections.push({ kind: s.kind as SurfaceKind, startM: s.start_m, endM: s.end_m });
  }
  const sum = (p.summary && typeof p.summary === "object" ? p.summary : {}) as Record<string, unknown>;
  return {
    sections,
    unpavedM: num(sum.unpaved), probableM: num(sum.probable_unpaved),
    roughM: num(sum.rough), unknownM: num(sum.unknown),
  };
}

function haversine(a: ViagoPoint, b: ViagoPoint): number {
  const R = 6371008.8, rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad, dLng = (b.lng - a.lng) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Decoupe le trace en tronçons (GeoJSON) pour chaque section de revetement. */
export function surfaceSectionLines(route: ViagoPoint[] | null, info: SurfaceInfo | null, totalM: number | null): GeoJSON.FeatureCollection {
  const empty: GeoJSON.FeatureCollection = { type: "FeatureCollection", features: [] };
  if (!route || route.length < 2 || !info || info.sections.length === 0) return empty;
  const cum = [0];
  for (let i = 1; i < route.length; i++) cum.push(cum[i - 1] + haversine(route[i - 1], route[i]));
  const geo = cum[cum.length - 1];
  if (geo <= 0) return empty;
  const scale = totalM && totalM > 0 ? geo / totalM : 1; // metres serveur -> metres du trace
  const at = (d: number): [number, number] => {
    let i = 1;
    while (i < cum.length - 1 && cum[i] < d) i++;
    const span = cum[i] - cum[i - 1] || 1;
    const t = Math.min(1, Math.max(0, (d - cum[i - 1]) / span));
    return [route[i - 1].lng + (route[i].lng - route[i - 1].lng) * t, route[i - 1].lat + (route[i].lat - route[i - 1].lat) * t];
  };
  const features: GeoJSON.Feature[] = [];
  for (const s of info.sections) {
    const a = Math.min(geo, s.startM * scale), b = Math.min(geo, s.endM * scale);
    if (b - a < 1) continue;
    const coords: [number, number][] = [at(a)];
    for (let i = 0; i < cum.length; i++) if (cum[i] > a && cum[i] < b) coords.push([route[i].lng, route[i].lat]);
    coords.push(at(b));
    features.push({ type: "Feature", properties: { kind: s.kind }, geometry: { type: "LineString", coordinates: coords } });
  }
  return { type: "FeatureCollection", features };
}

function km(m: number): string {
  return m < 1000 ? `${Math.round(m / 10) * 10} m` : `${(m / 1000).toFixed(1).replace(".", ",")} km`;
}

/** Resume pour le panneau d'itineraire ; null si rien a signaler. */
export function surfaceSummaryLabel(info: SurfaceInfo | null): string | null {
  if (!info) return null;
  const parts: string[] = [];
  if (info.unpavedM >= 20) parts.push(`${km(info.unpavedM)} non revêtus`);
  if (info.probableM >= 20) parts.push(`${km(info.probableM)} de piste probable`);
  if (info.roughM >= 20) parts.push(`${km(info.roughM)} de route dégradée`);
  return parts.length ? parts.join(" · ") : null;
}

const TITLES: Record<SurfaceKind, string> = {
  unpaved: "Route non revêtue",
  probable_unpaved: "Piste probable",
  rough: "Route dégradée",
};

/** Avertissement avant le prochain tronçon difficile (ou en cours). */
export function upcomingSurfaceNotice(info: SurfaceInfo | null, alongM: number | null): string | null {
  if (!info || alongM === null) return null;
  for (const s of info.sections) {
    if (s.endM - s.startM < 30 || s.endM <= alongM) continue;
    if (s.startM <= alongM) return `${TITLES[s.kind]} · encore ${km(s.endM - alongM)}`;
    const ahead = s.startM - alongM;
    if (ahead <= 800) return `${TITLES[s.kind]} dans ${km(ahead)}`;
    return null;
  }
  return null;
}
