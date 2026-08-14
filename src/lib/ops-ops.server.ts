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
