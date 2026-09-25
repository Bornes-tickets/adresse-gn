export type ClientType =
  | "particulier"
  | "professionnel"
  | "institutionnel";

export type OtpChannel =
  | "whatsapp"
  | "email"
  | "sms";

export type PublicPlan = {
  id: string;
  code: string;
  name: Record<string, string> | null;
  description: Record<string, string> | null;
  features: Record<string, unknown> | null;
  price_gnf: number;
  price_from_gnf: number | null;
  price_to_gnf: number | null;
  recurring_price_gnf: number;
  billing_period: string;
  audience: string | null;
  requires_quote: boolean;
  plate_available: boolean;
  plate_included: boolean;
  installation_required: boolean;
  popular: boolean;
  active: boolean;
  position: number;
};

export type ReferenceItem = {
  id: string;
  name: string;
  code?: string | null;
};

export type CheckoutDraft = {
  clientType: ClientType;
  placeType: "residential" | "business" | "company" | "other";
  placeName: string;
  lat: number | null;
  lng: number | null;
  accuracyM: number | null;
  regionId: string;
  prefectureId: string;
  communeId: string;
  districtId: string;
  sectorId: string;
  addressLine: string;
  accessPointNote: string;
  fullName: string;
  phone: string;
  email: string;
  planCode: string;
  paymentMethod: string;
};

export type CheckoutCreatedOrder = {
  order_id: string;
  order_ref: string;
  guest_token: string;
};

export type PublicTrackingOrder = {
  id: string;
  order_ref: string;
  status: string;
  client_type: string | null;
  full_name: string | null;
  phone: string | null;
  address_line: string | null;
  quartier: string | null;
  formule_code: string | null;
  formule_label: string | null;
  prix_ttc: number;
  payment_method: string | null;
  devis_demande: boolean;
  fulfillment_kind: string;
  installation_status: string | null;
  created_at: string;
};
