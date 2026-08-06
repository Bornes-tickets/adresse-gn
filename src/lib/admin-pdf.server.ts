/** Génération du PDF de planches QR (12 par page A4). Serveur uniquement. */
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import QRCode from "qrcode";

const A4 = { w: 595.28, h: 841.89 };
const COLS = 3;
const ROWS = 4;
const MARGE = 28;

export async function genererPdfQr(
  numeros: string[],
  origine: string,
): Promise<{ base64: string; pages: number }> {
  const doc = await PDFDocument.create();
  const police = await doc.embedFont(StandardFonts.HelveticaBold);
  const petite = await doc.embedFont(StandardFonts.Helvetica);

  const largeurCase = (A4.w - MARGE * 2) / COLS;
  const hauteurCase = (A4.h - MARGE * 2) / ROWS;
  const parPage = COLS * ROWS;
  const pages = Math.max(1, Math.ceil(numeros.length / parPage));

  for (let p = 0; p < pages; p += 1) {
    const page = doc.addPage([A4.w, A4.h]);
    const lot = numeros.slice(p * parPage, (p + 1) * parPage);

    for (let i = 0; i < lot.length; i += 1) {
      const numero = lot[i]!;
      const col = i % COLS;
      const ligne = Math.floor(i / COLS);
      const x0 = MARGE + col * largeurCase;
      const y0 = A4.h - MARGE - (ligne + 1) * hauteurCase;

      page.drawRectangle({
        x: x0 + 4,
        y: y0 + 4,
        width: largeurCase - 8,
        height: hauteurCase - 8,
        borderColor: rgb(0.85, 0.87, 0.9),
        borderWidth: 0.8,
      });

      const qr = QRCode.create(`${origine}/a/${numero}`, { errorCorrectionLevel: "M" });
      const taille = qr.modules.size;
      const dispo = Math.min(largeurCase - 40, hauteurCase - 70);
      const module = dispo / taille;
      const qx = x0 + (largeurCase - dispo) / 2;
      const qy = y0 + hauteurCase - 24 - dispo;

      for (let r = 0; r < taille; r += 1) {
        for (let c = 0; c < taille; c += 1) {
          if (qr.modules.get(r, c)) {
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

      page.drawText(numero, {
        x: x0 + 10,
        y: qy - 22,
        size: 13,
        font: police,
        color: rgb(0.18, 0.29, 0.48),
      });
      page.drawText("adresse.gn", {
        x: x0 + 10,
        y: qy - 36,
        size: 8,
        font: petite,
        color: rgb(0.45, 0.48, 0.55),
      });
    }
  }

  const octets = await doc.save();
  let binaire = "";
  for (let i = 0; i < octets.length; i += 1) binaire += String.fromCharCode(octets[i]!);
  return { base64: btoa(binaire), pages };
}
