import type { NextRequest } from "next/server";
import { ALERT_TYPES, createAlert, inGuinea, listAlerts, type AlertType } from "@/lib/viago-alerts-store";
import { sameOriginOk } from "@/lib/viago-same-origin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const noStore = { "Cache-Control": "no-store" };

export async function GET(request: NextRequest): Promise<Response> {
  if (!sameOriginOk(request)) return Response.json({ status: "error" }, { status: 403 });
  const raw = request.nextUrl.searchParams.get("bbox") ?? "";
  const parts = raw.split(",").map(Number);
  if (parts.length !== 4 || !parts.every(Number.isFinite)) return Response.json({ status: "error", message: "bbox invalide" }, { status: 400 });
  const [minLng, minLat, maxLng, maxLat] = parts;
  if (maxLat - minLat > 4 || maxLng - minLng > 4 || maxLat < minLat || maxLng < minLng) {
    return Response.json({ status: "error", message: "zone trop grande" }, { status: 400 });
  }
  return Response.json({ status: "ok", alerts: listAlerts({ minLat, minLng, maxLat, maxLng }) }, { headers: noStore });
}

export async function POST(request: NextRequest): Promise<Response> {
  if (!sameOriginOk(request)) return Response.json({ status: "error" }, { status: 403 });
  if (!request.headers.get("content-type")?.includes("application/json")) return Response.json({ status: "error" }, { status: 415 });
  const text = await request.text();
  if (text.length > 1024) return Response.json({ status: "error" }, { status: 413 });
  let body: { type?: unknown; lat?: unknown; lng?: unknown };
  try { body = JSON.parse(text) as typeof body; } catch { return Response.json({ status: "error" }, { status: 400 }); }
  const device = request.headers.get("x-viago-device") ?? "";
  if (device.length < 8 || device.length > 80) return Response.json({ status: "error", message: "appareil inconnu" }, { status: 400 });
  if (typeof body.type !== "string" || !(body.type in ALERT_TYPES)) return Response.json({ status: "error", message: "type invalide" }, { status: 400 });
  if (typeof body.lat !== "number" || typeof body.lng !== "number" || !inGuinea(body.lat, body.lng)) {
    return Response.json({ status: "error", message: "position hors Guinée" }, { status: 400 });
  }
  const result = createAlert({ type: body.type as AlertType, lat: body.lat, lng: body.lng, device });
  if (!result.ok) {
    return Response.json({ status: "error", message: result.reason === "rate_limited" ? "Trop de signalements, réessayez plus tard." : "Stockage plein." },
      { status: result.reason === "rate_limited" ? 429 : 503 });
  }
  return Response.json({ status: "ok", alert: result.alert, merged: result.merged }, { status: 201, headers: noStore });
}
