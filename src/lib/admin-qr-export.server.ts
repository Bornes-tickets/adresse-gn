/**
 * Exports QR pour le fournisseur d'impression : PNG individuels 600 DPI (25x25 mm)
 * zippés, et manifeste CSV pour mail-merge. Serveur uniquement.
 */
import { zipSync, zlibSync } from "fflate";

import { matriceQr, urlBalise, validerMatrice, type MatriceQr } from "@/lib/admin-pdf.server";

/** 25 mm à 600 DPI = 25 / 25.4 * 600 ≈ 590,55 → 591 px (dimension exacte demandée). */
export const PNG_COTE = 591;
export const PNG_DPI = 600;
/** Zone de silence en modules (norme QR : 4 modules minimum). */
const SILENCE = 4;
/** Pixels par mètre pour le chunk pHYs (600 DPI). */
const PPM = Math.round(PNG_DPI / 0.0254);

const TABLE_CRC = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(octets: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < octets.length; i += 1) c = TABLE_CRC[(c ^ octets[i]!) & 0xff]! ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type: string, data: Uint8Array): Uint8Array {
  const out = new Uint8Array(data.length + 12);
  const vue = new DataView(out.buffer);
  vue.setUint32(0, data.length);
  for (let i = 0; i < 4; i += 1) out[4 + i] = type.charCodeAt(i);
  out.set(data, 8);
  vue.setUint32(data.length + 8, crc32(out.subarray(4, data.length + 8)) >>> 0);
  return out;
}

/**
 * Rendu du QR en PNG niveaux de gris 8 bits, fond blanc, modules noirs,
 * à la dimension exacte PNG_COTE x PNG_COTE.
 */
export function pngQr(matrice: MatriceQr, cote = PNG_COTE): Uint8Array {
  const { taille, modules } = matrice;
  const total = taille + SILENCE * 2;
  // Une ligne = 1 octet de filtre + cote octets de pixels.
  const brut = new Uint8Array((cote + 1) * cote);
  for (let y = 0; y < cote; y += 1) {
    const ligneBase = y * (cote + 1);
    brut[ligneBase] = 0; // filtre None
    const mr = Math.floor((y * total) / cote) - SILENCE;
    for (let x = 0; x < cote; x += 1) {
      const mc = Math.floor((x * total) / cote) - SILENCE;
      const noir =
        mr >= 0 && mr < taille && mc >= 0 && mc < taille ? modules[mr]![mc] === true : false;
      brut[ligneBase + 1 + x] = noir ? 0 : 255;
    }
  }

  const ihdr = new Uint8Array(13);
  const vue = new DataView(ihdr.buffer);
  vue.setUint32(0, cote);
  vue.setUint32(4, cote);
  ihdr[8] = 8; // profondeur
  ihdr[9] = 0; // niveaux de gris
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const phys = new Uint8Array(9);
  const vuePhys = new DataView(phys.buffer);
  vuePhys.setUint32(0, PPM);
  vuePhys.setUint32(4, PPM);
  phys[8] = 1; // unité = mètre

  const morceaux = [
    new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", ihdr),
    chunk("pHYs", phys),
    chunk("IDAT", zlibSync(brut, { level: 9 })),
    chunk("IEND", new Uint8Array(0)),
  ];
  const taillePng = morceaux.reduce((s, m) => s + m.length, 0);
  const png = new Uint8Array(taillePng);
  let o = 0;
  for (const m of morceaux) {
    png.set(m, o);
    o += m.length;
  }
  return png;
}

/** Nom de fichier PNG d'une balise. */
export function nomFichierPng(numero: string): string {
  return `${numero}.png`;
}

function base64(octets: Uint8Array): string {
  let binaire = "";
  const pas = 0x8000;
  for (let i = 0; i < octets.length; i += pas) {
    binaire += String.fromCharCode(...octets.subarray(i, i + pas));
  }
  return btoa(binaire);
}

/** ZIP de PNG individuels, un par balise. */
export async function genererZipPng(
  numeros: string[],
  baseUrl: string,
  fabriquerMatrice: (contenu: string) => MatriceQr = matriceQr,
): Promise<{ base64: string; fichiers: number; cote: number }> {
  const racine = baseUrl.replace(/\/+$/, "");
  const entrees: Record<string, Uint8Array> = {};
  for (const numero of numeros) {
    let brute: MatriceQr | null = null;
    try {
      brute = fabriquerMatrice(urlBalise(racine, numero));
    } catch (e) {
      throw new Error(
        `QR illisible pour la balise ${numero} : ${e instanceof Error ? e.message : "encodage impossible"}. Export ZIP annulé.`,
      );
    }
    entrees[nomFichierPng(numero)] = pngQr(validerMatrice(brute, numero));
  }
  const zip = zipSync(entrees, { level: 6 });
  return { base64: base64(zip), fichiers: numeros.length, cote: PNG_COTE };
}

/** Échappement CSV (RFC 4180). */
function champ(v: string): string {
  return /[",\r\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}

/** Manifeste CSV pour le mail-merge du fournisseur. */
export function genererManifesteCsv(
  numeros: string[],
  baseUrl: string,
  lotCode: string,
): { csv: string; base64: string; lignes: number } {
  const racine = baseUrl.replace(/\/+$/, "");
  const lignes = ["public_number,qr_url,qr_filename,lot_code"];
  for (const numero of numeros) {
    lignes.push(
      [numero, urlBalise(racine, numero), nomFichierPng(numero), lotCode].map(champ).join(","),
    );
  }
  const csv = `${lignes.join("\r\n")}\r\n`;
  return { csv, base64: base64(new TextEncoder().encode(csv)), lignes: numeros.length };
}
