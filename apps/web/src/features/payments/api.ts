import {
  getAccessToken,
} from "@/lib/supabase/browser";

import type {
  ManualPaymentResponse,
  PaymentMethod,
  PaymentMethodsResponse,
  PaymentOrder,
} from "./types";

const API_BASE_URL = (
  process.env.NEXT_PUBLIC_API_URL ??
  "http://127.0.0.1:8000"
).replace(/\/$/, "");

async function authHeaders(): Promise<Record<string, string>> {
  const token =
    await getAccessToken();

  if (!token) {
    throw new Error(
      "AUTH_REQUIRED",
    );
  }

  return {
    Authorization:
      `Bearer ${token}`,
    Accept:
      "application/json",
  };
}

async function readError(
  response: Response,
): Promise<never> {
  let detail =
    "Le service de paiement a retourné une erreur.";

  try {
    const payload =
      (await response.json()) as {
        detail?: string;
        code?: string;
      };

    detail =
      payload.detail ??
      payload.code ??
      detail;
  } catch {
    // Réponse non JSON : message générique.
  }

  throw new Error(detail);
}

export async function loadPaymentOrder(
  orderRef: string,
): Promise<PaymentOrder> {
  const response =
    await fetch(
      `${API_BASE_URL}/api/v1/payments/orders/${encodeURIComponent(
        orderRef,
      )}/`,
      {
        method: "GET",
        headers:
          await authHeaders(),
        cache: "no-store",
      },
    );

  if (!response.ok) {
    return readError(response);
  }

  return (
    await response.json()
  ) as PaymentOrder;
}

export async function loadPaymentMethods(): Promise<PaymentMethod[]> {
  const response =
    await fetch(
      `${API_BASE_URL}/api/v1/payments/methods/`,
      {
        method: "GET",
        headers:
          await authHeaders(),
        cache: "no-store",
      },
    );

  if (!response.ok) {
    return readError(response);
  }

  const payload =
    (await response.json()) as PaymentMethodsResponse;

  return payload.items ?? [];
}

export async function initiateManualPayment(
  orderRef: string,
): Promise<ManualPaymentResponse> {
  const response =
    await fetch(
      `${API_BASE_URL}/api/v1/payments/orders/${encodeURIComponent(
        orderRef,
      )}/manual/`,
      {
        method: "POST",
        headers: {
          ...(await authHeaders()),
          "Content-Type":
            "application/json",
        },
        body: "{}",
        cache: "no-store",
      },
    );

  if (!response.ok) {
    return readError(response);
  }

  return (
    await response.json()
  ) as ManualPaymentResponse;
}
