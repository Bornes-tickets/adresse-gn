import {
  getAccessToken,
} from "@/lib/supabase/browser";


const API_BASE_URL = (
  process.env.NEXT_PUBLIC_API_URL ??
  "http://127.0.0.1:8000"
).replace(/\/$/, "");


export type ReportReason =
  | "wrong_location"
  | "closed"
  | "damaged_beacon"
  | "other";


type CreateAddressReportResponse = {
  ok: boolean;
  status: string;
  report_id?: string | null;
  report_status?: string;
  created_at?: string | null;
  message?: string;
};


export async function createAddressReport(
  number: string,
  reason: ReportReason,
  description: string,
): Promise<CreateAddressReportResponse> {
  const token =
    await getAccessToken();

  if (!token) {
    throw new Error(
      "Connectez-vous pour envoyer un signalement.",
    );
  }


  let response: Response;

  try {
    response = await fetch(
      `${API_BASE_URL}/api/v1/addresses/${encodeURIComponent(number)}/report/`,
      {
        method: "POST",

        headers: {
          "Content-Type":
            "application/json",

          Accept:
            "application/json",

          Authorization:
            `Bearer ${token}`,
        },

        body: JSON.stringify({
          reason,

          description:
            description.trim() ||
            null,
        }),

        cache: "no-store",
      },
    );
  } catch {
    throw new Error(
      "Impossible de joindre le service Adresse GN.",
    );
  }


  let payload:
    CreateAddressReportResponse;

  try {
    payload =
      await response.json() as
        CreateAddressReportResponse;
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
        "Le signalement n'a pas pu être enregistré.",
    );
  }


  return payload;
}