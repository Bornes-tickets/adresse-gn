/** Opérations serveur de l'espace Support. Bloqué des bundles navigateur. */
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export interface SupportDashboardData {
  signalementsOuverts: number;
  signalementsNouveaux: number;
  signalementsEnCours: number;
  signalementsResolus7j: number;
  reclamationsEnAttente: number;
  reclamationsApprouvees7j: number;
  reclamationsRejetees7j: number;
  ageSignalementMoyen: number | null;
  signalementsRecents: { id: string; reason: string; status: string; created_at: string; beacon_number: string | null }[];
  parRaison: { raison: string; total: number }[];
}

export async function chargerDashboardSupport(): Promise<SupportDashboardData> {
  const now = Date.now();
  const il7j = new Date(now - 7 * 864e5).toISOString();

  const [signOuverts, signNouv, signEnCours, signResolus, recAttente, recApprouvees, recRejetees] = await Promise.all([
    supabaseAdmin.from("reports").select("id", { count: "exact", head: true }).in("status", ["new", "in_review"]),
    supabaseAdmin.from("reports").select("id", { count: "exact", head: true }).eq("status", "new"),
    supabaseAdmin.from("reports").select("id", { count: "exact", head: true }).eq("status", "in_review"),
    supabaseAdmin.from("reports").select("id", { count: "exact", head: true }).eq("status", "resolved").gte("created_at", il7j),
    supabaseAdmin.from("address_claims" as any).select("id", { count: "exact", head: true }).eq("status", "pending"),
    supabaseAdmin.from("address_claims" as any).select("id", { count: "exact", head: true }).eq("status", "approved").gte("decided_at", il7j),
    supabaseAdmin.from("address_claims" as any).select("id", { count: "exact", head: true }).eq("status", "rejected").gte("decided_at", il7j),
  ]);

  const { data: recents } = await supabaseAdmin
    .from("reports")
    .select("id, reason, status, created_at, beacons(public_number)")
    .in("status", ["new", "in_review"])
    .order("created_at", { ascending: false })
    .limit(10);

  const { data: pourAge } = await supabaseAdmin
    .from("reports")
    .select("created_at")
    .in("status", ["new", "in_review"])
    .limit(500);
  const ages = (pourAge ?? []).map((r) => (Date.now() - new Date(r.created_at).getTime()) / 864e5);
  const ageMoyen = ages.length > 0 ? Math.round(ages.reduce((s, a) => s + a, 0) / ages.length) : null;

  const { data: raisons } = await supabaseAdmin
    .from("reports")
    .select("reason")
    .in("status", ["new", "in_review"])
    .limit(1000);
  const parRaison = new Map<string, number>();
  for (const r of raisons ?? []) parRaison.set(r.reason, (parRaison.get(r.reason) ?? 0) + 1);

  return {
    signalementsOuverts: signOuverts.count ?? 0,
    signalementsNouveaux: signNouv.count ?? 0,
    signalementsEnCours: signEnCours.count ?? 0,
    signalementsResolus7j: signResolus.count ?? 0,
    reclamationsEnAttente: recAttente.count ?? 0,
    reclamationsApprouvees7j: recApprouvees.count ?? 0,
    reclamationsRejetees7j: recRejetees.count ?? 0,
    ageSignalementMoyen: ageMoyen,
    signalementsRecents: (recents ?? []).map((r: any) => ({
      id: r.id, reason: r.reason, status: r.status, created_at: r.created_at,
      beacon_number: r.beacons?.public_number ?? null,
    })),
    parRaison: [...parRaison.entries()].map(([raison, total]) => ({ raison, total })).sort((a, b) => b.total - a.total).slice(0, 6),
  };
}
