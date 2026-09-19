import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type CheckoutOrderInput = {
  planCode: string;
  clientType: "particulier" | "professionnel" | "institutionnel";
  fullName: string;
  email: string | null;
  paymentMethod: string | null;

  placeType: string;
  placeName: string | null;

  lat: number | null;
  lng: number | null;
  accuracyM: number | null;

  communeId: string | null;
  districtId: string | null;
  sectorId: string | null;

  addressLine: string | null;
  accessPointNote: string | null;

  devisDemande: boolean;
  submissionChannel: string;
};

export type CheckoutOrderResult =
  | {
      ok: true;
      order_id: string;
      order_ref: string;
      guest_token: string;
    }
  | {
      ok: false;
      status: number;
      code: string | null;
      error: string;
    };

type DjangoErrorPayload = {
  detail?: unknown;
  code?: unknown;
  [key: string]: unknown;
};

function djangoApiBase(): string {
  const configured = process.env["DJANGO_API_URL"]?.trim();

  if (configured) {
    return configured.replace(/\/+$/, "");
  }

  if (process.env["NODE_ENV"] !== "production") {
    return "http://127.0.0.1:8000";
  }

  throw new Error(
    "DJANGO_API_URL manquante sur le serveur frontend.",
  );
}

function firstValidationMessage(
  payload: DjangoErrorPayload,
): string | null {
  for (const [key, value] of Object.entries(payload)) {
    if (key === "detail" || key === "code") continue;

    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }

    if (Array.isArray(value)) {
      const first = value.find(
        (item) => typeof item === "string" && item.trim(),
      );

      if (typeof first === "string") {
        return first.trim();
      }
    }
  }

  return null;
}

function normalizeDjangoError(
  payload: unknown,
  status: number,
): {
  code: string | null;
  error: string;
} {
  if (
    payload
    && typeof payload === "object"
    && !Array.isArray(payload)
  ) {
    const objectPayload = payload as DjangoErrorPayload;

    const detail =
      typeof objectPayload.detail === "string"
        ? objectPayload.detail.trim()
        : "";

    const code =
      typeof objectPayload.code === "string"
        ? objectPayload.code.trim()
        : "";

    const validationMessage =
      firstValidationMessage(objectPayload);

    return {
      code: code || null,
      error:
        detail
        || validationMessage
        || `La demande a été refusée par l'API (${status}).`,
    };
  }

  return {
    code: null,
    error: `La demande a été refusée par l'API (${status}).`,
  };
}

export const createCheckoutOrderFn = createServerFn({
  method: "POST",
})
  .middleware([requireSupabaseAuth])
  .validator((input: CheckoutOrderInput) => {
    const planCode = String(input?.planCode ?? "").trim();
    const fullName = String(input?.fullName ?? "").trim();

    if (!planCode) {
      throw new Error("Offre manquante.");
    }

    if (!fullName) {
      throw new Error("Nom complet manquant.");
    }

    if (
      input?.clientType !== "particulier"
      && input?.clientType !== "professionnel"
      && input?.clientType !== "institutionnel"
    ) {
      throw new Error("Type de client invalide.");
    }

    if (
      (input?.lat == null) !==
      (input?.lng == null)
    ) {
      throw new Error(
        "Latitude et longitude doivent être fournies ensemble.",
      );
    }

    return {
      planCode,
      clientType: input.clientType,
      fullName,
      email: input.email?.trim().toLowerCase() || null,
      paymentMethod: input.paymentMethod?.trim() || null,

      placeType: input.placeType?.trim() || "other",
      placeName: input.placeName?.trim() || null,

      lat: input.lat ?? null,
      lng: input.lng ?? null,
      accuracyM: input.accuracyM ?? null,

      communeId: input.communeId ?? null,
      districtId: input.districtId ?? null,
      sectorId: input.sectorId ?? null,

      addressLine: input.addressLine?.trim() || null,
      accessPointNote: input.accessPointNote?.trim() || null,

      devisDemande: Boolean(input.devisDemande),
      submissionChannel: input.submissionChannel?.trim() || "web",
    };
  })
  .handler(async ({ data }): Promise<CheckoutOrderResult> => {
    const request = getRequest();
    const authorization = request?.headers?.get("authorization");

    if (!authorization?.startsWith("Bearer ")) {
      return {
        ok: false,
        status: 401,
        code: "AUTH_REQUIRED",
        error: "Session de vérification introuvable. Recommencez la vérification OTP.",
      };
    }

    const baseUrl = djangoApiBase();

    let response: Response;

    try {
      response = await fetch(
        `${baseUrl}/api/v1/checkout/orders/`,
        {
          method: "POST",
          headers: {
            Authorization: authorization,
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: JSON.stringify({
            plan_code: data.planCode,
            client_type: data.clientType,
            full_name: data.fullName,
            email: data.email,
            payment_method: data.paymentMethod,

            place_type: data.placeType,
            place_name: data.placeName,

            lat: data.lat,
            lng: data.lng,
            accuracy_m: data.accuracyM,

            commune_id: data.communeId,
            district_id: data.districtId,
            sector_id: data.sectorId,

            address_line: data.addressLine,
            access_point_note: data.accessPointNote,

            devis_demande: data.devisDemande,
            submission_channel: data.submissionChannel,
          }),
        },
      );
    } catch {
      return {
        ok: false,
        status: 503,
        code: "DJANGO_API_UNAVAILABLE",
        error: "Le service de commande est momentanément indisponible.",
      };
    }

    let payload: unknown = null;

    try {
      payload = await response.json();
    } catch {
      payload = null;
    }

    if (!response.ok) {
      const normalized = normalizeDjangoError(
        payload,
        response.status,
      );

      return {
        ok: false,
        status: response.status,
        code: normalized.code,
        error: normalized.error,
      };
    }

    if (
      !payload
      || typeof payload !== "object"
      || Array.isArray(payload)
      || typeof (payload as { order_id?: unknown }).order_id !== "string"
      || typeof (payload as { order_ref?: unknown }).order_ref !== "string"
      || typeof (payload as { guest_token?: unknown }).guest_token !== "string"
      || !/^[A-Za-z0-9_-]{16}$/.test(
        (payload as { guest_token: string }).guest_token,
      )
    ) {
      return {
        ok: false,
        status: 502,
        code: "INVALID_DJANGO_RESPONSE",
        error: "La demande a été enregistrée, mais sa référence n'a pas été retournée correctement.",
      };
    }

    return {
      ok: true,
      order_id: (payload as { order_id: string }).order_id,
      order_ref: (payload as { order_ref: string }).order_ref,
      guest_token: (payload as { guest_token: string }).guest_token,
    };
  });
