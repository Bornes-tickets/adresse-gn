/** Opérations serveur de l'espace Ops. Bloqué des bundles navigateur. */
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export interface OpsDashboardData {
  balisesTotal: number;
  balisesGenerees: number;
  balisesAssignees: number;
  balisesActives: number;
  balisesSuspendues: number;
  lotsTotal: number;
  lotsGeneres: number;
  lotsDistribues: number;
  installationsMois: number;
  quantiteTotalBalises: number;
  lotsRecents: { id: string; code: string; quantity: number; status: string; category: string | null; received_at: string | null }[];
  stockParCategorie: { categorie: string; total: number }[];
}

export async function chargerDashboardOps(): Promise<OpsDashboardData> {
  const debutMois = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();
  const compte = async (table: string, filter: (q: any) => any) => {
    const { count } = await filter(supabaseAdmin.from(table as any).select("id", { count: "exact", head: true }));
    return count ?? 0;
  };
  const [
    balisesTotal, balisesGenerees, balisesAssignees, balisesActives, balisesSuspendues,
    lotsTotal, lotsGeneres, lotsDistribues, installationsMois,
  ] = await Promise.all([
    compte("beacons", (q) => q),
    compte("beacons", (q) => q.eq("status", "generated")),
    compte("beacons", (q) => q.eq("status", "assigned")),
    compte("beacons", (q) => q.eq("status", "active")),
    compte("beacons", (q) => q.eq("status", "suspended")),
    compte("lots", (q) => q),
    compte("lots", (q) => q.eq("status", "generated")),
    compte("lots", (q) => q.eq("status", "distributed")),
    compte("installations", (q) => q.gte("installed_at", debutMois)),
  ]);
  const { data: lots } = await supabaseAdmin
    .from("lots")
    .select("id, code, quantity, status, category, received_at")
    .order("received_at", { ascending: false })
    .limit(8);
  const quantiteTotalBalises = (lots ?? []).reduce((s, l: any) => s + Number(l.quantity ?? 0), 0);
  const { data: balisesCat } = await supabaseAdmin
    .from("beacons")
    .select("category")
    .limit(20000);
  const parCat = new Map<string, number>();
  for (const b of balisesCat ?? []) {
    const k = (b as any).category ?? "autre";
    parCat.set(k, (parCat.get(k) ?? 0) + 1);
  }
  return {
    balisesTotal, balisesGenerees, balisesAssignees, balisesActives, balisesSuspendues,
    lotsTotal, lotsGeneres, lotsDistribues, installationsMois, quantiteTotalBalises,
    lotsRecents: (lots ?? []) as any[],
    stockParCategorie: [...parCat.entries()].map(([categorie, total]) => ({ categorie, total })).sort((a, b) => b.total - a.total),
  };
}

/* --------------------------- COMMANDES FOURNISSEURS --------------------------- */
export async function majStatutLot(lotId: string, statut: string, actorId: string, notes?: string | null) {
  const patch: Record<string, unknown> = { status: statut };
  if (statut === "sent") patch['sent_at'] = new Date().toISOString();
  if (statut === "received") patch['received_at'] = new Date().toISOString();
  const { error } = await supabaseAdmin.from("lots").update(patch as never).eq("id", lotId);
  if (error) throw new Error(error.message);
  await supabaseAdmin.from("lot_events" as any).insert({
    lot_id: lotId,
    event_type: statut === "sent" ? "sent"
      : statut === "in_production" ? "in_production"
      : statut === "shipped" ? "shipped"
      : statut === "received" ? "received"
      : statut === "distributed" ? "distributed"
      : "note",
    actor_id: actorId,
    notes: notes ?? null,
  });
  return { success: true };
}

export async function ajouterEvenementLot(lotId: string, actorId: string, notes: string) {
  const { error } = await supabaseAdmin.from("lot_events" as any).insert({
    lot_id: lotId, actor_id: actorId, event_type: "note", notes,
  });
  if (error) throw new Error(error.message);
  return { success: true };
}

export async function detailLot(lotId: string) {
  const { data: lot, error } = await supabaseAdmin
    .from("lots")
    .select("*")
    .eq("id", lotId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!lot) throw new Error("Lot introuvable.");
  const { data: events } = await supabaseAdmin
    .from("lot_events" as any)
    .select("*")
    .eq("lot_id", lotId)
    .order("event_at", { ascending: false });
  return { lot, events: events ?? [] };
}

/* --------------------------- STOCK PAR COMMANDE --------------------------- */
export interface StockLot {
  lot_id: string;
  code: string;
  category: string | null;
  supplier: string | null;
  status: string;
  received_at: string | null;
  quantity_ordered: number;
  quantity_generated: number;
  quantity_assigned: number;
  quantity_active: number;
  quantity_suspended: number;
  quantity_cancelled: number;
  quantity_stock: number;
  quantity_used: number;
  taux_consommation: number;
}
export interface StockDashboard {
  lots: StockLot[];
  global: {
    ordered: number;
    stock: number;
    assigned: number;
    active: number;
    suspended: number;
    cancelled: number;
    tauxConsommation: number;
  };
  parCategorie: { categorie: string; stock: number; total: number }[];
}

export async function chargerStock(): Promise<StockDashboard> {
  const { data: lots, error: errLots } = await supabaseAdmin
    .from("lots")
    .select("id, code, category, supplier, status, received_at, quantity")
    .order("received_at", { ascending: false });
  if (errLots) throw new Error(errLots.message);
  const { data: beacons, error: errBeacons } = await supabaseAdmin
    .from("beacons")
    .select("lot_id, status")
    .limit(100000);
  if (errBeacons) throw new Error(errBeacons.message);
  const compteur = new Map<string, Record<string, number>>();
  for (const b of beacons ?? []) {
    if (!b.lot_id) continue;
    const cur = compteur.get(b.lot_id) ?? { generated: 0, assigned: 0, active: 0, suspended: 0, cancelled: 0 };
    cur[b.status] = (cur[b.status] ?? 0) + 1;
    compteur.set(b.lot_id, cur);
  }
  const stockLots: StockLot[] = (lots ?? []).map((l: any) => {
    const c = compteur.get(l.id) ?? { generated: 0, assigned: 0, active: 0, suspended: 0, cancelled: 0 };
    const ordered = Number(l.quantity ?? 0);
    const stock = c['generated'] ?? 0;
    const used = c['active'] ?? 0;
    return {
      lot_id: l.id, code: l.code, category: l.category, supplier: l.supplier,
      status: l.status, received_at: l.received_at,
      quantity_ordered: ordered, quantity_generated: stock,
      quantity_assigned: c['assigned'] ?? 0, quantity_active: used,
      quantity_suspended: c['suspended'] ?? 0, quantity_cancelled: c['cancelled'] ?? 0,
      quantity_stock: stock, quantity_used: used,
      taux_consommation: ordered > 0 ? Math.round(((used + (c['assigned'] ?? 0)) / ordered) * 100) : 0,
    };
  });
  const global = stockLots.reduce(
    (acc, l) => ({
      ordered: acc.ordered + l.quantity_ordered,
      stock: acc.stock + l.quantity_stock,
      assigned: acc.assigned + l.quantity_assigned,
      active: acc.active + l.quantity_active,
      suspended: acc.suspended + l.quantity_suspended,
      cancelled: acc.cancelled + l.quantity_cancelled,
      tauxConsommation: 0,
    }),
    { ordered: 0, stock: 0, assigned: 0, active: 0, suspended: 0, cancelled: 0, tauxConsommation: 0 },
  );
  global.tauxConsommation = global.ordered > 0 ? Math.round(((global.active + global.assigned) / global.ordered) * 100) : 0;
  const parCatMap = new Map<string, { stock: number; total: number }>();
  for (const l of stockLots) {
    const key = l.category ?? "autre";
    const cur = parCatMap.get(key) ?? { stock: 0, total: 0 };
    cur.stock += l.quantity_stock;
    cur.total += l.quantity_ordered;
    parCatMap.set(key, cur);
  }
  const parCategorie = [...parCatMap.entries()]
    .map(([categorie, v]) => ({ categorie, ...v }))
    .sort((a, b) => b.stock - a.stock);
  return { lots: stockLots, global, parCategorie };
}

/* --------------------------- FOURNISSEURS --------------------------- */
export async function listerSuppliers() {
  const { data, error } = await supabaseAdmin.from("suppliers" as any).select("*").order("name");
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function upsertSupplier(input: any) {
  const patch = { ...input, updated_at: new Date().toISOString() };
  if (input.id) {
    const { error } = await supabaseAdmin.from("suppliers" as any).update(patch).eq("id", input.id);
    if (error) throw new Error(error.message);
    return { success: true, id: input.id };
  }
  delete patch.id;
  const { data, error } = await supabaseAdmin.from("suppliers" as any).insert(patch).select("id").single();
  if (error) throw new Error(error.message);
  return { success: true, id: (data as any).id };
}

/* --------------------------- BONS DE COMMANDE --------------------------- */
const CATEGORY_LABELS: Record<string, string> = {
  digital_only: "Balise numérique (QR seul)",
  residential: "Balise résidentielle (plaque standard)",
  residential_plus: "Balise résidentielle+ (plaque premium)",
  professional: "Balise professionnelle (commerce, PME)",
  institutional: "Balise institutionnelle (administration, ONG)",
  custom: "Balise sur mesure",
};

const CATEGORY_PRICES: Record<string, number> = {
  digital_only: 0,
  residential: 25000,
  residential_plus: 45000,
  professional: 60000,
  institutional: 80000,
  custom: 0,
};

export async function genererBonCommande(input: { lotId: string; actorId: string }) {
  const { data: lot, error: errLot } = await supabaseAdmin.from("lots").select("*").eq("id", input.lotId).maybeSingle();
  if (errLot) throw new Error(errLot.message);
  if (!lot) throw new Error("Commande introuvable.");
  const { data: existing } = await supabaseAdmin
    .from("purchase_orders" as any)
    .select("id, po_number")
    .eq("lot_id", input.lotId)
    .maybeSingle();
  if (existing) {
    return { success: true, id: (existing as any).id, po_number: (existing as any).po_number, existed: true };
  }
  let supplierId: string | null = null;
  let supplierSnapshot: any = { name: lot.supplier ?? "Fournisseur inconnu" };
  if (lot.supplier) {
    const { data: sup } = await supabaseAdmin
      .from("suppliers" as any)
      .select("*")
      .eq("name", lot.supplier)
      .maybeSingle();
    if (sup) {
      supplierId = (sup as any).id;
      supplierSnapshot = sup;
    }
  }
  const { data: numData, error: errNum } = await supabaseAdmin.rpc("next_po_number" as any);
  if (errNum) throw new Error(errNum.message);
  const poNumber = numData as unknown as string;
  const cat = lot.category ?? "residential";
  const unitPrice = CATEGORY_PRICES[cat] ?? 0;
  const quantity = Number(lot.quantity ?? 0);
  const amountHt = unitPrice * quantity;
  const tvaRate = 18;
  const tvaAmount = Math.round(amountHt * tvaRate / 100);
  const amountTtc = amountHt + tvaAmount;
  const { data: po, error } = await supabaseAdmin.from("purchase_orders" as any).insert({
    po_number: poNumber,
    lot_id: input.lotId,
    supplier_id: supplierId,
    supplier_snapshot: supplierSnapshot,
    status: "draft",
    issued_at: new Date().toISOString(),
    payment_terms: "Paiement à 30 jours date de facture",
    amount_ht: amountHt,
    tva_rate: tvaRate,
    tva_amount: tvaAmount,
    amount_ttc: amountTtc,
    currency: "GNF",
    created_by: input.actorId,
  }).select("id, po_number").single();
  if (error) throw new Error(error.message);
  await supabaseAdmin.from("purchase_order_lines" as any).insert({
    po_id: (po as any).id,
    designation: `${CATEGORY_LABELS[cat] ?? "Balise"} — Lot ${lot.code}`,
    category: cat,
    quantity,
    unit_price_ht: unitPrice,
    line_total_ht: amountHt,
  });
  return { success: true, id: (po as any).id, po_number: (po as any).po_number };
}

export async function chargerBonCommande(lotId: string) {
  const { data: po, error } = await supabaseAdmin
    .from("purchase_orders" as any)
    .select("*")
    .eq("lot_id", lotId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!po) return null;
  const { data: lines } = await supabaseAdmin
    .from("purchase_order_lines" as any)
    .select("*")
    .eq("po_id", (po as any).id)
    .order("created_at", { ascending: true });
  return { po, lines: lines ?? [] };
}

export async function majBonCommande(poId: string, patch: any) {
  const update: any = { updated_at: new Date().toISOString() };
  if (patch.status) update.status = patch.status;
  if (patch.payment_terms !== undefined) update.payment_terms = patch.payment_terms;
  if (patch.notes !== undefined) update.notes = patch.notes;
  if (patch.status === "sent") update.sent_at = new Date().toISOString();
  const { error } = await supabaseAdmin.from("purchase_orders" as any).update(update).eq("id", poId);
  if (error) throw new Error(error.message);
  return { success: true };
}

/** BC → délégué à l'Edge Function Supabase (pdf-lib inutilisable sur Cloudflare Workers). */
export async function genererPdfBc(poId: string): Promise<{ base64: string; po_number: string }> {
  const { data: po, error } = await supabaseAdmin
    .from("purchase_orders" as any)
    .select("*, lots(code)")
    .eq("id", poId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!po) throw new Error("BC introuvable.");
  const { data: lines } = await supabaseAdmin
    .from("purchase_order_lines" as any)
    .select("*")
    .eq("po_id", poId)
    .order("created_at", { ascending: true });

  const { data: pdfResp, error: fnErr } = await supabaseAdmin.functions.invoke("generate-pdf", {
    body: {
      type: "bc",
      data: {
        po_number: (po as any).po_number,
        lot_code: (po as any).lots?.code ?? null,
        issued_at: (po as any).issued_at,
        supplier: (po as any).supplier_snapshot ?? { name: "Fournisseur inconnu" },
        lines: lines ?? [],
        amount_ht: (po as any).amount_ht,
        tva_rate: (po as any).tva_rate,
        tva_amount: (po as any).tva_amount,
        amount_ttc: (po as any).amount_ttc,
        payment_terms: (po as any).payment_terms,
      },
    },
  });
  if (fnErr) throw new Error(fnErr.message);
  const base64 = (pdfResp as any)?.base64;
  if (!base64) throw new Error("PDF vide reçu de l'Edge Function.");

  const chemin = `${(po as any).po_number}.pdf`;
  const octets = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
  await supabaseAdmin.storage.from("purchase_orders").upload(chemin, octets, { contentType: "application/pdf", upsert: true });
  const { data: signed } = await supabaseAdmin.storage.from("purchase_orders").createSignedUrl(chemin, 60 * 60 * 24 * 365);
  if (signed?.signedUrl) {
    await supabaseAdmin.from("purchase_orders" as any).update({ pdf_url: signed.signedUrl }).eq("id", poId);
  }
  return { base64, po_number: (po as any).po_number };
}

/* --------------------------- BONS DE LIVRAISON --------------------------- */
export async function genererBonLivraison(input: {
  lotId: string;
  actorId: string;
  quantity_received: number;
  quantity_shipped?: number | null;
  qc_passed: boolean;
  defects?: string | null;
  notes?: string | null;
  carrier?: string | null;
  tracking_number?: string | null;
  shipped_at?: string | null;
  receiver_name?: string | null;
}) {
  const { data: lot, error: errLot } = await supabaseAdmin.from("lots").select("*").eq("id", input.lotId).maybeSingle();
  if (errLot) throw new Error(errLot.message);
  if (!lot) throw new Error("Commande introuvable.");
  const { data: po } = await supabaseAdmin.from("purchase_orders" as any).select("id, po_number, supplier_snapshot").eq("lot_id", input.lotId).maybeSingle();
  const supplierSnapshot = (po as any)?.supplier_snapshot ?? { name: lot.supplier ?? "Fournisseur inconnu" };
  const { data: numData, error: errNum } = await supabaseAdmin.rpc("next_dn_number" as any);
  if (errNum) throw new Error(errNum.message);
  const dnNumber = numData as unknown as string;
  const { data: dn, error: errDn } = await supabaseAdmin.from("delivery_notes" as any).insert({
    dn_number: dnNumber,
    lot_id: input.lotId,
    po_id: (po as any)?.id ?? null,
    supplier_snapshot: supplierSnapshot,
    shipped_at: input.shipped_at ?? null,
    received_at: new Date().toISOString(),
    carrier: input.carrier ?? null,
    tracking_number: input.tracking_number ?? null,
    quantity_ordered: lot.quantity,
    quantity_shipped: input.quantity_shipped ?? null,
    quantity_received: input.quantity_received,
    qc_passed: input.qc_passed,
    defects: input.defects ?? null,
    receiver_name: input.receiver_name ?? null,
    notes: input.notes ?? null,
    created_by: input.actorId,
  }).select("id, dn_number").single();
  if (errDn) throw new Error(errDn.message);
  return { success: true, id: (dn as any).id, dn_number: (dn as any).dn_number };
}

export async function chargerBonLivraison(lotId: string) {
  const { data: dn, error } = await supabaseAdmin.from("delivery_notes" as any).select("*").eq("lot_id", lotId).maybeSingle();
  if (error) throw new Error(error.message);
  return dn;
}

/** BL → délégué à l'Edge Function Supabase (pdf-lib inutilisable sur Cloudflare Workers). */
export async function genererPdfBl(dnId: string): Promise<{ base64: string; dn_number: string }> {
  const { data: dn, error } = await supabaseAdmin
    .from("delivery_notes" as any)
    .select("*, lots(code), purchase_orders(po_number)")
    .eq("id", dnId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!dn) throw new Error("BL introuvable.");

  const { data: pdfResp, error: fnErr } = await supabaseAdmin.functions.invoke("generate-pdf", {
    body: {
      type: "bl",
      data: {
        dn_number: (dn as any).dn_number,
        po_number: (dn as any).purchase_orders?.po_number ?? null,
        lot_code: (dn as any).lots?.code ?? null,
        received_at: (dn as any).received_at,
        shipped_at: (dn as any).shipped_at,
        supplier: (dn as any).supplier_snapshot ?? { name: "Fournisseur inconnu" },
        carrier: (dn as any).carrier,
        tracking_number: (dn as any).tracking_number,
        quantity_ordered: (dn as any).quantity_ordered,
        quantity_shipped: (dn as any).quantity_shipped,
        quantity_received: (dn as any).quantity_received,
        qc_passed: (dn as any).qc_passed,
        defects: (dn as any).defects,
        receiver_name: (dn as any).receiver_name,
        notes: (dn as any).notes,
      },
    },
  });
  if (fnErr) throw new Error(fnErr.message);
  const base64 = (pdfResp as any)?.base64;
  if (!base64) throw new Error("PDF vide reçu de l'Edge Function.");

  const chemin = `${(dn as any).dn_number}.pdf`;
  const octets = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
  await supabaseAdmin.storage.from("delivery_notes").upload(chemin, octets, { contentType: "application/pdf", upsert: true });
  const { data: signed } = await supabaseAdmin.storage.from("delivery_notes").createSignedUrl(chemin, 60 * 60 * 24 * 365);
  if (signed?.signedUrl) {
    await supabaseAdmin.from("delivery_notes" as any).update({ pdf_url: signed.signedUrl }).eq("id", dnId);
  }
  return { base64, dn_number: (dn as any).dn_number };
}

/* --------------------------- FACTURES D'ACHAT --------------------------- */
export async function creerFacture(input: {
  lotId: string;
  invoice_number: string;
  issued_at: string;
  due_date?: string | null;
  amount_ht: number;
  tva_rate?: number;
  pdf_base64?: string | null;
  pdf_filename?: string | null;
  notes?: string | null;
  actorId: string;
}) {
  const { data: lot } = await supabaseAdmin.from("lots").select("*").eq("id", input.lotId).maybeSingle();
  if (!lot) throw new Error("Commande introuvable.");
  const { data: po } = await supabaseAdmin.from("purchase_orders" as any).select("id, supplier_id, supplier_snapshot").eq("lot_id", input.lotId).maybeSingle();
  const { data: dn } = await supabaseAdmin.from("delivery_notes" as any).select("id").eq("lot_id", input.lotId).maybeSingle();
  const supplierSnapshot = (po as any)?.supplier_snapshot ?? { name: lot.supplier ?? "Fournisseur inconnu" };
  const supplierId = (po as any)?.supplier_id ?? null;
  if (supplierId) {
    const { data: existant } = await supabaseAdmin
      .from("purchase_invoices" as any)
      .select("internal_ref")
      .eq("supplier_id", supplierId)
      .eq("invoice_number", input.invoice_number)
      .maybeSingle();
    if (existant) throw new Error(`Facture ${input.invoice_number} déjà enregistrée pour ce fournisseur (${(existant as any).internal_ref}).`);
  }
  const { data: numData, error: errNum } = await supabaseAdmin.rpc("next_pi_number" as any);
  if (errNum) throw new Error(errNum.message);
  const internalRef = numData as unknown as string;
  const tvaRate = input.tva_rate ?? 18;
  const tvaAmount = Math.round(input.amount_ht * tvaRate / 100);
  const amountTtc = input.amount_ht + tvaAmount;
  let pdfUrl: string | null = null;
  if (input.pdf_base64) {
    const octets = Uint8Array.from(atob(input.pdf_base64), (c) => c.charCodeAt(0));
    const chemin = `${internalRef}_${input.pdf_filename ?? "facture.pdf"}`;
    await supabaseAdmin.storage.from("purchase_invoices").upload(chemin, octets, {
      contentType: "application/pdf", upsert: true,
    });
    const { data: signed } = await supabaseAdmin.storage.from("purchase_invoices").createSignedUrl(chemin, 60 * 60 * 24 * 365);
    pdfUrl = signed?.signedUrl ?? null;
  }
  const { data: inv, error } = await supabaseAdmin.from("purchase_invoices" as any).insert({
    internal_ref: internalRef,
    invoice_number: input.invoice_number,
    lot_id: input.lotId,
    po_id: (po as any)?.id ?? null,
    dn_id: (dn as any)?.id ?? null,
    supplier_id: supplierId,
    supplier_snapshot: supplierSnapshot,
    issued_at: input.issued_at,
    due_date: input.due_date ?? null,
    amount_ht: input.amount_ht,
    tva_rate: tvaRate,
    tva_amount: tvaAmount,
    amount_ttc: amountTtc,
    pdf_url: pdfUrl,
    notes: input.notes ?? null,
    created_by: input.actorId,
  }).select("id, internal_ref").single();
  if (error) throw new Error(error.message);
  return { success: true, id: (inv as any).id, internal_ref: (inv as any).internal_ref };
}

export async function chargerFacture(lotId: string) {
  const { data: inv, error } = await supabaseAdmin.from("purchase_invoices" as any).select("*").eq("lot_id", lotId).maybeSingle();
  if (error) throw new Error(error.message);
  if (!inv) return null;
  const { data: payments } = await supabaseAdmin
    .from("purchase_invoice_payments" as any)
    .select("*")
    .eq("invoice_id", (inv as any).id)
    .order("paid_at", { ascending: false });
  return { invoice: inv, payments: payments ?? [] };
}

export async function enregistrerPaiement(input: {
  invoiceId: string; amount: number; method: string;
  paid_at?: string | null; reference?: string | null; notes?: string | null; actorId: string;
}) {
  if (input.amount <= 0) throw new Error("Montant invalide.");
  const { error } = await supabaseAdmin.from("purchase_invoice_payments" as any).insert({
    invoice_id: input.invoiceId,
    amount: input.amount,
    method: input.method,
    paid_at: input.paid_at ?? new Date().toISOString(),
    reference: input.reference ?? null,
    notes: input.notes ?? null,
    created_by: input.actorId,
  });
  if (error) throw new Error(error.message);
  return { success: true };
}

export async function supprimerPaiement(paymentId: string) {
  const { error } = await supabaseAdmin.from("purchase_invoice_payments" as any).delete().eq("id", paymentId);
  if (error) throw new Error(error.message);
  return { success: true };
}

export async function marquerLitige(invoiceId: string, disputeNotes: string) {
  const { error } = await supabaseAdmin.from("purchase_invoices" as any).update({
    payment_status: "disputed", dispute_notes: disputeNotes, updated_at: new Date().toISOString(),
  }).eq("id", invoiceId);
  if (error) throw new Error(error.message);
  return { success: true };
}

export async function leverLitige(invoiceId: string) {
  const { data: inv } = await supabaseAdmin.from("purchase_invoices" as any).select("amount_paid, amount_ttc").eq("id", invoiceId).maybeSingle();
  if (!inv) throw new Error("Facture introuvable.");
  const status = (inv as any).amount_paid <= 0 ? "unpaid"
    : (inv as any).amount_paid < (inv as any).amount_ttc ? "partial" : "paid";
  const { error } = await supabaseAdmin.from("purchase_invoices" as any).update({
    payment_status: status, dispute_notes: null, updated_at: new Date().toISOString(),
  }).eq("id", invoiceId);
  if (error) throw new Error(error.message);
  return { success: true };
}

/** Rapprochement : compare montants BC vs Facture, qté BL vs Facture. */
export async function chargerRapprochement(lotId: string) {
  const { data: po } = await supabaseAdmin.from("purchase_orders" as any).select("amount_ttc, po_number").eq("lot_id", lotId).maybeSingle();
  const { data: dn } = await supabaseAdmin.from("delivery_notes" as any).select("dn_number, quantity_ordered, quantity_received, qc_passed").eq("lot_id", lotId).maybeSingle();
  const { data: inv } = await supabaseAdmin.from("purchase_invoices" as any).select("internal_ref, invoice_number, amount_ttc, amount_paid, payment_status, due_date").eq("lot_id", lotId).maybeSingle();
  return {
    po: po ?? null,
    dn: dn ?? null,
    invoice: inv ?? null,
    ecart_montant: (po as any) && (inv as any) ? Number((inv as any).amount_ttc) - Number((po as any).amount_ttc) : null,
    quantite_ok: (dn as any) ? (dn as any).quantity_received === (dn as any).quantity_ordered : null,
    montant_ok: (po as any) && (inv as any) ? Number((po as any).amount_ttc) === Number((inv as any).amount_ttc) : null,
    reste_a_payer: (inv as any) ? Number((inv as any).amount_ttc) - Number((inv as any).amount_paid) : null,
  };
}
