/** Génération du PDF officiel Bon de commande. Serveur uniquement. */
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { PDFDocument, StandardFonts, rgb } = require("pdf-lib");

const A4 = { w: 595.28, h: 841.89 };
const MARGE = 40;

export interface POForPdf {
  po_number: string;
  issued_at: string;
  expected_delivery: string | null;
  supplier: { name: string; contact_name?: string | null; email?: string | null; phone?: string | null; address?: string | null; rccm?: string | null; nif?: string | null };
  lines: { designation: string; category?: string | null; quantity: number; unit_price_ht: number; line_total_ht: number }[];
  amount_ht: number;
  tva_rate: number;
  tva_amount: number;
  amount_ttc: number;
  payment_terms: string;
  delivery_address?: string | null;
  notes?: string | null;
}

function fmt(n: number): string {
  return new Intl.NumberFormat("fr-FR").format(n);
}
function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("fr-FR");
}

export async function genererPdfBonCommande(po: POForPdf): Promise<{ base64: string }> {
  const doc = await PDFDocument.create();
  const page = doc.addPage([A4.w, A4.h]);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const reg = await doc.embedFont(StandardFonts.Helvetica);
  const mono = await doc.embedFont(StandardFonts.CourierBold);
  const orange = rgb(0.98, 0.45, 0.09);
  const slate900 = rgb(0.06, 0.09, 0.15);
  const slate600 = rgb(0.35, 0.4, 0.47);
  const slate200 = rgb(0.89, 0.9, 0.92);
  let y = A4.h - MARGE;
  // ==== EN-TÊTE ====
  page.drawRectangle({ x: 0, y: y - 60, width: A4.w, height: 60, color: orange });
  page.drawText("ADRESSE GN", { x: MARGE, y: y - 30, size: 22, font: bold, color: rgb(1, 1, 1) });
  page.drawText("Système d'adressage QR de la Guinée", { x: MARGE, y: y - 48, size: 9, font: reg, color: rgb(1, 1, 1) });
  page.drawText("BON DE COMMANDE", { x: A4.w - MARGE - 130, y: y - 25, size: 14, font: bold, color: rgb(1, 1, 1) });
  page.drawText(po.po_number, { x: A4.w - MARGE - 130, y: y - 43, size: 12, font: mono, color: rgb(1, 1, 1) });
  y -= 90;
  // ==== INFOS ÉMETTEUR & DESTINATAIRE ====
  const colW = (A4.w - MARGE * 2 - 20) / 2;
  page.drawText("ÉMETTEUR", { x: MARGE, y, size: 8, font: bold, color: slate600 });
  y -= 14;
  page.drawText("Adresse GN SARL", { x: MARGE, y, size: 10, font: bold, color: slate900 });
  y -= 12;
  page.drawText("Conakry, République de Guinée", { x: MARGE, y, size: 9, font: reg, color: slate600 });
  y -= 11;
  page.drawText("contact@adresse.gn", { x: MARGE, y, size: 9, font: reg, color: slate600 });
  y -= 11;
  page.drawText("Tél. : +224 XXX XX XX XX", { x: MARGE, y, size: 9, font: reg, color: slate600 });
  let y2 = A4.h - MARGE - 90;
  const xDest = MARGE + colW + 20;
  page.drawText("DESTINATAIRE", { x: xDest, y: y2, size: 8, font: bold, color: slate600 });
  y2 -= 14;
  page.drawText(po.supplier.name, { x: xDest, y: y2, size: 10, font: bold, color: slate900 });
  y2 -= 12;
  if (po.supplier.contact_name) { page.drawText(`À l'attention de ${po.supplier.contact_name}`, { x: xDest, y: y2, size: 9, font: reg, color: slate600 }); y2 -= 11; }
  if (po.supplier.address) { page.drawText(po.supplier.address, { x: xDest, y: y2, size: 9, font: reg, color: slate600 }); y2 -= 11; }
  if (po.supplier.email) { page.drawText(po.supplier.email, { x: xDest, y: y2, size: 9, font: reg, color: slate600 }); y2 -= 11; }
  if (po.supplier.phone) { page.drawText(`Tél. : ${po.supplier.phone}`, { x: xDest, y: y2, size: 9, font: reg, color: slate600 }); y2 -= 11; }
  y = Math.min(y, y2) - 20;
  // ==== RÉFÉRENCES ====
  page.drawRectangle({ x: MARGE, y: y - 40, width: A4.w - MARGE * 2, height: 40, color: rgb(0.98, 0.95, 0.9), borderColor: slate200, borderWidth: 0.5 });
  page.drawText("DATE ÉMISSION", { x: MARGE + 10, y: y - 15, size: 7, font: bold, color: slate600 });
  page.drawText(fmtDate(po.issued_at), { x: MARGE + 10, y: y - 30, size: 10, font: bold, color: slate900 });
  page.drawText("LIVRAISON PRÉVUE", { x: MARGE + 180, y: y - 15, size: 7, font: bold, color: slate600 });
  page.drawText(fmtDate(po.expected_delivery), { x: MARGE + 180, y: y - 30, size: 10, font: bold, color: slate900 });
  page.drawText("CONDITIONS PAIEMENT", { x: MARGE + 350, y: y - 15, size: 7, font: bold, color: slate600 });
  page.drawText(po.payment_terms, { x: MARGE + 350, y: y - 30, size: 10, font: bold, color: slate900 });
  y -= 60;
  // ==== TABLEAU LIGNES ====
  const colDesignation = MARGE;
  const colQte = MARGE + 260;
  const colPu = MARGE + 320;
  const colTotal = MARGE + 430;
  const rowH = 22;
  page.drawRectangle({ x: MARGE, y: y - rowH, width: A4.w - MARGE * 2, height: rowH, color: slate900 });
  page.drawText("DÉSIGNATION", { x: colDesignation + 8, y: y - 15, size: 9, font: bold, color: rgb(1, 1, 1) });
  page.drawText("QTÉ", { x: colQte + 8, y: y - 15, size: 9, font: bold, color: rgb(1, 1, 1) });
  page.drawText("PU HT", { x: colPu + 8, y: y - 15, size: 9, font: bold, color: rgb(1, 1, 1) });
  page.drawText("TOTAL HT", { x: colTotal + 8, y: y - 15, size: 9, font: bold, color: rgb(1, 1, 1) });
  y -= rowH;
  for (const line of po.lines) {
    if (y < 200) break;
    page.drawText(line.designation, { x: colDesignation + 8, y: y - 14, size: 9, font: reg, color: slate900 });
    if (line.category) {
      page.drawText(line.category, { x: colDesignation + 8, y: y - 24, size: 7, font: reg, color: slate600 });
    }
    page.drawText(String(line.quantity), { x: colQte + 8, y: y - 14, size: 9, font: bold, color: slate900 });
    page.drawText(fmt(line.unit_price_ht), { x: colPu + 8, y: y - 14, size: 9, font: reg, color: slate900 });
    page.drawText(fmt(line.line_total_ht), { x: colTotal + 8, y: y - 14, size: 9, font: bold, color: slate900 });
    page.drawLine({ start: { x: MARGE, y: y - 32 }, end: { x: A4.w - MARGE, y: y - 32 }, thickness: 0.3, color: slate200 });
    y -= 32;
  }
  y -= 20;
  // ==== TOTAUX ====
  const xTot = A4.w - MARGE - 200;
  page.drawText("Total HT", { x: xTot, y, size: 10, font: reg, color: slate600 });
  page.drawText(`${fmt(po.amount_ht)} GNF`, { x: xTot + 100, y, size: 10, font: reg, color: slate900 });
  y -= 16;
  page.drawText(`TVA ${po.tva_rate}%`, { x: xTot, y, size: 10, font: reg, color: slate600 });
  page.drawText(`${fmt(po.tva_amount)} GNF`, { x: xTot + 100, y, size: 10, font: reg, color: slate900 });
  y -= 20;
  page.drawRectangle({ x: xTot - 10, y: y - 8, width: 210, height: 30, color: orange });
  page.drawText("TOTAL TTC", { x: xTot, y, size: 12, font: bold, color: rgb(1, 1, 1) });
  page.drawText(`${fmt(po.amount_ttc)} GNF`, { x: xTot + 100, y, size: 12, font: bold, color: rgb(1, 1, 1) });
  y -= 40;
  // ==== NOTES ====
  if (po.notes) {
    page.drawText("NOTES", { x: MARGE, y, size: 8, font: bold, color: slate600 });
    y -= 14;
    page.drawText(po.notes.slice(0, 300), { x: MARGE, y, size: 9, font: reg, color: slate900 });
    y -= 20;
  }
  // ==== CONDITIONS + SIGNATURE ====
  y = 140;
  page.drawLine({ start: { x: MARGE, y }, end: { x: A4.w - MARGE, y }, thickness: 0.5, color: slate200 });
  y -= 20;
  page.drawText("CONDITIONS GÉNÉRALES", { x: MARGE, y, size: 8, font: bold, color: slate600 });
  y -= 12;
  page.drawText("• Livraison à l'adresse indiquée · Colisage & bordereau obligatoires", { x: MARGE, y, size: 8, font: reg, color: slate600 });
  y -= 10;
  page.drawText(`• Paiement : ${po.payment_terms} après réception facture conforme`, { x: MARGE, y, size: 8, font: reg, color: slate600 });
  y -= 10;
  page.drawText("• Toute non-conformité doit être signalée sous 48h", { x: MARGE, y, size: 8, font: reg, color: slate600 });
  page.drawText("Signature émetteur", { x: A4.w - MARGE - 180, y: 60, size: 8, font: bold, color: slate600 });
  page.drawRectangle({ x: A4.w - MARGE - 180, y: 25, width: 160, height: 30, borderColor: slate200, borderWidth: 0.5, color: rgb(1, 1, 1) });
  page.drawText(`Bon de commande ${po.po_number} · Adresse GN · ${fmtDate(po.issued_at)}`, {
    x: MARGE, y: 15, size: 7, font: reg, color: slate600,
  });
  const octets = await doc.save();
  let binaire = "";
  for (let i = 0; i < octets.length; i += 1) binaire += String.fromCharCode(octets[i]!);
  return { base64: btoa(binaire) };
}
