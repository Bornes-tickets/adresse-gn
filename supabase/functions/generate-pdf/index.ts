// supabase/functions/generate-pdf/index.ts
// Génère les PDF (QR / BC / BL) côté Deno où pdf-lib fonctionne nativement.
// Déploiement : `supabase functions deploy generate-pdf`

import { serve } from "https://deno.land/std@0.203.0/http/server.ts";
import { PDFDocument, StandardFonts, rgb } from "https://esm.sh/pdf-lib@1.17.1";
import QRCode from "https://esm.sh/qrcode@1.5.3";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const A4 = { w: 595.28, h: 841.89 };

/** WinAnsi (polices standard pdf-lib) ne sait pas encoder les espaces fines Unicode (U+202F, U+00A0…). */
function ascii(v: unknown): string {
  return String(v ?? "")
    .replace(/[\u00a0\u202f\u2007\u2008\u2009\u200a\u2060]/g, " ")
    .replace(/[\u2010-\u2015]/g, "-")
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201c\u201d]/g, '"');
}
function fmt(n: number): string {
  return ascii(new Intl.NumberFormat("fr-FR").format(Number(n ?? 0)));
}
function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "-";
  return ascii(new Date(iso).toLocaleDateString("fr-FR"));
}
function bytesToBase64(bytes: Uint8Array): string {
  let bin = "";
  for (let i = 0; i < bytes.length; i += 1) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}

/* ==================== BC ==================== */
async function pdfBc(po: any): Promise<string> {
  const MARGE = 40;
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
  page.drawRectangle({ x: 0, y: y - 60, width: A4.w, height: 60, color: orange });
  page.drawText("ADRESSE GN", { x: MARGE, y: y - 30, size: 22, font: bold, color: rgb(1, 1, 1) });
  page.drawText("Système d'adressage QR de la Guinée", { x: MARGE, y: y - 48, size: 9, font: reg, color: rgb(1, 1, 1) });
  page.drawText("BON DE COMMANDE", { x: A4.w - MARGE - 130, y: y - 25, size: 14, font: bold, color: rgb(1, 1, 1) });
  page.drawText(po.po_number, { x: A4.w - MARGE - 130, y: y - 43, size: 12, font: mono, color: rgb(1, 1, 1) });
  y -= 90;
  page.drawText("ÉMETTEUR", { x: MARGE, y, size: 8, font: bold, color: slate600 });
  y -= 14;
  page.drawText("Adresse GN SARL", { x: MARGE, y, size: 10, font: bold, color: slate900 });
  y -= 12;
  page.drawText("Conakry, République de Guinée", { x: MARGE, y, size: 9, font: reg, color: slate600 });
  const xDest = MARGE + 280;
  let y2 = A4.h - MARGE - 90;
  page.drawText("DESTINATAIRE", { x: xDest, y: y2, size: 8, font: bold, color: slate600 });
  y2 -= 14;
  page.drawText(po.supplier?.name ?? "—", { x: xDest, y: y2, size: 10, font: bold, color: slate900 });
  y2 -= 12;
  if (po.supplier?.address) { page.drawText(String(po.supplier.address).slice(0, 40), { x: xDest, y: y2, size: 9, font: reg, color: slate600 }); y2 -= 11; }
  if (po.supplier?.phone) { page.drawText(`Tél. : ${po.supplier.phone}`, { x: xDest, y: y2, size: 9, font: reg, color: slate600 }); y2 -= 11; }
  y = Math.min(y, y2) - 30;
  page.drawRectangle({ x: MARGE, y: y - 40, width: A4.w - MARGE * 2, height: 40, color: rgb(0.98, 0.95, 0.9), borderColor: slate200, borderWidth: 0.5 });
  page.drawText("DATE ÉMISSION", { x: MARGE + 10, y: y - 15, size: 7, font: bold, color: slate600 });
  page.drawText(fmtDate(po.issued_at), { x: MARGE + 10, y: y - 30, size: 10, font: bold, color: slate900 });
  page.drawText("CONDITIONS PAIEMENT", { x: MARGE + 250, y: y - 15, size: 7, font: bold, color: slate600 });
  page.drawText(po.payment_terms ?? "—", { x: MARGE + 250, y: y - 30, size: 10, font: bold, color: slate900 });
  y -= 60;
  page.drawRectangle({ x: MARGE, y: y - 22, width: A4.w - MARGE * 2, height: 22, color: slate900 });
  page.drawText("DÉSIGNATION", { x: MARGE + 8, y: y - 15, size: 9, font: bold, color: rgb(1, 1, 1) });
  page.drawText("QTÉ", { x: MARGE + 260, y: y - 15, size: 9, font: bold, color: rgb(1, 1, 1) });
  page.drawText("PU HT", { x: MARGE + 320, y: y - 15, size: 9, font: bold, color: rgb(1, 1, 1) });
  page.drawText("TOTAL HT", { x: MARGE + 430, y: y - 15, size: 9, font: bold, color: rgb(1, 1, 1) });
  y -= 22;
  for (const line of po.lines ?? []) {
    page.drawText(String(line.designation).slice(0, 45), { x: MARGE + 8, y: y - 14, size: 9, font: reg, color: slate900 });
    page.drawText(String(line.quantity), { x: MARGE + 260, y: y - 14, size: 9, font: bold, color: slate900 });
    page.drawText(fmt(line.unit_price_ht), { x: MARGE + 320, y: y - 14, size: 9, font: reg, color: slate900 });
    page.drawText(fmt(line.line_total_ht), { x: MARGE + 430, y: y - 14, size: 9, font: bold, color: slate900 });
    y -= 22;
  }
  y -= 20;
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
  page.drawText(`Bon de commande ${po.po_number} · Adresse GN · ${fmtDate(po.issued_at)}`, { x: MARGE, y: 20, size: 7, font: reg, color: slate600 });
  return bytesToBase64(await doc.save());
}

/* ==================== BL ==================== */
async function pdfBl(dn: any): Promise<string> {
  const MARGE = 40;
  const doc = await PDFDocument.create();
  const page = sanitizePage(doc.addPage([A4.w, A4.h]));
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const reg = await doc.embedFont(StandardFonts.Helvetica);
  const mono = await doc.embedFont(StandardFonts.CourierBold);
  const emerald = rgb(0.02, 0.59, 0.41);
  const slate900 = rgb(0.06, 0.09, 0.15);
  const slate600 = rgb(0.35, 0.4, 0.47);
  const slate200 = rgb(0.89, 0.9, 0.92);
  const rose = rgb(0.88, 0.11, 0.28);
  let y = A4.h - MARGE;
  page.drawRectangle({ x: 0, y: y - 60, width: A4.w, height: 60, color: emerald });
  page.drawText("ADRESSE GN", { x: MARGE, y: y - 30, size: 22, font: bold, color: rgb(1, 1, 1) });
  page.drawText("BON DE LIVRAISON", { x: A4.w - MARGE - 130, y: y - 25, size: 14, font: bold, color: rgb(1, 1, 1) });
  page.drawText(dn.dn_number, { x: A4.w - MARGE - 130, y: y - 43, size: 12, font: mono, color: rgb(1, 1, 1) });
  y -= 90;
  page.drawRectangle({ x: MARGE, y: y - 40, width: A4.w - MARGE * 2, height: 40, color: rgb(0.95, 0.98, 0.96), borderColor: slate200, borderWidth: 0.5 });
  page.drawText("BC", { x: MARGE + 10, y: y - 15, size: 7, font: bold, color: slate600 });
  page.drawText(dn.po_number ?? "—", { x: MARGE + 10, y: y - 30, size: 10, font: mono, color: slate900 });
  page.drawText("LOT", { x: MARGE + 180, y: y - 15, size: 7, font: bold, color: slate600 });
  page.drawText(dn.lot_code ?? "—", { x: MARGE + 180, y: y - 30, size: 10, font: mono, color: slate900 });
  page.drawText("RÉCEPTION", { x: MARGE + 350, y: y - 15, size: 7, font: bold, color: slate600 });
  page.drawText(fmtDate(dn.received_at), { x: MARGE + 350, y: y - 30, size: 10, font: bold, color: slate900 });
  y -= 70;
  page.drawText("EXPÉDITEUR", { x: MARGE, y, size: 8, font: bold, color: slate600 });
  y -= 14;
  page.drawText(dn.supplier?.name ?? "—", { x: MARGE, y, size: 10, font: bold, color: slate900 });
  y -= 30;
  page.drawText("TRANSPORT", { x: MARGE, y, size: 8, font: bold, color: slate600 });
  y -= 14;
  page.drawText(dn.carrier ?? "Non spécifié", { x: MARGE, y, size: 10, font: bold, color: slate900 });
  if (dn.tracking_number) { y -= 12; page.drawText(`N° suivi : ${dn.tracking_number}`, { x: MARGE, y, size: 9, font: reg, color: slate600 }); }
  y -= 30;
  page.drawRectangle({ x: MARGE, y: y - 30, width: A4.w - MARGE * 2, height: 30, color: slate900 });
  page.drawText("COMMANDÉE", { x: MARGE + 20, y: y - 20, size: 9, font: bold, color: rgb(1, 1, 1) });
  page.drawText("EXPÉDIÉE", { x: MARGE + 160, y: y - 20, size: 9, font: bold, color: rgb(1, 1, 1) });
  page.drawText("REÇUE", { x: MARGE + 290, y: y - 20, size: 9, font: bold, color: rgb(1, 1, 1) });
  page.drawText("ÉCART", { x: MARGE + 400, y: y - 20, size: 9, font: bold, color: rgb(1, 1, 1) });
  y -= 30;
  page.drawRectangle({ x: MARGE, y: y - 40, width: A4.w - MARGE * 2, height: 40, color: rgb(1, 1, 1), borderColor: slate200, borderWidth: 0.5 });
  page.drawText(fmt(dn.quantity_ordered), { x: MARGE + 20, y: y - 25, size: 16, font: bold, color: slate900 });
  page.drawText(dn.quantity_shipped != null ? fmt(dn.quantity_shipped) : "—", { x: MARGE + 160, y: y - 25, size: 16, font: bold, color: slate900 });
  page.drawText(fmt(dn.quantity_received), { x: MARGE + 290, y: y - 25, size: 16, font: bold, color: emerald });
  const ecart = dn.quantity_received - dn.quantity_ordered;
  page.drawText(ecart === 0 ? "0" : ecart > 0 ? `+${ecart}` : String(ecart), { x: MARGE + 400, y: y - 25, size: 16, font: bold, color: ecart === 0 ? emerald : rose });
  y -= 60;
  const qcColor = dn.qc_passed === true ? emerald : dn.qc_passed === false ? rose : slate600;
  page.drawRectangle({ x: MARGE, y: y - 40, width: A4.w - MARGE * 2, height: 40, color: rgb(1, 1, 1), borderColor: qcColor, borderWidth: 2 });
  page.drawText("CONTRÔLE QUALITÉ", { x: MARGE + 10, y: y - 15, size: 8, font: bold, color: slate600 });
  page.drawText(dn.qc_passed === true ? "CONFORME" : dn.qc_passed === false ? "DÉFAUTS SIGNALÉS" : "En attente", { x: MARGE + 10, y: y - 30, size: 12, font: bold, color: qcColor });
  page.drawText(`Bon de livraison ${dn.dn_number} · Adresse GN · ${fmtDate(dn.received_at)}`, { x: MARGE, y: 20, size: 7, font: reg, color: slate600 });
  return bytesToBase64(await doc.save());
}

/* ==================== QR ==================== */
async function pdfQr(input: { numeros: string[]; baseUrl: string }): Promise<string> {
  const COLS = 3, ROWS = 4, MARGE = 28;
  const TAILLE_QR = (25 / 25.4) * 72;
  const doc = await PDFDocument.create();
  const mono = await doc.embedFont(StandardFonts.CourierBold);
  const petite = await doc.embedFont(StandardFonts.Helvetica);
  const largeurCase = (A4.w - MARGE * 2) / COLS;
  const hauteurCase = (A4.h - MARGE * 2) / ROWS;
  const parPage = COLS * ROWS;
  const pages = Math.max(1, Math.ceil(input.numeros.length / parPage));
  const racine = input.baseUrl.replace(/\/+$/, "");
  for (let p = 0; p < pages; p += 1) {
    const page = sanitizePage(doc.addPage([A4.w, A4.h]));
    const lot = input.numeros.slice(p * parPage, (p + 1) * parPage);
    for (let i = 0; i < lot.length; i += 1) {
      const numero = lot[i];
      const col = i % COLS;
      const ligne = Math.floor(i / COLS);
      const x0 = MARGE + col * largeurCase;
      const y0 = A4.h - MARGE - (ligne + 1) * hauteurCase;
      const qr = QRCode.create(`${racine}/a/${numero}`, { errorCorrectionLevel: "H" });
      const taille = qr.modules.size;
      const moduleSize = TAILLE_QR / taille;
      const qx = x0 + (largeurCase - TAILLE_QR) / 2;
      const qy = y0 + (hauteurCase - TAILLE_QR) / 2 + 16;
      for (let r = 0; r < taille; r += 1) {
        for (let c = 0; c < taille; c += 1) {
          if (qr.modules.get(r, c)) {
            page.drawRectangle({
              x: qx + c * moduleSize,
              y: qy + (taille - 1 - r) * moduleSize,
              width: moduleSize, height: moduleSize, color: rgb(0, 0, 0),
            });
          }
        }
      }
      const tailleTexte = 11;
      const largeurTexte = mono.widthOfTextAtSize(numero, tailleTexte);
      page.drawText(numero, { x: x0 + (largeurCase - largeurTexte) / 2, y: qy - 18, size: tailleTexte, font: mono, color: rgb(0.1, 0.12, 0.16) });
      const legende = "adresse.gn";
      page.drawText(legende, { x: x0 + (largeurCase - petite.widthOfTextAtSize(legende, 7)) / 2, y: qy - 30, size: 7, font: petite, color: rgb(0.45, 0.48, 0.55) });
    }
  }
  return bytesToBase64(await doc.save());
}

/* ==================== ROUTEUR ==================== */
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  try {
    const { type, data } = await req.json();
    let base64: string;
    let pages: number | undefined;
    if (type === "bc") base64 = await pdfBc(data);
    else if (type === "bl") base64 = await pdfBl(data);
    else if (type === "qr") {
      base64 = await pdfQr(data);
      pages = Math.max(1, Math.ceil((data.numeros?.length ?? 0) / 12));
    } else {
      return new Response(JSON.stringify({ error: "type inconnu (attendu : bc | bl | qr)" }), {
        status: 400, headers: { ...CORS, "Content-Type": "application/json" },
      });
    }
    return new Response(JSON.stringify({ base64, pages }), {
      status: 200, headers: { ...CORS, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500, headers: { ...CORS, "Content-Type": "application/json" },
    });
  }
});
