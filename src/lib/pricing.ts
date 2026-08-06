/**
 * Catalogue tarifaire Adresse GN (§9.1 du cahier des charges).
 * Constantes en dur pour le MVP — sûr navigateur, aucune dépendance serveur.
 */

export const RESIDENTIAL_DIGITAL = 40_000;
export const RESIDENTIAL_STANDARD = 150_000;
export const RESIDENTIAL_PREMIUM = 300_000;
export const PRO_BASIC_SETUP = 350_000;
export const PRO_BASIC_MONTHLY = 50_000;
export const PRO_PLUS_SETUP = 600_000;
export const PRO_PLUS_MONTHLY = 150_000;
export const INSTITUTIONAL_UNIT_MIN = 60_000;
export const INSTITUTIONAL_UNIT_MAX = 120_000;

export type OfferKind = "beacon" | "activation" | "subscription" | "api" | "other";
export type OfferFamily = "residential" | "pro" | "quote";

export interface Offer {
  code: string;
  label: string;
  setup_gnf: number;
  monthly_gnf: number;
  family: OfferFamily;
  /** Nature des lignes générées dans la commande. */
  kind: OfferKind;
  tagline: string;
  includes: string[];
  /** true = prix sur devis, pas de commande en ligne directe. */
  quoteOnly?: boolean;
}

export const OFFERS: Offer[] = [
  {
    code: "residential_digital",
    label: "Numérique seule",
    setup_gnf: RESIDENTIAL_DIGITAL,
    monthly_gnf: 0,
    family: "residential",
    kind: "activation",
    tagline: "Votre adresse enregistrée, sans balise physique.",
    includes: [
      "Numéro d'adresse unique GN-CKY-XXXXXX",
      "Localisation GPS vérifiée",
      "Partage du lien et de l'itinéraire",
      "Aucune plaque installée",
    ],
  },
  {
    code: "residential_standard",
    label: "Résidentiel Standard",
    setup_gnf: RESIDENTIAL_STANDARD,
    monthly_gnf: 0,
    family: "residential",
    kind: "beacon",
    tagline: "Plaque balise posée par un agent agréé.",
    includes: [
      "Balise physique avec QR code",
      "Pose par un agent Adresse GN",
      "Relevé GPS de précision",
      "Fiche adresse et itinéraire",
    ],
  },
  {
    code: "residential_premium",
    label: "Résidentiel Premium",
    setup_gnf: RESIDENTIAL_PREMIUM,
    monthly_gnf: 0,
    family: "residential",
    kind: "beacon",
    tagline: "Balise renforcée et point d'accès détaillé.",
    includes: [
      "Balise renforcée longue durée",
      "Pose prioritaire sous 72 h",
      "Note d'accès détaillée (portail, étage)",
      "Assistance au remplacement 12 mois",
    ],
  },
  {
    code: "pro_basic",
    label: "Pro Basic",
    setup_gnf: PRO_BASIC_SETUP,
    monthly_gnf: PRO_BASIC_MONTHLY,
    family: "pro",
    kind: "subscription",
    tagline: "Fiche établissement pour les commerces.",
    includes: [
      "1 fiche établissement",
      "Nom, téléphone, horaires",
      "Statistiques de base (30 jours)",
      "QR code téléchargeable",
    ],
  },
  {
    code: "pro_plus",
    label: "Pro Plus",
    setup_gnf: PRO_PLUS_SETUP,
    monthly_gnf: PRO_PLUS_MONTHLY,
    family: "pro",
    kind: "subscription",
    tagline: "Fiche enrichie, équipe et statistiques avancées.",
    includes: [
      "Fiche enrichie (photos, description)",
      "Statistiques détaillées 90 jours",
      "Équipe multi-utilisateurs",
      "Support prioritaire",
    ],
  },
  {
    code: "multi_site",
    label: "Multi-sites",
    setup_gnf: 0,
    monthly_gnf: 0,
    family: "quote",
    kind: "other",
    quoteOnly: true,
    tagline: "Réseaux, franchises et enseignes multi-agences.",
    includes: [
      "Nombre de sites illimité",
      "Tableau de bord consolidé",
      "Accès API dédié",
      "Tarif négocié selon volume",
    ],
  },
  {
    code: "institutional",
    label: "Institutionnel",
    setup_gnf: INSTITUTIONAL_UNIT_MIN,
    monthly_gnf: 0,
    family: "quote",
    kind: "other",
    quoteOnly: true,
    tagline: "Communes, ministères, opérateurs de réseaux.",
    includes: [
      `Adressage de masse : ${INSTITUTIONAL_UNIT_MIN.toLocaleString("fr-FR")} à ${INSTITUTIONAL_UNIT_MAX.toLocaleString("fr-FR")} GNF par unité`,
      "Campagne d'adressage terrain encadrée",
      "Export des données et API",
      "Convention et facturation sur devis",
    ],
  },
];

export function getOffer(code: string): Offer | undefined {
  return OFFERS.find((o) => o.code === code);
}

export interface OrderItem {
  kind: OfferKind;
  ref: string;
  qty: number;
  unit_price_gnf: number;
  label: string;
}

/** Lignes de commande générées pour une offre (installation + 1er mois). */
export function buildOrderItems(offer: Offer): OrderItem[] {
  const items: OrderItem[] = [];
  if (offer.setup_gnf > 0) {
    items.push({
      kind: offer.kind,
      ref: offer.code,
      qty: 1,
      unit_price_gnf: offer.setup_gnf,
      label:
        offer.family === "pro" ? `${offer.label} — frais d'installation` : offer.label,
    });
  }
  if (offer.monthly_gnf > 0) {
    items.push({
      kind: "subscription",
      ref: offer.code,
      qty: 1,
      unit_price_gnf: offer.monthly_gnf,
      label: `${offer.label} — abonnement 1 mois`,
    });
  }
  return items;
}

export function itemsTotal(items: OrderItem[]): number {
  return items.reduce((t, i) => t + i.unit_price_gnf * i.qty, 0);
}

export const PAYMENT_PROVIDER_LABELS: Record<string, string> = {
  manual: "Paiement manuel",
  orange: "Orange Money",
  mtn: "MTN Mobile Money",
  card: "Carte bancaire",
};

export const ORDER_STATUS_LABELS: Record<string, string> = {
  pending: "En attente de paiement",
  paid: "Payée",
  cancelled: "Annulée",
  failed: "Échouée",
};

export const PAYMENT_STATUS_LABELS: Record<string, string> = {
  pending: "En attente",
  success: "Confirmé",
  failed: "Échoué",
};
