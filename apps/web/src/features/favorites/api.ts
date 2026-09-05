import {
  getAccessToken,
} from "@/lib/supabase/browser";


const API_BASE_URL = (
  process.env.NEXT_PUBLIC_API_URL ??
  "http://127.0.0.1:8000"
).replace(/\/$/, "");


export type FavoriteState = {
  ok: boolean;
  status: string;
  favorited: boolean;
  favorite_id: string | null;
  alias?: string | null;
  created_at?: string | null;
  message?: string | null;
};


async function authenticatedHeaders():
  Promise<Record<string, string>> {
  const token =
    await getAccessToken();

  if (!token) {
    throw new Error(
      "Connectez-vous pour enregistrer un favori.",
    );
  }

  return {
    Accept:
      "application/json",

    Authorization:
      `Bearer ${token}`,
  };
}


async function readFavoriteResponse(
  response: Response,
): Promise<FavoriteState> {
  let payload: FavoriteState;

  try {
    payload =
      await response.json() as
        FavoriteState;
  } catch {
    throw new Error(
      "Le serveur Adresse GN a retourné une réponse invalide.",
    );
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
    throw new Error(
      payload.message ??
        "Impossible de modifier ce favori.",
    );
  }

  return payload;
}


export async function getFavoriteState(
  number: string,
  signal?: AbortSignal,
): Promise<FavoriteState> {
  const headers =
    await authenticatedHeaders();

  let response: Response;

  try {
    response = await fetch(
      `${API_BASE_URL}/api/v1/addresses/${encodeURIComponent(number)}/favorite/`,
      {
        method: "GET",

        headers,

        signal,

        cache: "no-store",
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

  return readFavoriteResponse(
    response,
  );
}


export async function toggleFavorite(
  number: string,
): Promise<FavoriteState> {
  const headers =
    await authenticatedHeaders();

  let response: Response;

  try {
    response = await fetch(
      `${API_BASE_URL}/api/v1/addresses/${encodeURIComponent(number)}/favorite/`,
      {
        method: "POST",

        headers,

        cache: "no-store",
      },
    );
  } catch {
    throw new Error(
      "Impossible de joindre le service Adresse GN.",
    );
  }

  return readFavoriteResponse(
    response,
  );
}