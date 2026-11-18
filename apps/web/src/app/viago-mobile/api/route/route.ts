import { NextRequest } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RoutePayload = {
  profile: "car" | "motorcycle" | "foot";
  start_latitude: number;
  start_longitude: number;
  end_latitude: number;
  end_longitude: number;
};

function validCoordinate(value: unknown, limit: number): value is number {
  return typeof value === "number" && Number.isFinite(value) && Math.abs(value) <= limit;
}

function parseRoutePayload(value: unknown): RoutePayload | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const body = value as Record<string, unknown>;

  if (body.profile !== "car" && body.profile !== "motorcycle" && body.profile !== "foot") {
    return null;
  }

  if (
    !validCoordinate(body.start_latitude, 90) ||
    !validCoordinate(body.start_longitude, 180) ||
    !validCoordinate(body.end_latitude, 90) ||
    !validCoordinate(body.end_longitude, 180)
  ) {
    return null;
  }

  return {
    profile: body.profile,
    start_latitude: body.start_latitude,
    start_longitude: body.start_longitude,
    end_latitude: body.end_latitude,
    end_longitude: body.end_longitude,
  };
}

export async function POST(request: NextRequest): Promise<Response> {
  const origin = request.headers.get("origin");

  if (origin && new URL(origin).host !== request.headers.get("host")) {
    return Response.json(
      { status: "error", message: "Cross-origin request denied." },
      { status: 403 },
    );
  }

  if (!request.headers.get("content-type")?.includes("application/json")) {
    return Response.json({ status: "error", message: "JSON required." }, { status: 415 });
  }

  const length = Number(request.headers.get("content-length") ?? "0");

  if (!Number.isFinite(length) || length > 4096) {
    return Response.json({ status: "error", message: "Request too large." }, { status: 413 });
  }

  let body: RoutePayload | null = null;

  try {
    const raw = await request.text();
    if (raw.length > 4096) {
      return Response.json({ status: "error", message: "Request too large." }, { status: 413 });
    }

    body = parseRoutePayload(JSON.parse(raw));
  } catch {
    return Response.json({ status: "error", message: "Invalid JSON." }, { status: 400 });
  }

  if (!body) {
    return Response.json(
      { status: "error", message: "Invalid route coordinates or profile." },
      { status: 400 },
    );
  }

  const routingBaseUrl = process.env.VIAGO_ROUTING_API_BASE_URL;
  const routingToken = process.env.VIAGO_STAGING_BEARER_TOKEN;

  if (!routingBaseUrl || !routingToken || /[\r\n]/.test(routingToken)) {
    return Response.json(
      { status: "error", message: "Routing backend not configured." },
      { status: 503 },
    );
  }

  // Only the internal, locally bound staging service may receive this token.
  if (routingBaseUrl !== "http://127.0.0.1:18765") {
    return Response.json(
      { status: "error", message: "Invalid routing configuration." },
      { status: 503 },
    );
  }

  try {
    const response = await fetch(`${routingBaseUrl}/viago-staging/api/route/`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        Authorization: `Bearer ${routingToken}`,
        "X-Forwarded-Proto": "https",
      },
      body: JSON.stringify(body),
      cache: "no-store",
      redirect: "manual",
      signal: AbortSignal.timeout(30000),
    });

    if (response.status >= 300 && response.status < 400) {
      return Response.json(
        { status: "error", message: "Unexpected routing redirect." },
        { status: 502 },
      );
    }

    const payload = await response.text();

    if (payload.length > 2000000) {
      return Response.json(
        { status: "error", message: "Routing response too large." },
        { status: 502 },
      );
    }

    if (!response.headers.get("content-type")?.includes("application/json")) {
      return Response.json(
        { status: "error", message: "Invalid routing response." },
        { status: 502 },
      );
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
      { status: "error", message: "Viago routing API unavailable." },
      { status: 502 },
    );
  }
}
