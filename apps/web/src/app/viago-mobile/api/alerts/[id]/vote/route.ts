import type { NextRequest } from "next/server";
import { voteAlert } from "@/lib/viago-alerts-store";
import { sameOriginOk } from "@/lib/viago-same-origin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }): Promise<Response> {
  if (!sameOriginOk(request)) return Response.json({ status: "error" }, { status: 403 });
  const { id } = await context.params;
  if (!/^[a-z0-9]{6,40}$/.test(id)) return Response.json({ status: "error" }, { status: 400 });
  const device = request.headers.get("x-viago-device") ?? "";
  if (device.length < 8 || device.length > 80) return Response.json({ status: "error" }, { status: 400 });
  const text = await request.text();
  if (text.length > 256) return Response.json({ status: "error" }, { status: 413 });
  let vote: unknown;
  try { vote = (JSON.parse(text) as { vote?: unknown }).vote; } catch { return Response.json({ status: "error" }, { status: 400 }); }
  if (vote !== "still" && vote !== "gone") return Response.json({ status: "error" }, { status: 400 });
  const result = voteAlert(id, device, vote);
  if (result === null) return Response.json({ status: "not_found" }, { status: 404 });
  if (result === "removed") return Response.json({ status: "removed" });
  return Response.json({ status: "ok", alert: result }, { headers: { "Cache-Control": "no-store" } });
}
