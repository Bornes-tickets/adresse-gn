import { NextRequest } from "next/server";

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
    const response = await fetch(
      `${addressApiBaseUrl}/api/v1/addresses/${encodeURIComponent(number)}/`,
      {
        method: "GET",
        headers: { Accept: "application/json" },
        cache: "no-store",
        redirect: "manual",
        signal: AbortSignal.timeout(75000),
      },
    );

    if (response.status >= 300 && response.status < 400) {
      return Response.json(
        { status: "error", message: "Unexpected backend redirect." },
        { status: 502 },
      );
    }

    const payload = await response.text();

    if (payload.length > 1000000) {
      return Response.json(
        { status: "error", message: "Backend response too large." },
        { status: 502 },
      );
    }

    if (!response.headers.get("content-type")?.includes("application/json")) {
      return Response.json(
        { status: "error", message: "Invalid backend response." },
        { status: 502 },
      );
    }

    if (response.status === 200) {
      if (cache.size >= 200) cache.clear();
      cache.set(number.toUpperCase(), { at: Date.now(), payload });
    }

    return new Response(payload, {
      status: response.status,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "no-store",
      },
    });
  } catch {
    return Response.json(
      { status: "error", message: "Adresse GN API unavailable." },
      { status: 502 },
    );
  }
}
