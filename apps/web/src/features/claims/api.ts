import {
  getAccessToken,
} from "@/lib/supabase/browser";


const API_BASE_URL = (
  process.env.NEXT_PUBLIC_API_URL ??
  "http://127.0.0.1:8000"
).replace(/\/$/, "");


export type ClaimStatus =
  | "pending"
  | "approved"
  | "rejected"
  | null;


export type ClaimContext = {
  ok: boolean;
  status: string;
  is_mine: boolean;
  claim_status: ClaimStatus;
  message?: string | null;
};


export type ClaimResponse = {
  ok: boolean;
  status: string;
  claim_id: string | null;
  claim_status?: ClaimStatus;
  created_at?: string | null;
  message?: string | null;
};


type CreateClaimInput = {
  ownerName: string;
  phone: string;
  details: string;
  evidenceFile: File | null;
};


function firstMessage(
  value: unknown,
): string | null {
  if (
    typeof value === "string"
  ) {
    return value;
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      const message =
        firstMessage(item);

      if (message) {
        return message;
      }
    }

    return null;
  }

  if (
    value &&
    typeof value === "object"
  ) {
    for (
      const item
      of Object.values(
        value as Record<
          string,
          unknown
        >,
      )
    ) {
      const message =
        firstMessage(item);

      if (message) {
        return message;
      }
    }
  }

  return null;
}


async function accessToken():
  Promise<string> {
  const token =
    await getAccessToken();

  if (!token) {
    throw new Error(
      "Connectez-vous pour réclamer cette adresse.",
    );
  }

  return token;
}


async function parseResponse<T>(
  response: Response,
): Promise<T> {
  let payload: unknown = null;

  try {
    payload =
      await response.json();
  } catch {
    payload = null;
  }

  if (
    response.status === 401 ||
    response.status === 403
  ) {
    throw new Error(
      "Votre session a expiré. Reconnectez-vous.",
    );
  }

  if (!response.ok) {
    const message =
      firstMessage(payload) ??
      "Impossible d'enregistrer la demande.";

    throw new Error(
      message,
    );
  }

  return payload as T;
}


export async function getClaimContext(
  number: string,
  signal?: AbortSignal,
): Promise<ClaimContext> {
  const token =
    await accessToken();

  let response: Response;

  try {
    response = await fetch(
      `${API_BASE_URL}/api/v1/addresses/${encodeURIComponent(number)}/claim/`,
      {
        method: "GET",

        headers: {
          Accept:
            "application/json",

          Authorization:
            `Bearer ${token}`,
        },

        cache: "no-store",

        signal,
      },
    );
  } catch (error) {
    if (
      error instanceof DOMException &&
      error.name === "AbortError"
    ) {
      throw error;
    }

    throw new Error(
      "Impossible de joindre le service Adresse GN.",
    );
  }

  return parseResponse<ClaimContext>(
    response,
  );
}


export async function createAddressClaim(
  number: string,
  input: CreateClaimInput,
): Promise<ClaimResponse> {
  const token =
    await accessToken();

  const body =
    new FormData();

  body.append(
    "owner_name",
    input.ownerName,
  );

  body.append(
    "phone",
    input.phone,
  );

  body.append(
    "details",
    input.details,
  );

  if (input.evidenceFile) {
    body.append(
      "evidence_file",
      input.evidenceFile,
    );
  }

  let response: Response;

  try {
    response = await fetch(
      `${API_BASE_URL}/api/v1/addresses/${encodeURIComponent(number)}/claim/`,
      {
        method: "POST",

        headers: {
          Accept:
            "application/json",

          Authorization:
            `Bearer ${token}`,
        },

        body,
      },
    );
  } catch {
    throw new Error(
      "Impossible de joindre le service Adresse GN.",
    );
  }

  return parseResponse<ClaimResponse>(
    response,
  );
}