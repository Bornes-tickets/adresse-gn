/** Génération du PDF officiel Bon de livraison. Serveur uniquement. */
import * as PDFLib from "pdf-lib";
const { PDFDocument, StandardFonts, rgb } = PDFLib;

const A4 = { w: 595.28, h: 841.89 };
const MARGE = 40;

export interface DNForPdf {
  dn_number: string;
  po_number?: string | null;
  lot_code?: string | null;
  received_at: string;
  shipped_at?: string | null;
  supplier: { name: string; contact_name?: string | null; email?: string | null; phone?: string | null; address?: string | null };
  carrier?: string | null;
  tracking_number?: string | null;
  quantity_ordered: number;
  quantity_shipped?: number | null;
  quantity_received: number;
  qc_passed: boolean | null;
  defects?: string | null;
  receiver_name?: string | null;
  notes?: string | null;
}

function fmt(n: number): string { return new Intl.NumberFormat("fr-FR").format(n); }
function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("fr-FR");
}

export async function genererPdfBonLivraison(dn: DNForPdf): Promise<{ base64: string }> {
  const doc = await PDFDocument.create();
  const page = doc.addPage([A4.w, A4.h]);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const reg = await doc.embedFont(StandardFonts.Helvetica);
  const mono = await doc.embedFont(StandardFonts.CourierBold);
  const emerald = rgb(0.02, 0.59, 0.41);
  const slate900 = rgb(0.06, 0.09, 0.15);
  const slate600 = rgb(0.35, 0.4, 0.47);
  const slate200 = rgb(0.89, 0.9, 0.92);
  const rose = rgb(0.88, 0.11, 0.28);
  let y = A4.h - MARGE;
  // En-tête vert émeraude
  page.drawRectangle({ x: 0, y: y - 60, width: A4.w, height: 60, color: emerald });
  page.drawText("ADRESSE GN", { x: MARGE, y: y - 30, size: 22, font: bold, color: rgb(1, 1, 1) });
  page.drawText("Système d'adressage QR de la Guinée", { x: MARGE, y: y - 48, size: 9, font: reg, color: rgb(1, 1, 1) });
  page.drawText("BON DE LIVRAISON", { x: A4.w - MARGE - 130, y: y - 25, size: 14, font: bold, color: rgb(1, 1, 1) });
  page.drawText(dn.dn_number, { x: A4.w - MARGE - 130, y: y - 43, size: 12, font: mono, color: rgb(1, 1, 1) });
  y -= 90;
  // Références croisées
  page.drawRectangle({ x: MARGE, y: y - 40, width: A4.w - MARGE * 2, height: 40, color: rgb(0.95, 0.98, 0.96), borderColor: slate200, borderWidth: 0.5 });
  page.drawText("BON DE COMMANDE", { x: MARGE + 10, y: y - 15, size: 7, font: bold, color: slate600 });
  page.drawText(dn.po_number ?? "—", { x: MARGE + 10, y: y - 30, size: 10, font: mono, color: slate900 });
  page.drawText("LOT", { x: MARGE + 180, y: y - 15, size: 7, font: bold, color: slate600 });
  page.drawText(dn.lot_code ?? "—", { x: MARGE + 180, y: y - 30, size: 10, font: mono, color: slate900 });
  page.drawText("DATE RÉCEPTION", { x: MARGE + 350, y: y - 15, size: 7, font: bold, color: slate600 });
  page.drawText(fmtDate(dn.received_at), { x: MARGE + 350, y: y - 30, size: 10, font: bold, color: slate900 });
  y -= 60;
  // Expéditeur / Réceptionnaire
  const colW = (A4.w - MARGE * 2 - 20) / 2;
  page.drawText("EXPÉDITEUR", { x: MARGE, y, size: 8, font: bold, color: slate600 });
  y -= 14;
  page.drawText(dn.supplier.name, { x: MARGE, y, size: 10, font: bold, color: slate900 });
  y -= 12;
  if (dn.supplier.address) { page.drawText(dn.supplier.address, { x: MARGE, y, size: 9, font: reg, color: slate600 }); y -= 11; }
  if (dn.supplier.phone) { page.drawText(`Tél. : ${dn.supplier.phone}`, { x: MARGE, y, size: 9, font: reg, color: slate600 }); y -= 11; }
  let y2 = A4.h - MARGE - 150 - 60;
  const xDest = MARGE + colW + 20;
  page.drawText("RÉCEPTIONNAIRE", { x: xDest, y: y2, size: 8, font: bold, color: slate600 });
  y2 -= 14;
  page.drawText("Adresse GN SARL", { x: xDest, y: y2, size: 10, font: bold, color: slate900 });
  y2 -= 12;
  page.drawText("Entrepôt Conakry", { x: xDest, y: y2, size: 9, font: reg, color: slate600 });
  y2 -= 11;
  if (dn.receiver_name) { page.drawText(`Reçu par : ${dn.receiver_name}`, { x: xDest, y: y2, size: 9, font: bold, color: slate900 }); y2 -= 11; }
  y = Math.min(y, y2) - 20;
  // Transport
  page.drawRectangle({ x: MARGE, y: y - 50, width: A4.w - MARGE * 2, height: 50, color: rgb(0.98, 0.99, 0.99), borderColor: slate200, borderWidth: 0.5 });
  page.drawText("TRANSPORT", { x: MARGE + 10, y: y - 15, size: 7, font: bold, color: slate600 });
  page.drawText(dn.carrier ?? "Non spécifié", { x: MARGE + 10, y: y - 30, size: 10, font: bold, color: slate900 });
  if (dn.tracking_number) page.drawText(`N° suivi : ${dn.tracking_number}`, { x: MARGE + 10, y: y - 42, size: 9, font: reg, color: slate600 });
  page.drawText("DATE EXPÉDITION", { x: MARGE + 250, y: y - 15, size: 7, font: bold, color: slate600 });
  page.drawText(fmtDate(dn.shipped_at ?? null), { x: MARGE + 250, y: y - 30, size: 10, font: bold, color: slate900 });
  page.drawText("DATE RÉCEPTION", { x: MARGE + 400, y: y - 15, size: 7, font: bold, color: slate600 });
  page.drawText(fmtDate(dn.received_at), { x: MARGE + 400, y: y - 30, size: 10, font: bold, color: slate900 });
  y -= 70;
  // Tableau des quantités
  page.drawRectangle({ x: MARGE, y: y - 30, width: A4.w - MARGE * 2, height: 30, color: slate900 });
  page.drawText("QTÉ COMMANDÉE", { x: MARGE + 20, y: y - 20, size: 9, font: bold, color: rgb(1, 1, 1) });
  page.drawText("QTÉ EXPÉDIÉE", { x: MARGE + 160, y: y - 20, size: 9, font: bold, color: rgb(1, 1, 1) });
  page.drawText("QTÉ REÇUE", { x: MARGE + 290, y: y - 20, size: 9, font: bold, color: rgb(1, 1, 1) });
  page.drawText("ÉCART", { x: MARGE + 400, y: y - 20, size: 9, font: bold, color: rgb(1, 1, 1) });
  y -= 30;
  page.drawRectangle({ x: MARGE, y: y - 40, width: A4.w - MARGE * 2, height: 40, color: rgb(1, 1, 1), borderColor: slate200, borderWidth: 0.5 });
  page.drawText(fmt(dn.quantity_ordered), { x: MARGE + 20, y: y - 25, size: 16, font: bold, color: slate900 });
  page.drawText(dn.quantity_shipped != null ? fmt(dn.quantity_shipped) : "—", { x: MARGE + 160, y: y - 25, size: 16, font: bold, color: slate900 });
  page.drawText(fmt(dn.quantity_received), { x: MARGE + 290, y: y - 25, size: 16, font: bold, color: emerald });
  const ecart = dn.quantity_received - dn.quantity_ordered;
  const ecartTxt = ecart === 0 ? "0" : ecart > 0 ? `+${ecart}` : String(ecart);
  page.drawText(ecartTxt, { x: MARGE + 400, y: y - 25, size: 16, font: bold, color: ecart === 0 ? emerald : rose });
  y -= 60;
  // Statut QC
  const qcColor = dn.qc_passed === true ? emerald : dn.qc_passed === false ? rose : slate600;
  page.drawRectangle({ x: MARGE, y: y - 40, width: A4.w - MARGE * 2, height: 40, color: rgb(1, 1, 1), borderColor: qcColor, borderWidth: 2 });
  page.drawText("CONTRÔLE QUALITÉ", { x: MARGE + 10, y: y - 15, size: 8, font: bold, color: slate600 });
  page.drawText(
    dn.qc_passed === true ? "✓ CONFORME" : dn.qc_passed === false ? "✗ DÉFAUTS SIGNALÉS" : "En attente",
    { x: MARGE + 10, y: y - 30, size: 12, font: bold, color: qcColor },
  );
  y -= 60;
  if (dn.defects) {
    page.drawText("DÉFAUTS", { x: MARGE, y, size: 8, font: bold, color: rose });
    y -= 14;
    const chunks = dn.defects.match(/.{1,80}/g) ?? [];
    for (const chunk of chunks.slice(0, 4)) {
      page.drawText(chunk, { x: MARGE, y, size: 9, font: reg, color: slate900 });
      y -= 11;
    }
    y -= 10;
  }
  if (dn.notes) {
    page.drawText("NOTES DE RÉCEPTION", { x: MARGE, y, size: 8, font: bold, color: slate600 });
    y -= 14;
    const chunks = dn.notes.match(/.{1,80}/g) ?? [];
    for (const chunk of chunks.slice(0, 4)) {
      page.drawText(chunk, { x: MARGE, y, size: 9, font: reg, color: slate900 });
      y -= 11;
    }
  }
  // Signatures
  const ySig = 100;
  page.drawText("Signature expéditeur", { x: MARGE, y: ySig, size: 8, font: bold, color: slate600 });
  page.drawRectangle({ x: MARGE, y: ySig - 45, width: 200, height: 40, borderColor: slate200, borderWidth: 0.5, color: rgb(1, 1, 1) });
  page.drawText("Signature réceptionnaire", { x: A4.w - MARGE - 200, y: ySig, size: 8, font: bold, color: slate600 });
  page.drawRectangle({ x: A4.w - MARGE - 200, y: ySig - 45, width: 200, height: 40, borderColor: slate200, borderWidth: 0.5, color: rgb(1, 1, 1) });
  if (dn.receiver_name) {
    page.drawText(dn.receiver_name, { x: A4.w - MARGE - 195, y: ySig - 60, size: 9, font: bold, color: slate900 });
  }
  page.drawText(`Bon de livraison ${dn.dn_number} · Adresse GN · ${fmtDate(dn.received_at)}`, {
    x: MARGE, y: 15, size: 7, font: reg, color: slate600,
  });
  const octets = await doc.save();
  let binaire = "";
  for (let i = 0; i < octets.length; i += 1) binaire += String.fromCharCode(octets[i]!);
  return { base64: btoa(binaire) };
}
