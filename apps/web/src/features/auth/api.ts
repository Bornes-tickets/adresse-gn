const API_BASE_URL = (
  process.env.NEXT_PUBLIC_API_URL ??
  "http://127.0.0.1:8000"
).replace(/\/$/, "");

export type AuthenticatedUser = {
  id: string;
  email: string | null;
  role: string | null;
};

export type AuthMeResponse = {
  authenticated: true;
  user: AuthenticatedUser;
};

export async function verifyDjangoSession(
  accessToken: string,
  signal?: AbortSignal,
): Promise<AuthMeResponse> {
  let response: Response;

  try {
    response = await fetch(
      `${API_BASE_URL}/api/v1/auth/me/`,
      {
        method: "GET",
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${accessToken}`,
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

  if (!response.ok) {
    if (
      response.status === 401 ||
      response.status === 403
    ) {
      throw new Error(
        "La session Supabase n'a pas été acceptée par Django.",
      );
    }

    throw new Error(
      "La vérification de la session a échoué.",
    );
  }

  try {
    return (
      await response.json()
    ) as AuthMeResponse;
  } catch {
    throw new Error(
      "Django a retourné une réponse d'authentification invalide.",
    );
  }
}
