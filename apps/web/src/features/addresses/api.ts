import type {
  AddressSearchResponse,
} from "./types";


const API_BASE_URL = (
  process.env.NEXT_PUBLIC_API_URL ??
  "http://127.0.0.1:8000"
).replace(/\/$/, "");


async function readJsonResponse(
  response: Response,
): Promise<AddressSearchResponse> {
  try {
    return (
      await response.json()
    ) as AddressSearchResponse;
  } catch {
    throw new Error(
      "Le serveur Adresse GN a retourné une réponse invalide.",
    );
  }
}


export async function searchAddress(
  number: string,
  signal?: AbortSignal,
): Promise<AddressSearchResponse> {
  let response: Response;

  try {
    response = await fetch(
      `${API_BASE_URL}/api/v1/addresses/search/`,
      {
        method: "POST",

        headers: {
          "Content-Type":
            "application/json",

          Accept:
            "application/json",
        },

        body: JSON.stringify({
          number,
        }),

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

  const payload =
    await readJsonResponse(response);

  if (response.status >= 500) {
    throw new Error(
      payload.message ??
        "Une erreur est survenue sur le service Adresse GN.",
    );
  }

  return payload;
}


export async function getAddressDetail(
  number: string,
  signal?: AbortSignal,
): Promise<AddressSearchResponse> {
  let response: Response;

  try {
    response = await fetch(
      `${API_BASE_URL}/api/v1/addresses/${encodeURIComponent(number)}/`,
      {
        method: "GET",

        headers: {
          Accept:
            "application/json",
        },

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

  const payload =
    await readJsonResponse(response);

  if (response.status >= 500) {
    throw new Error(
      payload.message ??
        "Une erreur est survenue sur le service Adresse GN.",
    );
  }

  return payload;
}