const API_BASE_URL = (
  process.env.NEXT_PUBLIC_API_URL ??
  "http://127.0.0.1:8000"
).replace(/\/$/, "");


export type OwnerSearchPoint = {
  day: string;
  count: number;
};


export type OwnerBeacon = {
  address_id: string;
  beacon_id: string | null;
  public_number: string;
  name: string | null;
  category: string;
  visibility: string;
  verification_level: string;
  status: string;
  access_point_note: string | null;
  establishment_id: string | null;
  searches_30d: OwnerSearchPoint[];
};


export class OwnerApiError extends Error {
  statusCode: number;

  constructor(
    message: string,
    statusCode: number,
  ) {
    super(message);
    this.name = "OwnerApiError";
    this.statusCode = statusCode;
  }
}


async function errorMessage(
  response: Response,
): Promise<string> {
  try {
    const payload =
      await response.json();

    if (
      payload &&
      typeof payload === "object"
    ) {
      if (
        typeof payload.detail ===
        "string"
      ) {
        return payload.detail;
      }

      if (
        typeof payload.message ===
        "string"
      ) {
        return payload.message;
      }

      for (
        const value
        of Object.values(payload)
      ) {
        if (
          Array.isArray(value) &&
          typeof value[0] ===
            "string"
        ) {
          return value[0];
        }
      }
    }

  } catch {
    // Réponse sans JSON exploitable.
  }

  return "Une erreur est survenue.";
}


async function ownerFetch<T>(
  url: string,
  accessToken: string,
  init?: RequestInit,
): Promise<T> {
  let response: Response;

  try {
    response = await fetch(
      url,
      {
        ...init,

        headers: {
          Accept:
            "application/json",

          Authorization:
            `Bearer ${accessToken}`,

          ...(init?.headers ?? {}),
        },

        cache: "no-store",
      },
    );

  } catch {
    throw new OwnerApiError(
      "Impossible de joindre le service Adresse GN.",
      0,
    );
  }

  if (!response.ok) {
    throw new OwnerApiError(
      await errorMessage(
        response
      ),
      response.status,
    );
  }

  try {
    return (
      await response.json()
    ) as T;

  } catch {
    throw new OwnerApiError(
      "Réponse Django invalide.",
      response.status,
    );
  }
}


export async function listOwnerBeacons(
  accessToken: string,
  signal?: AbortSignal,
): Promise<OwnerBeacon[]> {
  const payload =
    await ownerFetch<{
      items: OwnerBeacon[];
    }>(
      `${API_BASE_URL}/api/v1/owner/beacons/`,
      accessToken,
      {
        method: "GET",
        signal,
      },
    );

  return payload.items;
}


export function updateOwnerBeacon(
  accessToken: string,
  addressId: string,
  input: {
    name: string | null;
    category: string;
    visibility:
      | "public"
      | "private";
    access_point_note:
      | string
      | null;
  },
) {
  return ownerFetch<{
    ok: true;
    status: "updated";
    message: string;
  }>(
    `${API_BASE_URL}/api/v1/owner/beacons/${encodeURIComponent(addressId)}/`,
    accessToken,
    {
      method: "PATCH",

      headers: {
        "Content-Type":
          "application/json",
      },

      body: JSON.stringify(
        input
      ),
    },
  );
}


export function suspendOwnerBeacon(
  accessToken: string,
  addressId: string,
) {
  return ownerFetch<{
    ok: true;
    status: "suspended";
    message: string;
  }>(
    `${API_BASE_URL}/api/v1/owner/beacons/${encodeURIComponent(addressId)}/suspend/`,
    accessToken,
    {
      method: "POST",
    },
  );
}


export function createOwnerMovingReport(
  accessToken: string,
  addressId: string,
  description: string | null,
) {
  return ownerFetch<{
    ok: true;
    status: "created";
    report_id: string;
    report_status: string;
    message: string;
  }>(
    `${API_BASE_URL}/api/v1/owner/beacons/${encodeURIComponent(addressId)}/moving-report/`,
    accessToken,
    {
      method: "POST",

      headers: {
        "Content-Type":
          "application/json",
      },

      body: JSON.stringify({
        description,
      }),
    },
  );
}


export type OwnerActivity = {
  label: string;
  detail: string;
  at: string;
};


export type OwnerDashboard = {
  beaconCount: number;
  searches30d: number;
  routes30d: number;
  activities: OwnerActivity[];
};


export function getOwnerDashboard(
  accessToken: string,
  signal?: AbortSignal,
) {
  return ownerFetch<OwnerDashboard>(
    `${API_BASE_URL}/api/v1/owner/dashboard/`,
    accessToken,
    {
      method: "GET",
      signal,
    },
  );
}



export type OwnerFavorite = {
  id: string;
  alias: string | null;
  created_at: string | null;
  public_number: string;
  name: string | null;
  category: string | null;
};


export async function listOwnerFavorites(
  accessToken: string,
  signal?: AbortSignal,
): Promise<OwnerFavorite[]> {
  const payload =
    await ownerFetch<{
      items: OwnerFavorite[];
    }>(
      `${API_BASE_URL}/api/v1/owner/favorites/`,
      accessToken,
      {
        method: "GET",
        signal,
      },
    );

  return payload.items;
}


export function createOwnerFavorite(
  accessToken: string,
  input: {
    number: string;
    alias: string | null;
  },
) {
  return ownerFetch<{
    ok: true;
    status: "created";
    favorite_id: string;
    created_at: string | null;
    message: string;
  }>(
    `${API_BASE_URL}/api/v1/owner/favorites/`,
    accessToken,
    {
      method: "POST",

      headers: {
        "Content-Type":
          "application/json",
      },

      body: JSON.stringify(
        input,
      ),
    },
  );
}


export function updateOwnerFavorite(
  accessToken: string,
  favoriteId: string,
  alias: string | null,
) {
  return ownerFetch<{
    ok: true;
    status: "updated";
    message: string;
  }>(
    `${API_BASE_URL}/api/v1/owner/favorites/${encodeURIComponent(favoriteId)}/`,
    accessToken,
    {
      method: "PATCH",

      headers: {
        "Content-Type":
          "application/json",
      },

      body: JSON.stringify({
        alias,
      }),
    },
  );
}


export function deleteOwnerFavorite(
  accessToken: string,
  favoriteId: string,
) {
  return ownerFetch<{
    ok: true;
    status: "deleted";
    message: string;
  }>(
    `${API_BASE_URL}/api/v1/owner/favorites/${encodeURIComponent(favoriteId)}/`,
    accessToken,
    {
      method: "DELETE",
    },
  );
}



export type OwnerOrderItem = {
  kind: string | null;
  ref: string | null;
  qty: number;
  unit_price_gnf: number;
  label: string;
};


export type OwnerOrderPlan = {
  id: string | null;
  code: string;
  label: string;
  active: boolean | null;
};


export type OwnerOrderSite = {
  id: string;
  sequence_no: number;
  place_type: string;
  place_name: string | null;
  address_line: string | null;
  access_point_note: string | null;
  beacon_id: string | null;
  status: string;
};


export type OwnerOrderPayment = {
  id: string;
  provider: string | null;
  external_ref: string | null;
  amount_gnf: number;
  status: string;
  paid_at: string | null;
  confirmed_at: string | null;
};


export type OwnerOrderInvoice = {
  id: string;
  number: string;
  pdf_url: string | null;
  amount_gnf: number;
  status: string;
  issued_at: string | null;
  paid_at: string | null;
};


export type OwnerOrder = {
  id: string;
  order_ref: string;
  offer_code: string;
  amount_gnf: number;
  status: string;
  created_at: string | null;
  items: OwnerOrderItem[];
  beacon_id: string | null;
  business_id: string | null;
  plan: OwnerOrderPlan | null;
  sites: OwnerOrderSite[];
  payment: OwnerOrderPayment | null;
  invoice: OwnerOrderInvoice | null;
};


export async function listOwnerOrders(
  accessToken: string,
  signal?: AbortSignal,
): Promise<OwnerOrder[]> {
  const payload =
    await ownerFetch<{
      items: OwnerOrder[];
    }>(
      `${API_BASE_URL}/api/v1/owner/orders/`,
      accessToken,
      {
        method: "GET",
        signal,
      },
    );

  return payload.items;
}



export type OwnerReport = {
  id: string;
  type:
    | "report"
    | "moving";
  reason: string;
  description: string | null;
  status: string;
  created_at: string | null;
  public_number: string | null;
  admin_response: string | null;
};


export type OwnerClaim = {
  id: string;
  status: string;
  decision_note: string | null;
  created_at: string;
  decided_at: string | null;
  public_number: string | null;
};


export async function listOwnerReports(
  accessToken: string,
  signal?: AbortSignal,
): Promise<OwnerReport[]> {
  const payload =
    await ownerFetch<{
      items: OwnerReport[];
    }>(
      `${API_BASE_URL}/api/v1/owner/reports/`,
      accessToken,
      {
        method: "GET",
        signal,
      },
    );

  return payload.items;
}


export async function listOwnerClaims(
  accessToken: string,
  signal?: AbortSignal,
): Promise<OwnerClaim[]> {
  const payload =
    await ownerFetch<{
      items: OwnerClaim[];
    }>(
      `${API_BASE_URL}/api/v1/owner/claims/`,
      accessToken,
      {
        method: "GET",
        signal,
      },
    );

  return payload.items;
}



export type OwnerProfile = {
  id: string;
  full_name: string | null;
  phone: string | null;
  role: string;
  created_at: string | null;
};


export function getOwnerProfile(
  accessToken: string,
  signal?: AbortSignal,
) {
  return ownerFetch<OwnerProfile>(
    `${API_BASE_URL}/api/v1/owner/profile/`,
    accessToken,
    {
      method: "GET",
      signal,
    },
  );
}


export function updateOwnerProfile(
  accessToken: string,
  input: {
    full_name: string | null;
    phone: string | null;
  },
) {
  return ownerFetch<{
    ok: true;
    status: "updated";
    message: string;
    profile: OwnerProfile;
  }>(
    `${API_BASE_URL}/api/v1/owner/profile/`,
    accessToken,
    {
      method: "PATCH",

      headers: {
        "Content-Type":
          "application/json",
      },

      body: JSON.stringify(
        input,
      ),
    },
  );
}

export type OwnerAccountDeactivationResult = {
  ok: true;
  status: "deactivated";
  deactivated_at: string;
  audit_id: string;
  push_subscriptions_revoked: number;
  sessions_revoked: boolean;
  message: string;
};


export function deactivateOwnerAccount(
  accessToken: string,
) {
  return ownerFetch<OwnerAccountDeactivationResult>(
    `${API_BASE_URL}/api/v1/owner/account/deactivate/`,
    accessToken,
    {
      method: "POST",

      headers: {
        "Content-Type":
          "application/json",
      },

      body: JSON.stringify({
        confirm: "DESACTIVER",
      }),
    },
  );
}
