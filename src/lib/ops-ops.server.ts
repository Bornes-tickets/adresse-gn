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
