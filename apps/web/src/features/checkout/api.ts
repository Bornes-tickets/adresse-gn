import { getAccessToken } from "@/lib/supabase/browser";

import type {
  CheckoutCreatedOrder,
  CheckoutDraft,
  PublicPlan,
  PublicTrackingOrder,
  ReferenceItem,
} from "./types";

const API_BASE_URL = (
  process.env.NEXT_PUBLIC_API_URL ??
  "http://127.0.0.1:8000"
).replace(/\/$/, "");

async function readJson<T>(response: Response): Promise<T> {
  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    const message =
      payload &&
      typeof payload === "object" &&
      "detail" in payload &&
      typeof payload.detail === "string"
        ? payload.detail
        : "Le service Adresse GN a refusé la requête.";

    throw new Error(message);
  }

  return payload as T;
}

async function publicGet<T>(
  path: string,
  signal?: AbortSignal,
): Promise<T> {
  const response = await fetch(
    `${API_BASE_URL}${path}`,
    {
      method: "GET",
      headers: { Accept: "application/json" },
      cache: "no-store",
      signal,
    },
  );

  return readJson<T>(response);
}

export async function loadPlans(
  signal?: AbortSignal,
): Promise<PublicPlan[]> {
  const payload = await publicGet<{ items: PublicPlan[] }>(
    "/api/v1/public/plans/",
    signal,
  );

  return payload.items;
}

export async function loadReference(
  level: "regions" | "prefectures" | "communes" | "districts" | "sectors",
  parent?: { key: string; value: string },
  signal?: AbortSignal,
): Promise<ReferenceItem[]> {
  const query = parent
    ? `?${encodeURIComponent(parent.key)}=${encodeURIComponent(parent.value)}`
    : "";

  const payload = await publicGet<{ items: ReferenceItem[] }>(
    `/api/v1/public/reference/${level}/${query}`,
    signal,
  );

  return payload.items;
}

export async function createCheckoutOrder(
  draft: CheckoutDraft,
  requiresQuote: boolean,
): Promise<CheckoutCreatedOrder> {
  const accessToken = await getAccessToken();

  if (!accessToken) {
    throw new Error("La session OTP n'est pas disponible.");
  }

  const response = await fetch(
    `${API_BASE_URL}/api/v1/checkout/orders/`,
    {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      cache: "no-store",
      body: JSON.stringify({
        plan_code: draft.planCode,
        client_type: draft.clientType,
        full_name: draft.fullName.trim(),
        email: draft.email.trim() || null,
        payment_method: requiresQuote
          ? null
          : draft.paymentMethod || null,
        place_type: draft.placeType,
        place_name: draft.placeName.trim() || null,
        lat: draft.lat,
        lng: draft.lng,
        accuracy_m: draft.accuracyM,
        commune_id: draft.communeId || null,
        district_id: draft.districtId || null,
        sector_id: draft.sectorId || null,
        address_line: draft.addressLine.trim() || null,
        access_point_note: draft.accessPointNote.trim() || null,
        devis_demande: requiresQuote,
        submission_channel: "web",
      }),
    },
  );

  return readJson<CheckoutCreatedOrder>(response);
}

export async function loadTracking(
  token: string,
  signal?: AbortSignal,
): Promise<PublicTrackingOrder> {
  return publicGet<PublicTrackingOrder>(
    `/api/v1/tracking/orders/${encodeURIComponent(token)}/`,
    signal,
  );
}
