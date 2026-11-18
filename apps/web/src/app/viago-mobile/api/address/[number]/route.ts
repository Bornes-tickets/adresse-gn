import { NextRequest } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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
