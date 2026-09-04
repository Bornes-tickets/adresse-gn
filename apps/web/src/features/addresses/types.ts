export type AddressSearchStatus =
  | "found"
  | "not_found"
  | "rate_limited"
  | "invalid"
  | "error";

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

export interface AddressSearchResponse {
  status: AddressSearchStatus;

  beacon_id: string | null;

  result: BeaconResult | null;

  retry_after_seconds?: number;

  message?: string;
}