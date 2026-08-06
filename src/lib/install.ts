/** Types partagés (client + serveur) du workflow d'installation agent. */

export interface InstallMeasure {
  lat: number;
  lng: number;
  accuracy_m: number;
  taken_at: string;
}

export interface InstallPayload {
  beacon_number: string;
  measures: InstallMeasure[];
  photo_base64: string;
  category: string;
  name: string | null;
  visibility: "private" | "public";
  access_point_note: string | null;
  owner_name: string | null;
  owner_phone: string | null;
  consent: boolean;
}

export interface InstallResult {
  success: boolean;
  code?: string;
  message?: string;
  address_id?: string;
  public_url?: string;
}

/** Numéro WhatsApp du superviseur (support terrain). */
export const SUPERVISOR_WHATSAPP = "224620000000";

export const ETAPES = ["Balise", "Position", "Photo", "Détails", "Récapitulatif"] as const;

/** Seuils de précision GPS (mètres). */
export const PRECISION_OK = 10;
export const PRECISION_LIMITE = 15;

export function precisionCouleur(accuracy: number): string {
  if (accuracy <= PRECISION_OK) return "text-accent";
  if (accuracy <= PRECISION_LIMITE) return "text-[oklch(0.72_0.16_65)]";
  return "text-destructive";
}

/** Moyenne arithmétique d'une série de nombres. */
export function moyenne(valeurs: number[]): number {
  if (valeurs.length === 0) return 0;
  return valeurs.reduce((total, valeur) => total + valeur, 0) / valeurs.length;
}

/** Compresse une image côté client : 1600px max, JPEG qualité 0.85. */
export async function compresserImage(fichier: File): Promise<string> {
  const bitmap = await createImageBitmap(fichier);
  const max = 1600;
  const ratio = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * ratio);
  canvas.height = Math.round(bitmap.height * ratio);
  const contexte = canvas.getContext("2d");
  if (!contexte) throw new Error("Compression impossible");
  contexte.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return canvas.toDataURL("image/jpeg", 0.85);
}
