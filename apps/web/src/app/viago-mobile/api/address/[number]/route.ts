import { NextRequest } from "next/server";

import { fetchAddressJson } from "@/features/viago/address-cache";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Cache memoire 10 min des adresses trouvees : une recherche repetee est instantanee.
const CACHE_TTL_MS = 10 * 60 * 1000;
const cache = new Map<string, { at: number; payload: string }>();

type Context = {
  params: Promise<{ number: string }>;
};

export async function GET(
  _request: NextRequest,
  context: Context,
): Promise<Response> {
  const { number } = await context.params;

  if (!/^[A-Za-z0-9-]{6,80}$/.test(number)) {
    return Response.json(
      { status: "invalid", message: "Invalid address number." },
      { status: 400 },
    );
  }

  const addressApiBaseUrl = (
    process.env.VIAGO_ADDRESS_API_BASE_URL ??
    "https://adresse-gn-api.onrender.com"
  ).replace(/\/+$/, "");

  const cached = cache.get(number.toUpperCase());
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) {
    return new Response(cached.payload, {
      status: 200,
      headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
    });
  }

  try {
    const result = await fetchAddressJson({
      kind: "address", key: number.toUpperCase(),
      url: `${addressApiBaseUrl}/api/v1/addresses/${encodeURIComponent(number)}/`,
      timeoutMs: 75000, slowMs: 6000, maxBytes: 1000000,
    });
    if (result.source === "live" && result.status === 200) {
      if (cache.size >= 200) cache.clear();
      cache.set(number.toUpperCase(), { at: Date.now(), payload: result.body });
    }
    return new Response(result.body, {
      status: result.status,
      headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", "X-Viago-Source": result.source },
    });
  } catch {
    return Response.json(
      { status: "error", message: "Adresse GN API unavailable." },
      { status: 502 },
    );
  }
}
