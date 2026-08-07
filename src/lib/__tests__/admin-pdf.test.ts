import jsQR from "jsqr";
import { afterEach, describe, expect, it } from "vitest";

import { SITE_PAR_DEFAUT, baseSite, matriceQr, urlBalise } from "@/lib/admin-pdf.server";

const NUMEROS = [
  "GN-CKY-582741",
  "GN-CKY-759482",
  "GN-CKY-100001",
  "GN-KDA-000042",
  "GN-CKY-999999",
];

/** Rend la matrice de modules en RGBA (avec zone de silence) pour un décodage réel. */
function rendreRgba(modules: boolean[][], echelle = 4, silence = 4) {
  const taille = modules.length;
  const cote = (taille + silence * 2) * echelle;
  const data = new Uint8ClampedArray(cote * cote * 4).fill(255);
  for (let r = 0; r < taille; r += 1) {
    for (let c = 0; c < taille; c += 1) {
      if (!modules[r]![c]) continue;
      for (let dy = 0; dy < echelle; dy += 1) {
        for (let dx = 0; dx < echelle; dx += 1) {
          const y = (r + silence) * echelle + dy;
          const x = (c + silence) * echelle + dx;
          const i = (y * cote + x) * 4;
          data[i] = 0;
          data[i + 1] = 0;
          data[i + 2] = 0;
        }
      }
    }
  }
  return { data, cote };
}

function decoder(contenu: string) {
  const { modules } = matriceQr(contenu);
  const { data, cote } = rendreRgba(modules);
  const lu = jsQR(data, cote, cote);
  expect(lu, `QR illisible pour ${contenu}`).not.toBeNull();
  return lu!;
}

describe("base du site", () => {
  const initial = process.env["PUBLIC_SITE_URL"];
  afterEach(() => {
    if (initial === undefined) delete process.env["PUBLIC_SITE_URL"];
    else process.env["PUBLIC_SITE_URL"] = initial;
  });

  it("utilise la valeur par défaut sans PUBLIC_SITE_URL", () => {
    delete process.env["PUBLIC_SITE_URL"];
    expect(baseSite()).toBe(SITE_PAR_DEFAUT);
    expect(SITE_PAR_DEFAUT).toBe("https://adresse-gn.lovable.app");
  });

  it("lit PUBLIC_SITE_URL et retire le slash final", () => {
    process.env["PUBLIC_SITE_URL"] = "https://adresse.gn/";
    expect(baseSite()).toBe("https://adresse.gn");
  });
});

describe("contenu des QR exportés", () => {
  it("encode exactement l'URL absolue basée sur PUBLIC_SITE_URL", () => {
    process.env["PUBLIC_SITE_URL"] = "https://adresse-gn.lovable.app";
    const base = baseSite();
    for (const numero of NUMEROS) {
      const attendu = `https://adresse-gn.lovable.app/a/${numero}`;
      expect(urlBalise(base, numero)).toBe(attendu);
      expect(decoder(urlBalise(base, numero)).data).toBe(attendu);
    }
  });

  it("suit un changement de domaine de production", () => {
    process.env["PUBLIC_SITE_URL"] = "https://adresse.gn";
    const url = urlBalise(baseSite(), "GN-CKY-582741");
    expect(decoder(url).data).toBe("https://adresse.gn/a/GN-CKY-582741");
  });

  it("génère des QR en correction d'erreur H", () => {
    // Le niveau H produit une version plus grande que L pour le même contenu.
    const url = urlBalise(SITE_PAR_DEFAUT, "GN-CKY-582741");
    expect(matriceQr(url).taille).toBeGreaterThanOrEqual(37);
  });
});
