/** Utilitaires géographiques et de formatage — sûrs côté navigateur. */

export const V1_BEACON_REGEX =
  /^[A-Z]{3}\d{2}-\d{9}$/;

export const BEACON_REGEX =
  V1_BEACON_REGEX;


export function normalizeBeaconNumber(
  input: string,
): string {
  const raw =
    input
      .trim()
      .toUpperCase();

  const compact =
    raw.replace(
      /[^A-Z0-9]/g,
      "",
    );

  const v1Match =
    compact.match(
      /^([A-Z]{3}\d{2})(\d{9})$/,
    );

  if (v1Match) {
    return (
      `${v1Match[1]}-` +
      `${v1Match[2]}`
    );
  }

  return raw;
}


export function isValidBeaconNumber(
  value: string,
): boolean {
  return BEACON_REGEX.test(
    value
  );
}


/** Distance haversine en kilomètres. */
export function haversineKm(
  from: { lat: number; lng: number },
  to: { lat: number; lng: number },
): number {
  const R = 6371;

  const dLat =
    ((to.lat - from.lat) * Math.PI) /
    180;

  const dLng =
    ((to.lng - from.lng) * Math.PI) /
    180;

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(
      (from.lat * Math.PI) / 180
    ) *
      Math.cos(
        (to.lat * Math.PI) / 180
      ) *
      Math.sin(dLng / 2) ** 2;

  return (
    2 *
    R *
    Math.asin(
      Math.min(
        1,
        Math.sqrt(a),
      ),
    )
  );
}


/** "850 m" ou "12,4 km". */
export function formatDistance(
  km: number,
): string {
  if (km < 1) {
    return `${Math.round(
      km * 1000
    )} m`;
  }

  return (
    `${km
      .toFixed(1)
      .replace(".", ",")} km`
  );
}


export const CATEGORY_LABELS:
  Record<string, string> = {
    habitation: "Habitation",
    commerce: "Commerce",
    restaurant: "Restaurant",
    hotel: "Hôtel",
    pharmacie: "Pharmacie",
    sante: "Santé",
    ecole: "École",
    administration:
      "Administration",
    bureau: "Bureau",
    service: "Service",
    banque: "Banque",
    autre: "Autre",
  };


export function categoryLabel(
  category:
    | string
    | null
    | undefined,
): string {
  if (!category) {
    return "Non catégorisé";
  }

  return (
    CATEGORY_LABELS[category]
    ?? category
  );
}


/**
 * Catégories considérées comme commerciales
 * pour la page établissement.
 */
export const COMMERCIAL_CATEGORIES = [
  "commerce",
  "restaurant",
  "hotel",
  "pharmacie",
  "sante",
  "banque",
  "bureau",
  "service",
  "administration",
  "ecole",
];


export function isCommercialCategory(
  category:
    | string
    | null
    | undefined,
): boolean {
  return (
    !!category &&
    COMMERCIAL_CATEGORIES.includes(
      category
    )
  );
}


export const DAYS_FR: {
  key: string;
  label: string;
}[] = [
  {
    key: "mon",
    label: "Lundi",
  },
  {
    key: "tue",
    label: "Mardi",
  },
  {
    key: "wed",
    label: "Mercredi",
  },
  {
    key: "thu",
    label: "Jeudi",
  },
  {
    key: "fri",
    label: "Vendredi",
  },
  {
    key: "sat",
    label: "Samedi",
  },
  {
    key: "sun",
    label: "Dimanche",
  },
];


/** Clé du jour courant ("mon"…"sun"). */
export function todayKey(
  date = new Date(),
): string {
  const keys = [
    "sun",
    "mon",
    "tue",
    "wed",
    "thu",
    "fri",
    "sat",
  ];

  return keys[
    date.getDay()
  ]!;
}
