/** Opérations serveur de l'espace commercial. Bloqué des bundles navigateur. */
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export interface SalesDashboardData {
  ventesJour: number;
  ventesMois: number;
  ventesMoisPrec: number;
  commandesEnCours: number;
  paiementsEnAttente: number;
  abonnementsActifs: number;
  nouveauxClients7j: number;
  panierMoyen: number;
  revenusParJour: { jour: string; total: number }[];
  topOffres: { code: string; total: number; revenus: number }[];
  activite: {
    commandes: { id: string; ref: string; client: string | null; montant: number; statut: string; date: string | null }[];
    paiements: { id: string; provider: string; montant: number; statut: string; date: string | null }[];
  };
}

function jourIso(d: Date) {
  return d.toISOString().slice(0, 10);
}

export async function chargerDashboardSales(): Promise<SalesDashboardData> {
  const maintenant = new Date();
  const debutJour = new Date(maintenant.getFullYear(), maintenant.getMonth(), maintenant.getDate()).toISOString();
  const debutMois = new Date(maintenant.getFullYear(), maintenant.getMonth(), 1).toISOString();
  const debutMoisPrec = new Date(maintenant.getFullYear(), maintenant.getMonth() - 1, 1).toISOString();
  const finMoisPrec = new Date(maintenant.getFullYear(), maintenant.getMonth(), 1).toISOString();
  const il7j = new Date(maintenant.getTime() - 7 * 864e5).toISOString();
  const il30j = new Date(maintenant.getTime() - 30 * 864e5);

  // Paiements du jour et du mois (payés uniquement)
  const [paiementsJour, paiementsMois, paiementsMoisPrec, paiementsAttente] = await Promise.all([
    supabaseAdmin.from("payments").select("amount_gnf").eq("status", "paid").gte("paid_at", debutJour),
    supabaseAdmin.from("payments").select("amount_gnf").eq("status", "paid").gte("paid_at", debutMois),
    supabaseAdmin.from("payments").select("amount_gnf").eq("status", "paid").gte("paid_at", debutMoisPrec).lt("paid_at", finMoisPrec),
    supabaseAdmin.from("payments").select("id", { count: "exact", head: true }).eq("status", "pending"),
  ]);

  const totalMontant = (arr: any[] | null) => (arr ?? []).reduce((s, p) => s + Number(p.amount_gnf ?? 0), 0);
  const ventesJour = totalMontant(paiementsJour.data);
  const ventesMois = totalMontant(paiementsMois.data);
  const ventesMoisPrec = totalMontant(paiementsMoisPrec.data);

  // Commandes
  const [commandesEnCours, nouveauxClients] = await Promise.all([
    supabaseAdmin.from("orders").select("id", { count: "exact", head: true }).in("status", ["pending", "confirmed", "processing"]),
    supabaseAdmin.from("orders").select("customer_email").gte("created_at", il7j).limit(1000),
  ]);
  const emailsUniques = new Set((nouveauxClients.data ?? []).map((o: any) => o.customer_email).filter(Boolean));

  // Abonnements actifs
  const { count: abonnementsActifs } = await supabaseAdmin
    .from("subscriptions")
    .select("id", { count: "exact", head: true })
    .eq("status", "active");

  // Revenus par jour (30 derniers jours)
  const { data: paiementsPeriode } = await supabaseAdmin
    .from("payments")
    .select("amount_gnf, paid_at")
    .eq("status", "paid")
    .gte("paid_at", il30j.toISOString())
    .limit(20000);
  const parJour = new Map<string, number>();
  for (let i = 29; i >= 0; i -= 1) {
    parJour.set(jourIso(new Date(maintenant.getTime() - i * 864e5)), 0);
  }
  for (const p of paiementsPeriode ?? []) {
    const j = (p.paid_at ?? "").slice(0, 10);
    if (parJour.has(j)) parJour.set(j, (parJour.get(j) ?? 0) + Number(p.amount_gnf ?? 0));
  }

  // Top offres du mois
  const { data: ordersMois } = await supabaseAdmin
    .from("orders")
    .select("offer_code, amount_gnf")
    .gte("created_at", debutMois)
    .limit(5000);
  const parOffre = new Map<string, { total: number; revenus: number }>();
  for (const o of ordersMois ?? []) {
    if (!o.offer_code) continue;
    const cur = parOffre.get(o.offer_code) ?? { total: 0, revenus: 0 };
    cur.total += 1;
    cur.revenus += Number(o.amount_gnf ?? 0);
    parOffre.set(o.offer_code, cur);
  }
  const topOffres = [...parOffre.entries()]
    .map(([code, v]) => ({ code, ...v }))
    .sort((a, b) => b.revenus - a.revenus)
    .slice(0, 5);

  // Activité récente
  const [recentOrders, recentPayments] = await Promise.all([
    supabaseAdmin
      .from("orders")
      .select("id, order_ref, customer_name, customer_email, amount_gnf, status, created_at")
      .order("created_at", { ascending: false })
      .limit(8),
    supabaseAdmin
      .from("payments")
      .select("id, provider, amount_gnf, status, paid_at, created_at")
      .order("created_at", { ascending: false })
      .limit(8),
  ]);

  const commandes = (recentOrders.data ?? []).map((o: any) => ({
    id: o.id,
    ref: o.order_ref,
    client: o.customer_name ?? o.customer_email ?? null,
    montant: Number(o.amount_gnf ?? 0),
    statut: o.status,
    date: o.created_at ?? null,
  }));
  const totalCommandes = commandes.reduce((s, c) => s + c.montant, 0);
  const panierMoyen = commandes.length > 0 ? Math.round(totalCommandes / commandes.length) : 0;

  return {
    ventesJour,
    ventesMois,
    ventesMoisPrec,
    commandesEnCours: commandesEnCours.count ?? 0,
    paiementsEnAttente: paiementsAttente.count ?? 0,
    abonnementsActifs: abonnementsActifs ?? 0,
    nouveauxClients7j: emailsUniques.size,
    panierMoyen,
    revenusParJour: [...parJour.entries()].map(([jour, total]) => ({ jour, total })),
    topOffres,
    activite: {
      commandes,
      paiements: (recentPayments.data ?? []).map((p: any) => ({
        id: p.id,
        provider: p.provider ?? "—",
        montant: Number(p.amount_gnf ?? 0),
        statut: p.status,
        date: p.paid_at ?? p.created_at ?? null,
      })),
    },
  };
}
