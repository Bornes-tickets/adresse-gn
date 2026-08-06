/** Types et libellés partagés des portails propriétaire et professionnel (sûrs navigateur). */

export const PLANS = [
  {
    code: "basic",
    label: "Basic",
    setupGnf: 350_000,
    monthlyGnf: 50_000,
    features: [
      "1 fiche établissement",
      "Nom, téléphone, horaires",
      "Statistiques de base (30 jours)",
      "QR code téléchargeable",
    ],
  },
  {
    code: "plus",
    label: "Plus",
    setupGnf: 600_000,
    monthlyGnf: 150_000,
    features: [
      "Fiche enrichie (photos, description)",
      "Statistiques détaillées 90 jours",
      "Équipe multi-utilisateurs",
      "Support prioritaire",
    ],
  },
] as const;

export type PlanCode = (typeof PLANS)[number]["code"];

export const PLAN_LABELS: Record<string, string> = {
  basic: "Basic",
  plus: "Plus",
  multi_site: "Multi-sites",
  institutional: "Institutionnel",
};

export const TEAM_ROLE_LABELS: Record<string, string> = {
  owner: "Propriétaire",
  editor: "Éditeur",
  viewer: "Lecteur",
};

export const CLAIM_STATUS_LABELS: Record<string, string> = {
  pending: "En attente",
  approved: "Approuvée",
  rejected: "Rejetée",
};

export const REPORT_REASON_LABELS: Record<string, string> = {
  wrong_location: "Localisation incorrecte",
  closed: "Lieu fermé ou inexistant",
  damaged_beacon: "Balise abîmée",
  moving: "Déménagement",
  other: "Autre",
};

export const JOURS = [
  { key: "mon", label: "Lundi" },
  { key: "tue", label: "Mardi" },
  { key: "wed", label: "Mercredi" },
  { key: "thu", label: "Jeudi" },
  { key: "fri", label: "Vendredi" },
  { key: "sat", label: "Samedi" },
  { key: "sun", label: "Dimanche" },
] as const;

export function formatGnf(montant: number | null | undefined): string {
  if (montant === null || montant === undefined) return "—";
  return `${montant.toLocaleString("fr-FR")} GNF`;
}

export function planLabel(code: string | null | undefined): string {
  if (!code) return "Aucune offre";
  return PLAN_LABELS[code] ?? code;
}

export interface OwnerBeacon {
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
  searches_30d: { day: string; count: number }[];
}

export interface OwnerDashboard {
  beaconCount: number;
  searches30d: number;
  routes30d: number;
  activities: { label: string; detail: string; at: string }[];
}

export interface OwnerFavorite {
  id: string;
  alias: string | null;
  created_at: string;
  public_number: string;
  name: string | null;
  category: string | null;
}

export interface OwnerReport {
  id: string;
  reason: string;
  description: string | null;
  status: string;
  created_at: string;
  public_number: string | null;
  admin_response: string | null;
}

export interface BeaconContext {
  address_id: string | null;
  owner_id: string | null;
  is_mine: boolean;
  establishment_id: string | null;
  favorite_id: string | null;
  claim_status: string | null;
}

export interface BusinessProfile {
  id: string;
  owner_id: string;
  legal_name: string | null;
  trade_name: string;
  category: string | null;
  tax_id: string | null;
  headquarters_address: string | null;
  contact_phone: string | null;
  contact_email: string | null;
  plan_code: string | null;
  plan_started_at: string | null;
  plan_ends_at: string | null;
  created_at: string;
  my_role: string;
}

export interface ProEstablishment {
  id: string;
  address_id: string;
  business_name: string;
  phone: string | null;
  description: string | null;
  cover_url: string | null;
  opening_hours: Record<string, string> | null;
  public_number: string;
  category: string;
  photos: { id: string; url: string; order: number | null }[];
}

export interface ProStats {
  searchesByDay: { day: string; count: number }[];
  routesByProvider: { provider: string; count: number }[];
  conversion: number;
  heatmap: { hour: number; count: number }[];
  totalSearches: number;
  totalRoutes: number;
}

export interface ApiKeyRow {
  id: string;
  prefix: string;
  scopes: string[] | null;
  quota_month: number | null;
  active: boolean;
  created_at: string;
  usage_month: number;
}
