import jsQR from "jsqr";
import { afterEach, describe, expect, it } from "vitest";

import {
  SITE_PAR_DEFAUT,
  baseSite,
  genererPdfQr,
  matriceQr,
  urlBalise,
  validerMatrice,
} from "@/lib/admin-pdf.server";

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

  it("retombe sur le défaut quand la valeur est vide ou blanche", () => {
    for (const v of ["", "   ", "\n"]) {
      process.env["PUBLIC_SITE_URL"] = v;
      expect(baseSite()).toBe(SITE_PAR_DEFAUT);
    }
  });

  it("retombe sur le défaut quand la valeur est mal formée", () => {
    for (const v of ["adresse-gn.lovable.app", "http://", "://oops", "ftp://adresse.gn", "javascript:alert(1)", "hello world"]) {
      process.env["PUBLIC_SITE_URL"] = v;
      expect(baseSite(), `mal formé accepté : ${v}`).toBe(SITE_PAR_DEFAUT);
    }
  });

  it("tolère espaces et slashes multiples autour d'une URL valide", () => {
    process.env["PUBLIC_SITE_URL"] = "  https://adresse.gn///  ";
    expect(baseSite()).toBe("https://adresse.gn");
  });
});

describe("QR décodé avec fallback", () => {
  const initial = process.env["PUBLIC_SITE_URL"];
  afterEach(() => {
    if (initial === undefined) delete process.env["PUBLIC_SITE_URL"];
    else process.env["PUBLIC_SITE_URL"] = initial;
  });

  it("encode l'URL de secours quand PUBLIC_SITE_URL est absent, vide ou invalide", () => {
    const cas: (string | undefined)[] = [undefined, "", "   ", "adresse-gn.lovable.app", "ftp://adresse.gn"];
    for (const v of cas) {
      if (v === undefined) delete process.env["PUBLIC_SITE_URL"];
      else process.env["PUBLIC_SITE_URL"] = v;
      for (const numero of NUMEROS) {
        const url = urlBalise(baseSite(), numero);
        expect(url).toBe(`${SITE_PAR_DEFAUT}/a/${numero}`);
        expect(decoder(url).data).toBe(`${SITE_PAR_DEFAUT}/a/${numero}`);
      }
    }
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

describe("matrices QR corrompues", () => {
  const NUM = "GN-CKY-582741";
  const saine = () => matriceQr(urlBalise(SITE_PAR_DEFAUT, NUM));

  const cas: { nom: string; fabrique: () => any }[] = [
    { nom: "matrice absente", fabrique: () => null },
    { nom: "modules non tableau", fabrique: () => ({ taille: 37, modules: undefined }) },
    { nom: "taille invalide", fabrique: () => ({ ...saine(), taille: 0 }) },
    { nom: "taille trop petite", fabrique: () => ({ taille: 5, modules: [[true]] }) },
    {
      nom: "lignes manquantes",
      fabrique: () => {
        const m = saine();
        return { taille: m.taille, modules: m.modules.slice(0, -3) };
      },
    },
    {
      nom: "matrice non carrée",
      fabrique: () => {
        const m = saine();
        m.modules[2] = m.modules[2]!.slice(0, 10);
        return m;
      },
    },
    {
      nom: "module non booléen",
      fabrique: () => {
        const m = saine();
        (m.modules[1] as any)[1] = "x";
        return m;
      },
    },
  ];

  for (const c of cas) {
    it(`rejette proprement : ${c.nom}`, () => {
      expect(() => validerMatrice(c.fabrique(), NUM)).toThrowError(
        /^QR illisible pour la balise GN-CKY-582741 : .+\. Export PDF annulé\.$/,
      );
    });

    it(`annule l'export PDF : ${c.nom}`, async () => {
      await expect(genererPdfQr([NUM], SITE_PAR_DEFAUT, c.fabrique)).rejects.toThrow(
        /QR illisible pour la balise GN-CKY-582741/,
      );
    });
  }

  it("propage un message clair quand l'encodeur lui-même échoue", async () => {
    await expect(
      genererPdfQr([NUM], SITE_PAR_DEFAUT, () => {
        throw new Error("contenu trop long");
      }),
    ).rejects.toThrow(
      "QR illisible pour la balise GN-CKY-582741 : contenu trop long. Export PDF annulé.",
    );
  });

  it("accepte une matrice saine et produit un PDF", async () => {
    const pdf = await genererPdfQr([NUM], SITE_PAR_DEFAUT);
    expect(pdf.pages).toBe(1);
    expect(pdf.base64.length).toBeGreaterThan(100);
    expect(pdf.url0).toBe(`${SITE_PAR_DEFAUT}/a/${NUM}`);
  });
});
