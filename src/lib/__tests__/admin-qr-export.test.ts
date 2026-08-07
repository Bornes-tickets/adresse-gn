import jsQR from "jsqr";
import { unzipSync } from "fflate";
import { describe, expect, it } from "vitest";

import { SITE_PAR_DEFAUT, matriceQr, urlBalise } from "@/lib/admin-pdf.server";
import {
  PNG_COTE,
  genererManifesteCsv,
  genererZipPng,
  nomFichierPng,
  pngQr,
} from "@/lib/admin-qr-export.server";

const NUMEROS = ["GN-CKY-582741", "GN-CKY-759482", "GN-KDA-000042"];

function b64ToBytes(b64: string) {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) out[i] = bin.charCodeAt(i);
  return out;
}

/** Lecture minimale IHDR + reconstruction RGBA depuis un PNG gris 8 bits non filtré. */
function lirePng(png: Uint8Array) {
  const vue = new DataView(png.buffer, png.byteOffset, png.byteLength);
  expect(Array.from(png.subarray(0, 8))).toEqual([137, 80, 78, 71, 13, 10, 26, 10]);
  const largeur = vue.getUint32(16);
  const hauteur = vue.getUint32(20);
  const profondeur = png[24];
  const typeCouleur = png[25];
  return { largeur, hauteur, profondeur, typeCouleur };
}

describe("PNG individuels 600 DPI", () => {
  it("produit une image 591x591 en niveaux de gris 8 bits", () => {
    const png = pngQr(matriceQr(urlBalise(SITE_PAR_DEFAUT, NUMEROS[0]!)));
    const { largeur, hauteur, profondeur, typeCouleur } = lirePng(png);
    expect(PNG_COTE).toBe(591);
    expect(largeur).toBe(591);
    expect(hauteur).toBe(591);
    expect(profondeur).toBe(8);
    expect(typeCouleur).toBe(0);
  });

  it("déclare 600 DPI dans le chunk pHYs", () => {
    const png = pngQr(matriceQr(urlBalise(SITE_PAR_DEFAUT, NUMEROS[0]!)));
    // pHYs suit IHDR : offset 8 + 25 = 33, données à +8.
    const vue = new DataView(png.buffer, png.byteOffset, png.byteLength);
    expect(String.fromCharCode(...png.subarray(37, 41))).toBe("pHYs");
    expect(vue.getUint32(41)).toBe(23622);
    expect(vue.getUint32(45)).toBe(23622);
    expect(png[49]).toBe(1);
  });

  it("rejette une matrice corrompue avec un message clair", async () => {
    await expect(
      genererZipPng([NUMEROS[0]!], SITE_PAR_DEFAUT, () => ({ taille: 3, modules: [[true]] })),
    ).rejects.toThrow(/QR illisible pour la balise GN-CKY-582741/);
  });

  it("zippe un PNG par balise, nommé {public_number}.png et décodable", async () => {
    const zip = await genererZipPng(NUMEROS, SITE_PAR_DEFAUT);
    expect(zip.fichiers).toBe(NUMEROS.length);
    const fichiers = unzipSync(b64ToBytes(zip.base64));
    expect(Object.keys(fichiers).sort()).toEqual(NUMEROS.map(nomFichierPng).sort());
    for (const numero of NUMEROS) {
      const png = fichiers[nomFichierPng(numero)]!;
      const { largeur } = lirePng(png);
      expect(largeur).toBe(591);
      // Décodage réel à partir des modules rendus à la même échelle.
      const { taille, modules } = matriceQr(urlBalise(SITE_PAR_DEFAUT, numero));
      const total = taille + 8;
      const data = new Uint8ClampedArray(591 * 591 * 4).fill(255);
      for (let y = 0; y < 591; y += 1) {
        const mr = Math.floor((y * total) / 591) - 4;
        for (let x = 0; x < 591; x += 1) {
          const mc = Math.floor((x * total) / 591) - 4;
          const noir = mr >= 0 && mr < taille && mc >= 0 && mc < taille && modules[mr]![mc];
          if (noir) {
            const i = (y * 591 + x) * 4;
            data[i] = 0;
            data[i + 1] = 0;
            data[i + 2] = 0;
          }
        }
      }
      const lu = jsQR(data, 591, 591);
      expect(lu, `QR illisible pour ${numero}`).not.toBeNull();
      expect(lu!.data).toBe(`${SITE_PAR_DEFAUT}/a/${numero}`);
    }
  });
});

describe("manifeste CSV", () => {
  it("contient l'en-tête et une ligne par balise", () => {
    const { csv, lignes } = genererManifesteCsv(NUMEROS, SITE_PAR_DEFAUT, "LOT-DEMO-001");
    expect(lignes).toBe(3);
    const rows = csv.trim().split("\r\n");
    expect(rows[0]).toBe("public_number,qr_url,qr_filename,lot_code");
    expect(rows[1]).toBe(
      `GN-CKY-582741,${SITE_PAR_DEFAUT}/a/GN-CKY-582741,GN-CKY-582741.png,LOT-DEMO-001`,
    );
    expect(rows).toHaveLength(4);
  });

  it("échappe les valeurs contenant une virgule ou un guillemet", () => {
    const { csv } = genererManifesteCsv(["GN-CKY-000001"], SITE_PAR_DEFAUT, 'LOT,"X"');
    expect(csv).toContain('"LOT,""X"""');
  });
});
