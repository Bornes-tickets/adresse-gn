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
  quantity_stock: number;  // generated non encore assignées
  quantity_used: number;   // active
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
  // Récupère tous les lots avec leur quantité commandée
  const { data: lots, error: errLots } = await supabaseAdmin
    .from("lots")
    .select("id, code, category, supplier, status, received_at, quantity")
    .order("received_at", { ascending: false });
  if (errLots) throw new Error(errLots.message);

  // Agrège les balises par lot + statut
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
    const stock = c.generated ?? 0;
    const used = c.active ?? 0;
    return {
      lot_id: l.id,
      code: l.code,
      category: l.category,
      supplier: l.supplier,
      status: l.status,
      received_at: l.received_at,
      quantity_ordered: ordered,
      quantity_generated: stock,
      quantity_assigned: c.assigned ?? 0,
      quantity_active: used,
      quantity_suspended: c.suspended ?? 0,
      quantity_cancelled: c.cancelled ?? 0,
      quantity_stock: stock,
      quantity_used: used,
      taux_consommation: ordered > 0 ? Math.round(((used + (c.assigned ?? 0)) / ordered) * 100) : 0,
    };
  });

  // Global
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

  // Par catégorie
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

  // Récupère le BC associé s'il existe
  const { data: po } = await supabaseAdmin.from("purchase_orders" as any).select("id, po_number, supplier_snapshot").eq("lot_id", input.lotId).maybeSingle();

  // Snapshot fournisseur (depuis PO ou fallback sur lot)
  const supplierSnapshot = (po as any)?.supplier_snapshot ?? { name: lot.supplier ?? "Fournisseur inconnu" };

  // Numéro BL
  const { data: numData, error: errNum } = await supabaseAdmin.rpc("next_dn_number" as any);
  if (errNum) throw new Error(errNum.message);
  const dnNumber = numData as unknown as string;

  // Insert BL
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

export async function genererPdfBl(dnId: string): Promise<{ base64: string; dn_number: string }> {
  const { data: dn, error } = await supabaseAdmin.from("delivery_notes" as any).select("*, lots(code), purchase_orders(po_number)").eq("id", dnId).maybeSingle();
  if (error) throw new Error(error.message);
  if (!dn) throw new Error("BL introuvable.");

  const { genererPdfBonLivraison } = await import("@/lib/ops-dn-pdf.server");
  const supplier = (dn as any).supplier_snapshot ?? { name: "Fournisseur inconnu" };
  const pdf = await genererPdfBonLivraison({
    dn_number: (dn as any).dn_number,
    po_number: (dn as any).purchase_orders?.po_number ?? null,
    lot_code: (dn as any).lots?.code ?? null,
    received_at: (dn as any).received_at,
    shipped_at: (dn as any).shipped_at,
    supplier,
    carrier: (dn as any).carrier,
    tracking_number: (dn as any).tracking_number,
    quantity_ordered: (dn as any).quantity_ordered,
    quantity_shipped: (dn as any).quantity_shipped,
    quantity_received: (dn as any).quantity_received,
    qc_passed: (dn as any).qc_passed,
    defects: (dn as any).defects,
    receiver_name: (dn as any).receiver_name,
    notes: (dn as any).notes,
  });

  // Upload storage
  const chemin = `${(dn as any).dn_number}.pdf`;
  const octets = Uint8Array.from(atob(pdf.base64), (c) => c.charCodeAt(0));
  await supabaseAdmin.storage.from("delivery_notes").upload(chemin, octets, { contentType: "application/pdf", upsert: true });
  const { data: signed } = await supabaseAdmin.storage.from("delivery_notes").createSignedUrl(chemin, 60 * 60 * 24 * 365);
  if (signed?.signedUrl) {
    await supabaseAdmin.from("delivery_notes" as any).update({ pdf_url: signed.signedUrl }).eq("id", dnId);
  }
  return { base64: pdf.base64, dn_number: (dn as any).dn_number };
}
