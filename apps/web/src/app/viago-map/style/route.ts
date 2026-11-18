import { promises as fs } from "node:fs";
import path from "node:path";

import type { NextRequest } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Style local (.tiles/style.json, genere par tools/viago-tiles/build_basemap.py).
// Les adresses y sont ecrites avec __ORIGIN__, remplace ici par l'origine reelle
// de la requete, pour que le meme fichier serve en local, en test et en production.
function stylePath(): string {
  const configured = process.env.VIAGO_STYLE_PATH;
  if (configured) return configured;
  return path.resolve(process.cwd(), "..", "..", ".tiles", "style.json");
}

export async function GET(request: NextRequest): Promise<Response> {
  let raw: string;
  try {
    raw = await fs.readFile(stylePath(), "utf-8");
  } catch {
    return Response.json({ status: "error", message: "Style local absent." }, { status: 404 });
  }
  const forwardedHost = request.headers.get("x-forwarded-host");
  const host = forwardedHost ?? request.headers.get("host") ?? request.nextUrl.host;
  const proto = request.headers.get("x-forwarded-proto") ?? request.nextUrl.protocol.replace(":", "");
  if (!/^[a-zA-Z0-9.\-:\[\]]+$/.test(host) || !/^https?$/.test(proto)) {
    return Response.json({ status: "error", message: "Hote invalide." }, { status: 400 });
  }
  const body = raw.replaceAll("__ORIGIN__", `${proto}://${host}`);
  return new Response(body, {
    status: 200,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
  });
}
