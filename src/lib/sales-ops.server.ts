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
/* --------------------------- COMMANDES (liste globale) --------------------------- */

export interface SalesOrderRow {
  id: string;
  order_ref: string;
  offer_code: string;
  amount_gnf: number;
  status: string;
  created_at: string;
  customer_id: string;
  client_name: string;
  client_email: string | null;
  client_phone: string | null;
  invoice_number: string | null;
}

export async function listerCommandes(filtre: {
  statut?: string;
  q?: string;
  page?: number;
  pageSize?: number;
}): Promise<{ total: number; page: number; pageSize: number; lignes: SalesOrderRow[] }> {
  const page = Math.max(1, filtre.page ?? 1);
  const pageSize = Math.min(100, filtre.pageSize ?? 25);

  let req = supabaseAdmin
    .from("orders")
    .select(
      "id, order_ref, offer_code, amount_gnf, status, created_at, customer_id, invoices(number)",
      { count: "exact" },
    )
    .order("created_at", { ascending: false })
    .range((page - 1) * pageSize, page * pageSize - 1);

  if (filtre.statut && filtre.statut !== "all") req = req.eq("status", filtre.statut);
  if (filtre.q) req = req.ilike("order_ref", `%${filtre.q}%`);

  const { data, error, count } = await req;
  if (error) throw new Error(error.message);

  const clientIds = [...new Set((data ?? []).map((c: any) => c.customer_id).filter(Boolean))];
  const profils = new Map<string, { name: string | null; phone: string | null }>();
  if (clientIds.length) {
    const { data: p } = await supabaseAdmin
      .from("profiles")
      .select("id, full_name, phone")
      .in("id", clientIds);
    for (const row of p ?? []) profils.set(row.id, { name: row.full_name, phone: row.phone });
  }

  // Emails via auth admin
  const emails = new Map<string, string>();
  for (const cid of clientIds) {
    try {
      const { data: u } = await supabaseAdmin.auth.admin.getUserById(cid as string);
      if (u?.user?.email) emails.set(cid as string, u.user.email);
    } catch { /* silencieux */ }
  }

  return {
    total: count ?? 0,
    page,
    pageSize,
    lignes: (data ?? []).map((c: any) => ({
      id: c.id,
      order_ref: c.order_ref,
      offer_code: c.offer_code,
      amount_gnf: c.amount_gnf,
      status: c.status,
      created_at: c.created_at,
      customer_id: c.customer_id,
      client_name: profils.get(c.customer_id)?.name ?? "Client",
      client_email: emails.get(c.customer_id) ?? null,
      client_phone: profils.get(c.customer_id)?.phone ?? null,
      invoice_number: c.invoices?.[0]?.number ?? null,
    })),
  };
}
/* --------------------------- OFFRES (lecture catalogue) --------------------------- */

export async function listerOffres(): Promise<any[]> {
  try {
    const pricing = await import("@/lib/pricing");
    const source =
      (pricing as any).OFFERS ??
      (pricing as any).offers ??
      (typeof (pricing as any).getAllOffers === "function" ? (pricing as any).getAllOffers() : null);
    if (Array.isArray(source)) return source;
    if (source && typeof source === "object") return Object.values(source);
  } catch {
    // ignore
  }
  // Fallback : essaie de lire une table offers si elle existe
  const { data } = await supabaseAdmin.from("offers" as any).select("*").limit(200);
  return data ?? [];
}

/* --------------------------- CLIENTS --------------------------- */

export interface SalesClientRow {
  id: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  role: string;
  created_at: string | null;
  nb_commandes: number;
  total_depense: number;
  derniere_commande: string | null;
  abonnements_actifs: number;
}

export async function listerClients(f: {
  q?: string;
  page?: number;
  pageSize?: number;
}): Promise<{ total: number; page: number; pageSize: number; lignes: SalesClientRow[] }> {
  const page = Math.max(1, f.page ?? 1);
  const pageSize = Math.min(100, f.pageSize ?? 25);

  // Récupère tous les profils user (paginés)
  let req = supabaseAdmin
    .from("profiles")
    .select("id, full_name, phone, role, created_at", { count: "exact" })
    .in("role", ["user", "sales", "supervisor", "admin", "super_admin"])
    .order("created_at", { ascending: false })
    .range((page - 1) * pageSize, page * pageSize - 1);

  if (f.q) {
    req = req.or(`full_name.ilike.%${f.q}%,phone.ilike.%${f.q}%`);
  }

  const { data: profils, count, error } = await req;
  if (error) throw new Error(error.message);

  const ids = (profils ?? []).map((p) => p.id);
  if (ids.length === 0) return { total: 0, page, pageSize, lignes: [] };

  // Emails via auth
  const emails = new Map<string, string>();
  for (const id of ids) {
    try {
      const { data: u } = await supabaseAdmin.auth.admin.getUserById(id);
      if (u?.user?.email) emails.set(id, u.user.email);
    } catch { /* silencieux */ }
  }

  // Commandes agrégées
  const { data: commandes } = await supabaseAdmin
    .from("orders")
    .select("customer_id, amount_gnf, created_at, status")
    .in("customer_id", ids);

  const statsCommandes = new Map<string, { nb: number; total: number; derniere: string | null }>();
  for (const c of commandes ?? []) {
    const cur = statsCommandes.get(c.customer_id) ?? { nb: 0, total: 0, derniere: null };
    cur.nb += 1;
    if (c.status === "paid") cur.total += Number(c.amount_gnf ?? 0);
    if (!cur.derniere || (c.created_at ?? "") > cur.derniere) cur.derniere = c.created_at ?? null;
    statsCommandes.set(c.customer_id, cur);
  }

  // Abonnements actifs
  const { data: abos } = await supabaseAdmin
    .from("subscriptions")
    .select("customer_id, status")
    .in("customer_id", ids)
    .eq("status", "active");

  const abosParClient = new Map<string, number>();
  for (const a of abos ?? []) {
    abosParClient.set(a.customer_id, (abosParClient.get(a.customer_id) ?? 0) + 1);
  }

  const lignes: SalesClientRow[] = (profils ?? []).map((p) => {
    const s = statsCommandes.get(p.id) ?? { nb: 0, total: 0, derniere: null };
    return {
      id: p.id,
      full_name: p.full_name ?? null,
      email: emails.get(p.id) ?? null,
      phone: p.phone ?? null,
      role: p.role,
      created_at: p.created_at,
      nb_commandes: s.nb,
      total_depense: s.total,
      derniere_commande: s.derniere,
      abonnements_actifs: abosParClient.get(p.id) ?? 0,
    };
  });

  return { total: count ?? 0, page, pageSize, lignes };
}
