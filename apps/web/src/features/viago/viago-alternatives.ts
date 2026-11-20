// Itineraires alternatifs : donnees d'affichage uniquement (le calcul est fait par le moteur).
import type { ViagoPoint } from "./viago-map";

export type RouteCandidate = {
  line: ViagoPoint[];
  distance: number;
  duration: number | null;
  maneuvers: unknown[];
};

function haversine(a: ViagoPoint, b: ViagoPoint): number {
  const R = 6371008.8, rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad, dLng = (b.lng - a.lng) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Point situe a `fraction` de la longueur de la ligne. */
export function pointAlong(line: ViagoPoint[], fraction: number): ViagoPoint | null {
  if (line.length < 2) return null;
  const cum = [0];
  for (let i = 1; i < line.length; i++) cum.push(cum[i - 1] + haversine(line[i - 1], line[i]));
  const target = cum[cum.length - 1] * fraction;
  let i = 1;
  while (i < cum.length - 1 && cum[i] < target) i++;
  const span = cum[i] - cum[i - 1] || 1;
  const t = Math.min(1, Math.max(0, (target - cum[i - 1]) / span));
  return { lat: line[i - 1].lat + (line[i].lat - line[i - 1].lat) * t, lng: line[i - 1].lng + (line[i].lng - line[i - 1].lng) * t };
}

export function formatMinutes(seconds: number): string {
  const m = Math.max(1, Math.round(seconds / 60));
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60), r = m % 60;
  return r === 0 ? `${h} h` : `${h} h ${String(r).padStart(2, "0")}`;
}

/** Ecart de duree par rapport a l'itineraire choisi, ex. "+3 min" / "-2 min" / "≈ pareil". */
export function durationDelta(candidate: RouteCandidate, reference: RouteCandidate | undefined): string | null {
  if (!reference || candidate.duration === null || reference.duration === null) return null;
  const d = Math.round((candidate.duration - reference.duration) / 60);
  return d === 0 ? "≈ pareil" : d > 0 ? `+${d} min` : `${d} min`;
}

/** Traces gris des alternatives non choisies + bulles de duree. */
export function alternativeFeatures(candidates: RouteCandidate[], chosen: number): GeoJSON.FeatureCollection {
  const features: GeoJSON.Feature[] = [];
  if (candidates.length < 2) return { type: "FeatureCollection", features };
  candidates.forEach((c, i) => {
    if (i === chosen) return;
    features.push({ type: "Feature", properties: { idx: i }, geometry: { type: "LineString", coordinates: c.line.map((p) => [p.lng, p.lat]) } });
    const mid = pointAlong(c.line, 0.35 + 0.15 * (i % 3));
    if (mid) {
      const delta = durationDelta(c, candidates[chosen]);
      const label = c.duration !== null ? `${formatMinutes(c.duration)}${delta ? ` (${delta})` : ""}` : "Alternative";
      features.push({ type: "Feature", properties: { idx: i, label }, geometry: { type: "Point", coordinates: [mid.lng, mid.lat] } });
    }
  });
  return { type: "FeatureCollection", features };
}
