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
  /** Clé d'idempotence générée par le mobile (mode offline). */
  client_uuid?: string | null;
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

/** Taille maximale acceptée pour une photo stockée localement (octets). */
export const PHOTO_MAX_OCTETS = 500 * 1024;

/** Poids approximatif en octets d'une image encodée en data URL base64. */
export function tailleDataUrl(dataUrl: string): number {
  const base64 = dataUrl.includes(",") ? dataUrl.slice(dataUrl.indexOf(",") + 1) : dataUrl;
  return Math.round((base64.length * 3) / 4);
}

/** Convertit une data URL en Blob (stockage IndexedDB). */
export function dataUrlVersBlob(dataUrl: string): Blob {
  const base64 = dataUrl.includes(",") ? dataUrl.slice(dataUrl.indexOf(",") + 1) : dataUrl;
  const binaire = atob(base64);
  const octets = new Uint8Array(binaire.length);
  for (let i = 0; i < binaire.length; i += 1) octets[i] = binaire.charCodeAt(i);
  return new Blob([octets], { type: "image/jpeg" });
}

/** Reconvertit un Blob stocké en data URL pour l'envoi serveur. */
export function blobVersDataUrl(blob: Blob): Promise<string> {
  return new Promise((resoudre, rejeter) => {
    const lecteur = new FileReader();
    lecteur.onload = () => resoudre(String(lecteur.result));
    lecteur.onerror = () => rejeter(new Error("Lecture de la photo impossible"));
    lecteur.readAsDataURL(blob);
  });
}

/** Compresse une image côté client : 1600px max, JPEG qualité 0.85 (0.75 si > 500 Ko). */
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
  const normale = canvas.toDataURL("image/jpeg", 0.85);
  if (tailleDataUrl(normale) <= PHOTO_MAX_OCTETS) return normale;
  return canvas.toDataURL("image/jpeg", 0.75);
}
