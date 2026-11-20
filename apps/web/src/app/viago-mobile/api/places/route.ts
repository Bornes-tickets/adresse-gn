import { NextRequest } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Recherche de lieux publics Adresse GN par nom. Relais lecture seule + cache memoire 2 min.
const CACHE_TTL_MS = 2 * 60 * 1000;
const cache = new Map<string, { at: number; payload: string }>();

export async function GET(request: NextRequest): Promise<Response> {
  const q = (request.nextUrl.searchParams.get("q") ?? "").trim();
  if (q.length < 2 || q.length > 60) {
    return Response.json({ status: "invalid", results: [], message: "Saisissez au moins 2 caractères." }, { status: 400 });
  }
  const lat = Number(request.nextUrl.searchParams.get("lat"));
  const lng = Number(request.nextUrl.searchParams.get("lng"));
  const hasPos = Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180
    && request.nextUrl.searchParams.get("lat") !== null;

  const base = (process.env.VIAGO_ADDRESS_API_BASE_URL ?? "https://adresse-gn-api.onrender.com").replace(/\/+$/, "");
  // Position arrondie (~1 km) : meilleur taux de cache et moins de donnees de position transmises.
  const params = new URLSearchParams({ q });
  if (hasPos) { params.set("lat", lat.toFixed(2)); params.set("lng", lng.toFixed(2)); }
  const key = params.toString().toLowerCase();

  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) {
    return new Response(hit.payload, { status: 200, headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" } });
  }
  try {
    const response = await fetch(`${base}/api/v1/addresses/places/?${params.toString()}`, {
      headers: { Accept: "application/json" }, cache: "no-store", redirect: "manual",
      signal: AbortSignal.timeout(20000),
    });
    if (!response.headers.get("content-type")?.includes("application/json")) {
      return Response.json({ status: "error", results: [], message: "Réponse invalide du service Adresse GN." }, { status: 502 });
    }
    const payload = await response.text();
    if (payload.length > 200000) return Response.json({ status: "error", results: [] }, { status: 502 });
    if (response.status === 200) {
      if (cache.size >= 300) cache.clear();
      cache.set(key, { at: Date.now(), payload });
    }
    return new Response(payload, { status: response.status, headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" } });
  } catch {
    return Response.json({ status: "error", results: [], message: "Service Adresse GN indisponible." }, { status: 502 });
  }
}
