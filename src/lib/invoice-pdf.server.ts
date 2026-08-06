/** Génération du PDF de facture (pdf-lib). Serveur uniquement. */
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

import type { OrderItem } from "@/lib/pricing";

const A4 = { w: 595.28, h: 841.89 };
const MARGE = 48;
const PRIMAIRE = rgb(0.18, 0.29, 0.48);
const GRIS = rgb(0.45, 0.48, 0.55);

export interface InvoiceData {
  number: string;
  issuedAt: string;
  orderRef: string;
  clientName: string;
  clientPhone: string | null;
  clientEmail: string | null;
  items: OrderItem[];
  totalGnf: number;
}

function gnf(montant: number): string {
  return `${montant.toLocaleString("fr-FR")} GNF`;
}

export async function genererPdfFacture(data: InvoiceData): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const page = doc.addPage([A4.w, A4.h]);
  const gras = await doc.embedFont(StandardFonts.HelveticaBold);
  const normal = await doc.embedFont(StandardFonts.Helvetica);

  const legalName = process.env["INVOICE_LEGAL_NAME"] ?? "ADRESSE GN SARL";
  const legalAddress =
    process.env["INVOICE_LEGAL_ADDRESS"] ?? "Kaloum, Conakry, République de Guinée";
  const legalId = process.env["INVOICE_LEGAL_ID"] ?? "NIF-XXXXXXX";

  let y = A4.h - MARGE;

  page.drawText("ADRESSE GN", { x: MARGE, y: y - 6, size: 22, font: gras, color: PRIMAIRE });
  page.drawText("Un lieu · Un numero · Un itineraire", {
    x: MARGE,
    y: y - 22,
    size: 9,
    font: normal,
    color: GRIS,
  });

  page.drawText("FACTURE", { x: A4.w - MARGE - 90, y: y - 6, size: 18, font: gras, color: PRIMAIRE });
  page.drawText(data.number, {
    x: A4.w - MARGE - 90,
    y: y - 22,
    size: 10,
    font: normal,
    color: GRIS,
  });

  y -= 52;
  page.drawLine({
    start: { x: MARGE, y },
    end: { x: A4.w - MARGE, y },
    thickness: 1,
    color: PRIMAIRE,
  });

  y -= 24;
  const emetteur = [legalName, legalAddress, `NIF : ${legalId}`];
  emetteur.forEach((ligne, i) => {
    page.drawText(ligne, { x: MARGE, y: y - i * 13, size: 9, font: normal, color: GRIS });
  });

  const client = [
    "Client",
    data.clientName || "Client Adresse GN",
    data.clientPhone ?? "",
    data.clientEmail ?? "",
  ].filter(Boolean);
  client.forEach((ligne, i) => {
    page.drawText(ligne, {
      x: A4.w / 2 + 20,
      y: y - i * 13,
      size: 9,
      font: i === 0 ? gras : normal,
      color: i === 0 ? PRIMAIRE : GRIS,
    });
  });

  y -= 78;
  page.drawText(`Commande : ${data.orderRef}`, { x: MARGE, y, size: 10, font: normal });
  page.drawText(
    `Date d'emission : ${new Date(data.issuedAt).toLocaleDateString("fr-FR")}`,
    { x: A4.w / 2 + 20, y, size: 10, font: normal },
  );

  y -= 30;
  page.drawRectangle({
    x: MARGE,
    y: y - 6,
    width: A4.w - MARGE * 2,
    height: 22,
    color: rgb(0.95, 0.96, 0.98),
  });
  page.drawText("Designation", { x: MARGE + 8, y, size: 9, font: gras, color: PRIMAIRE });
  page.drawText("Qte", { x: A4.w - MARGE - 190, y, size: 9, font: gras, color: PRIMAIRE });
  page.drawText("Prix unitaire", { x: A4.w - MARGE - 155, y, size: 9, font: gras, color: PRIMAIRE });
  page.drawText("Total", { x: A4.w - MARGE - 60, y, size: 9, font: gras, color: PRIMAIRE });

  y -= 26;
  for (const item of data.items) {
    const libelle = item.label.length > 52 ? `${item.label.slice(0, 51)}…` : item.label;
    page.drawText(libelle.replace(/[^\x20-\x7E]/g, "-"), {
      x: MARGE + 8,
      y,
      size: 9,
      font: normal,
    });
    page.drawText(String(item.qty), { x: A4.w - MARGE - 190, y, size: 9, font: normal });
    page.drawText(gnf(item.unit_price_gnf), {
      x: A4.w - MARGE - 155,
      y,
      size: 9,
      font: normal,
    });
    page.drawText(gnf(item.unit_price_gnf * item.qty), {
      x: A4.w - MARGE - 60,
      y,
      size: 9,
      font: normal,
    });
    y -= 18;
  }

  y -= 8;
  page.drawLine({
    start: { x: A4.w / 2, y },
    end: { x: A4.w - MARGE, y },
    thickness: 0.8,
    color: rgb(0.85, 0.87, 0.9),
  });

  y -= 18;
  page.drawText("Sous-total", { x: A4.w / 2, y, size: 9, font: normal, color: GRIS });
  page.drawText(gnf(data.totalGnf), { x: A4.w - MARGE - 90, y, size: 9, font: normal });
  y -= 15;
  page.drawText("TVA (0%)", { x: A4.w / 2, y, size: 9, font: normal, color: GRIS });
  page.drawText(gnf(0), { x: A4.w - MARGE - 90, y, size: 9, font: normal });
  y -= 20;
  page.drawText("TOTAL A PAYER", { x: A4.w / 2, y, size: 11, font: gras, color: PRIMAIRE });
  page.drawText(gnf(data.totalGnf), {
    x: A4.w - MARGE - 90,
    y,
    size: 11,
    font: gras,
    color: PRIMAIRE,
  });

  y -= 44;
  page.drawText("Facture acquittee. Merci de votre confiance.", {
    x: MARGE,
    y,
    size: 9,
    font: normal,
    color: GRIS,
  });

  const mentions = [
    `${legalName} - ${legalAddress} - NIF ${legalId}`,
    "Montants exprimes en francs guineens (GNF). TVA non applicable a ce stade.",
    "Document genere automatiquement, valant facture.",
  ];
  mentions.forEach((ligne, i) => {
    page.drawText(ligne, {
      x: MARGE,
      y: MARGE + 24 - i * 11,
      size: 7.5,
      font: normal,
      color: GRIS,
    });
  });

  return doc.save();
}
