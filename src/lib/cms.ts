/** Types et libellés du module CMS (sûrs côté navigateur). */

export const LANGUES = ["fr", "en", "ar"] as const;
export type Langue = (typeof LANGUES)[number];

export const LANGUE_LABELS: Record<Langue, string> = {
  fr: "Français",
  en: "English",
  ar: "العربية",
};

/** Champ texte multilingue : { fr, en, ar }. */
export type Multi = Partial<Record<Langue, string>>;
/** Champ liste multilingue : { fr: string[], … }. */
export type MultiListe = Partial<Record<Langue, string[]>>;

export const CMS_STATUSES = ["draft", "published", "archived"] as const;
export type CmsStatus = (typeof CMS_STATUSES)[number];

export const CMS_STATUS_LABELS: Record<string, string> = {
  draft: "Brouillon",
  published: "Publié",
  archived: "Archivé",
};

export const PERIODES = ["once", "month", "year"] as const;
export type Periode = (typeof PERIODES)[number];

export const PERIODE_LABELS: Record<string, string> = {
  once: "Paiement unique",
  month: "Par mois",
  year: "Par an",
};

export function texte(champ: Multi | null | undefined, langue: Langue = "fr"): string {
  if (!champ) return "";
  return champ[langue] ?? champ.fr ?? champ.en ?? champ.ar ?? "";
}

export function slugifier(valeur: string): string {
  return valeur
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

export function formatGnf(montant: number): string {
  return `${new Intl.NumberFormat("fr-FR").format(montant)} GNF`;
}

export interface CmsPage {
  id: string;
  slug: string;
  status: CmsStatus;
  title: Multi;
  excerpt: Multi;
  body: Multi;
  seo_title: Multi;
  seo_description: Multi;
  cover_url: string | null;
  position: number;
  published_at: string | null;
  updated_at: string;
}

export interface CmsPost {
  id: string;
  slug: string;
  status: CmsStatus;
  category: string | null;
  cover_url: string | null;
  title: Multi;
  excerpt: Multi;
  body: Multi;
  seo_title: Multi;
  seo_description: Multi;
  published_at: string | null;
  updated_at: string;
}

export interface CmsFaq {
  id: string;
  category: string | null;
  question: Multi;
  answer: Multi;
  position: number;
  published: boolean;
  updated_at: string;
}

export interface CmsTranslation {
  id: string;
  namespace: string;
  key: string;
  fr: string | null;
  en: string | null;
  ar: string | null;
  updated_at: string;
}

export interface CmsPlan {
  id: string;
  code: string;
  name: Multi;
  description: Multi;
  features: MultiListe;
  price_gnf: number;
  period: Periode;
  popular: boolean;
  active: boolean;
  position: number;
  updated_at: string;
}
