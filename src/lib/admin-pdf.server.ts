/** Génération du PDF de planches QR (12 par page A4, prêt à l'impression). Serveur uniquement. */
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import QRCode from "qrcode";

const A4 = { w: 595.28, h: 841.89 };
const COLS = 3;
const ROWS = 4;
const MARGE = 28;
/** 25 mm en points PDF (unités vectorielles → densité illimitée à l'impression). */
const QR_MM = 25;
const TAILLE_QR = (QR_MM / 25.4) * 72;

/** Trait pointillé horizontal/vertical pour les marges de coupe. */
function pointilles(
  page: ReturnType<PDFDocument["addPage"]>,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
) {
  page.drawLine({
    start: { x: x1, y: y1 },
    end: { x: x2, y: y2 },
    thickness: 0.5,
    color: rgb(0.7, 0.72, 0.76),
    dashArray: [2, 3],
  });
}

/** Base absolue du site de production, surchargée par PUBLIC_SITE_URL. */
export const SITE_PAR_DEFAUT = "https://adresse-gn.lovable.app";

export function baseSite(): string {
  const brut = (process.env["PUBLIC_SITE_URL"] ?? "").trim();
  if (!brut) return SITE_PAR_DEFAUT;
  try {
    const u = new URL(brut);
    if (u.protocol !== "http:" && u.protocol !== "https:") return SITE_PAR_DEFAUT;
    if (!u.hostname) return SITE_PAR_DEFAUT;
    return `${u.origin}${u.pathname}`.replace(/\/+$/, "");
  } catch {
    return SITE_PAR_DEFAUT;
  }
}

/** URL absolue encodée dans le QR d'une balise. */
export function urlBalise(baseUrl: string, numero: string): string {
  return `${baseUrl.replace(/\/+$/, "")}/a/${numero}`;
}

export type MatriceQr = { taille: number; modules: boolean[][] };

/** Matrice de modules du QR réellement dessiné (correction d'erreur H). */
export function matriceQr(contenu: string): MatriceQr {
  const qr = QRCode.create(contenu, { errorCorrectionLevel: "H" });
  const taille = qr.modules.size;
  const modules: boolean[][] = [];
  for (let r = 0; r < taille; r += 1) {
    const ligne: boolean[] = [];
    for (let c = 0; c < taille; c += 1) ligne.push(Boolean(qr.modules.get(r, c)));
    modules.push(ligne);
  }
  return { taille, modules };
}

/**
 * Refuse une matrice inutilisable (vide, non carrée, taille incohérente, modules manquants)
 * avec un message explicite désignant la balise fautive.
 */
export function validerMatrice(matrice: MatriceQr | null | undefined, numero: string): MatriceQr {
  const echec = (raison: string): never => {
    throw new Error(`QR illisible pour la balise ${numero} : ${raison}. Export PDF annulé.`);
  };
  if (!matrice || !Array.isArray(matrice.modules)) echec("matrice QR absente");
  const { taille, modules } = matrice!;
  if (!Number.isInteger(taille) || taille < 21) echec(`taille de matrice invalide (${String(taille)})`);
  if (modules.length !== taille) echec(`nombre de lignes incohérent (${modules.length} au lieu de ${taille})`);
  for (let r = 0; r < taille; r += 1) {
    const ligne = modules[r];
    if (!Array.isArray(ligne) || ligne.length !== taille) {
      echec(`ligne ${r} corrompue (matrice non carrée)`);
    }
    for (let c = 0; c < taille; c += 1) {
      if (typeof ligne![c] !== "boolean") echec(`module (${r}, ${c}) invalide`);
    }
  }
  return matrice!;
}

export async function genererPdfQr(
  numeros: string[],
  baseUrl: string,
  fabriquerMatrice: (contenu: string) => MatriceQr = matriceQr,
): Promise<{ base64: string; pages: number; url0: string }> {

  const racine = baseUrl.replace(/\/+$/, "");
  const doc = await PDFDocument.create();
  const mono = await doc.embedFont(StandardFonts.CourierBold);
  const petite = await doc.embedFont(StandardFonts.Helvetica);


  const largeurCase = (A4.w - MARGE * 2) / COLS;
  const hauteurCase = (A4.h - MARGE * 2) / ROWS;
  const parPage = COLS * ROWS;
  const pages = Math.max(1, Math.ceil(numeros.length / parPage));

  for (let p = 0; p < pages; p += 1) {
    const page = doc.addPage([A4.w, A4.h]);
    const lot = numeros.slice(p * parPage, (p + 1) * parPage);

    // Marges de coupe pointillées : grille complète 3x4.
    for (let c = 0; c <= COLS; c += 1) {
      const x = MARGE + c * largeurCase;
      pointilles(page, x, MARGE, x, A4.h - MARGE);
    }
    for (let r = 0; r <= ROWS; r += 1) {
      const y = MARGE + r * hauteurCase;
      pointilles(page, MARGE, y, A4.w - MARGE, y);
    }

    for (let i = 0; i < lot.length; i += 1) {
      const numero = lot[i]!;
      const col = i % COLS;
      const ligne = Math.floor(i / COLS);
      const x0 = MARGE + col * largeurCase;
      const y0 = A4.h - MARGE - (ligne + 1) * hauteurCase;

      // Correction d'erreur H (≈30 % de redondance) pour l'extérieur.
      const { taille, modules } = matriceQr(urlBalise(racine, numero));
      const module = TAILLE_QR / taille;
      const qx = x0 + (largeurCase - TAILLE_QR) / 2;
      const qy = y0 + (hauteurCase - TAILLE_QR) / 2 + 16;

      for (let r = 0; r < taille; r += 1) {
        for (let c = 0; c < taille; c += 1) {
          if (modules[r]![c]) {

            page.drawRectangle({
              x: qx + c * module,
              y: qy + (taille - 1 - r) * module,
              width: module,
              height: module,
              color: rgb(0, 0, 0),
            });
          }
        }
      }

      const tailleTexte = 11;
      const largeurTexte = mono.widthOfTextAtSize(numero, tailleTexte);
      page.drawText(numero, {
        x: x0 + (largeurCase - largeurTexte) / 2,
        y: qy - 18,
        size: tailleTexte,
        font: mono,
        color: rgb(0.1, 0.12, 0.16),
      });
      const legende = "adresse.gn";
      page.drawText(legende, {
        x: x0 + (largeurCase - petite.widthOfTextAtSize(legende, 7)) / 2,
        y: qy - 30,
        size: 7,
        font: petite,
        color: rgb(0.45, 0.48, 0.55),
      });
    }
  }

  const octets = await doc.save();
  let binaire = "";
  for (let i = 0; i < octets.length; i += 1) binaire += String.fromCharCode(octets[i]!);
  return { base64: btoa(binaire), pages, url0: `${racine}/a/${numeros[0] ?? ""}` };
}
