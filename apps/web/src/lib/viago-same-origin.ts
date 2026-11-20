import type { NextRequest } from "next/server";

/** Meme regle que le proxy de routage : refuse toute origine hors hote courant ou liste VIAGO_ALLOWED_ORIGIN_HOSTS. */
export function sameOriginOk(request: NextRequest): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return true;
  const allowed = new Set(
    (process.env.VIAGO_ALLOWED_ORIGIN_HOSTS ?? "").split(",").map((v) => v.trim().toLowerCase()).filter(Boolean),
  );
  const host = request.headers.get("host");
  if (host) allowed.add(host.toLowerCase());
  try {
    return allowed.has(new URL(origin).host.toLowerCase());
  } catch {
    return false;
  }
}
