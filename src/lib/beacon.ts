/** Types partagés (client + serveur) pour les résultats de recherche. */

export interface BeaconResult {
  public_number: string;
  name: string | null;
  category: string;
  visibility: string;
  verification_level: string;
  access_point_note: string | null;
  lat: number | null;
  lng: number | null;
  business_name: string | null;
  phone: string | null;
  opening_hours: Record<string, string> | null;
  description: string | null;
  cover_url: string | null;
}

export interface SearchResponse {
  status: "found" | "not_found" | "rate_limited" | "invalid" | "error";
  beacon_id: string | null;
  result: BeaconResult | null;
  retry_after_seconds?: number;
  message?: string;
}

export interface EstablishmentDetails {
  beacon_id: string;
  establishment: {
    id: string;
    business_name: string;
    phone: string | null;
    description: string | null;
    cover_url: string | null;
    opening_hours: Record<string, string> | null;
  } | null;
  photos: { id: string; url: string; order: number | null }[];
}

/** Nom affichable d'une adresse (masque les habitations privées sans commerce). */
export function displayName(result: BeaconResult): string {
  if (result.business_name) return result.business_name;
  if (result.visibility === "private" && !result.name) return "Adresse privée";
  if (result.visibility === "private" && result.category === "habitation") {
    return result.name ?? "Adresse privée";
  }
  return result.name ?? "Adresse privée";
}
