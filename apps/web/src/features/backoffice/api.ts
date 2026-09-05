const API_BASE_URL = (
  process.env.NEXT_PUBLIC_API_URL ??
  "http://127.0.0.1:8000"
).replace(/\/$/, "");


export type BackofficeIdentity = {
  user_id: string;
  role:
    | "support"
    | "admin"
    | "super_admin";
  full_name: string | null;
};


export type BackofficeMeResponse = {
  authenticated: true;
  user: BackofficeIdentity;
};


export type ClaimStatus =
  | "pending"
  | "approved"
  | "rejected";


export type BackofficeClaim = {
  id: string;
  status: ClaimStatus;
  evidence: string | null;
  reason: string | null;
  proof_url: string | null;
  decision_note: string | null;
  created_at: string;
  decided_at: string | null;
  decided_by: string | null;
  beacon_id: string;
  beacon_number: string;
  requester_id: string;
  requester_name: string | null;
  requester_phone: string | null;
  requester_email: string | null;
  unclaimed_owner: {
    id: string;
    name: string | null;
    phone: string | null;
  } | null;
};


export type BackofficeClaimsResponse = {
  items: BackofficeClaim[];
  counts: Record<ClaimStatus, number>;
};


export class BackofficeApiError extends Error {
  statusCode: number;

  constructor(
    message: string,
    statusCode: number,
  ) {
    super(message);
    this.name = "BackofficeApiError";
    this.statusCode = statusCode;
  }
}


async function getErrorMessage(
  response: Response,
): Promise<string> {
  try {
    const payload = (
      await response.json()
    ) as {
      message?: string;
      detail?: string;
    };

    return (
      payload.message ??
      payload.detail ??
      "Une erreur est survenue."
    );
  } catch {
    return "Une erreur est survenue.";
  }
}


async function authenticatedFetch<T>(
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
          Accept: "application/json",
          Authorization:
            `Bearer ${accessToken}`,
          ...(init?.headers ?? {}),
        },

        cache: "no-store",
      },
    );
  } catch {
    throw new BackofficeApiError(
      "Impossible de joindre le service Adresse GN.",
      0,
    );
  }

  if (!response.ok) {
    throw new BackofficeApiError(
      await getErrorMessage(response),
      response.status,
    );
  }

  try {
    return (
      await response.json()
    ) as T;
  } catch {
    throw new BackofficeApiError(
      "Réponse Django invalide.",
      response.status,
    );
  }
}


export function getBackofficeMe(
  accessToken: string,
  signal?: AbortSignal,
) {
  return authenticatedFetch<BackofficeMeResponse>(
    `${API_BASE_URL}/api/v1/backoffice/me/`,
    accessToken,
    {
      method: "GET",
      signal,
    },
  );
}


export function listBackofficeClaims(
  accessToken: string,
  statusFilter: ClaimStatus | null,
  signal?: AbortSignal,
) {
  const params = new URLSearchParams();

  if (statusFilter) {
    params.set(
      "status",
      statusFilter,
    );
  }

  const query =
    params.size > 0
      ? `?${params.toString()}`
      : "";

  return authenticatedFetch<BackofficeClaimsResponse>(
    `${API_BASE_URL}/api/v1/backoffice/claims/${query}`,
    accessToken,
    {
      method: "GET",
      signal,
    },
  );
}


export function decideBackofficeClaim(
  accessToken: string,
  claimId: string,
  input: {
    decision:
      | "approved"
      | "rejected";
    note: string | null;
  },
) {
  return authenticatedFetch<{
    ok: true;
    status: "decided";
    claim_id: string;
    decision:
      | "approved"
      | "rejected";
    message: string;
  }>(
    `${API_BASE_URL}/api/v1/backoffice/claims/${encodeURIComponent(claimId)}/decision/`,
    accessToken,
    {
      method: "POST",

      headers: {
        "Content-Type":
          "application/json",
      },

      body: JSON.stringify(input),
    },
  );
}