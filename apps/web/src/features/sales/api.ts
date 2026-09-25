import {
  getAccessToken,
} from "@/lib/supabase/browser";

import type {
  SalesConfirmResponse,
  SalesPaymentsResponse,
  SalesRejectResponse,
} from "./types";


const API_BASE_URL = (
  process.env.NEXT_PUBLIC_API_URL ??
  "http://127.0.0.1:8000"
).replace(/\/$/, "");


export class SalesApiError extends Error {
  statusCode: number;
  code: string | null;

  constructor(
    message: string,
    statusCode: number,
    code: string | null = null,
  ) {
    super(message);
    this.name = "SalesApiError";
    this.statusCode = statusCode;
    this.code = code;
  }
}


async function authHeaders(): Promise<Record<string, string>> {
  const token =
    await getAccessToken();

  if (!token) {
    throw new SalesApiError(
      "Authentification requise.",
      401,
      "AUTH_REQUIRED",
    );
  }

  return {
    Accept: "application/json",
    Authorization: `Bearer ${token}`,
  };
}


async function readApiError(
  response: Response,
): Promise<never> {
  let detail =
    `Erreur API (${response.status}).`;

  let code: string | null =
    null;

  try {
    const payload =
      (await response.json()) as {
        detail?: string;
        code?: string;
      };

    detail =
      payload.detail ??
      detail;

    code =
      payload.code ??
      null;
  } catch {
    // Réponse non JSON : conserver le message générique.
  }

  throw new SalesApiError(
    detail,
    response.status,
    code,
  );
}


export async function listSalesPayments(
  {
    page = 1,
    pageSize = 25,
    status = "actionable",
  }: {
    page?: number;
    pageSize?: number;
    status?: string;
  } = {},
): Promise<SalesPaymentsResponse> {
  const params =
    new URLSearchParams({
      status,
      page: String(page),
      page_size: String(pageSize),
    });

  const response =
    await fetch(
      `${API_BASE_URL}/api/v1/payments/sales/?${params.toString()}`,
      {
        method: "GET",
        headers:
          await authHeaders(),
        cache: "no-store",
      },
    );

  if (!response.ok) {
    return readApiError(
      response,
    );
  }

  return (
    await response.json()
  ) as SalesPaymentsResponse;
}


export async function confirmSalesPayment(
  paymentId: string,
  payload: {
    external_ref: string;
    note?: string | null;
  },
): Promise<SalesConfirmResponse> {
  const response =
    await fetch(
      `${API_BASE_URL}/api/v1/payments/sales/${encodeURIComponent(
        paymentId,
      )}/confirm/`,
      {
        method: "POST",
        headers: {
          ...(await authHeaders()),
          "Content-Type":
            "application/json",
        },
        body: JSON.stringify({
          external_ref:
            payload.external_ref,
          note:
            payload.note ??
            null,
        }),
        cache: "no-store",
      },
    );

  if (!response.ok) {
    return readApiError(
      response,
    );
  }

  return (
    await response.json()
  ) as SalesConfirmResponse;
}


export async function rejectSalesPayment(
  paymentId: string,
  reason: string,
): Promise<SalesRejectResponse> {
  const response =
    await fetch(
      `${API_BASE_URL}/api/v1/payments/sales/${encodeURIComponent(
        paymentId,
      )}/reject/`,
      {
        method: "POST",
        headers: {
          ...(await authHeaders()),
          "Content-Type":
            "application/json",
        },
        body: JSON.stringify({
          reason,
        }),
        cache: "no-store",
      },
    );

  if (!response.ok) {
    return readApiError(
      response,
    );
  }

  return (
    await response.json()
  ) as SalesRejectResponse;
}
