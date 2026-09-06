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
