/**
 * Socle serveur du back-office : garde de rôle, utilitaires géo, tableaux de bord.
 * Fichier bloqué des bundles navigateur (*.server.ts).
 */
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export interface AdminIdentity {
  userId: string;
  role: string;
  fullName: string | null;
}

/**
 * Vérifie que l'utilisateur authentifié possède un rôle d'administration.
 * Lève une erreur sinon — toutes les mutations du back-office passent par ici.
 */
export async function requireAdmin(userId: string): Promise<AdminIdentity> {
  const { data, error } = await supabaseAdmin
    .from("profiles")
    .select("id, role, full_name")
    .eq("id", userId)
    .maybeSingle();

  if (error) throw new Error("Impossible de vérifier le rôle administrateur.");
  if (!data || (data.role !== "admin" && data.role !== "super_admin")) {
    throw new Error("Accès refusé : espace réservé à l'administration.");
  }
  return { userId, role: data.role, fullName: data.full_name ?? null };
}

export async function requireSuperAdmin(userId: string): Promise<AdminIdentity> {
  const identite = await requireAdmin(userId);
  if (identite.role !== "super_admin") {
    throw new Error("Action réservée aux super administrateurs.");
  }
  return identite;
}

/* ------------------------------------------------------------------ */
/* Géométries : décodage EWKB hexadécimal renvoyé par PostgREST        */
/* ------------------------------------------------------------------ */

export type LatLng = { lat: number; lng: number };

class Lecteur {
  private i = 0;
  private readonly vue: DataView;
  private petitBoutien = true;

  constructor(hex: string) {
    const octets = new Uint8Array(hex.length / 2);
    for (let k = 0; k < octets.length; k += 1) {
      octets[k] = parseInt(hex.slice(k * 2, k * 2 + 2), 16);
    }
    this.vue = new DataView(octets.buffer);
  }

  ordre() {
    this.petitBoutien = this.vue.getUint8(this.i) === 1;
    this.i += 1;
  }

  uint32() {
    const v = this.vue.getUint32(this.i, this.petitBoutien);
    this.i += 4;
    return v;
  }

  double() {
    const v = this.vue.getFloat64(this.i, this.petitBoutien);
    this.i += 8;
    return v;
  }
}

/** Décode un POINT geography (hex EWKB) en {lat,lng}. */
export function parsePointHex(hex: string | null | undefined): LatLng | null {
  if (!hex || typeof hex !== "string" || hex.length < 42) return null;
  try {
    const l = new Lecteur(hex);
    l.ordre();
    const type = l.uint32();
    if ((type & 0x20000000) !== 0) l.uint32(); // SRID
    if ((type & 0xff) !== 1) return null;
    const lng = l.double();
    const lat = l.double();
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    return { lat, lng };
  } catch {
    return null;
  }
}

/** Décode un POLYGON / MULTIPOLYGON en anneaux extérieurs. */
export function parsePolygonHex(hex: string | null | undefined): LatLng[][] {
  if (!hex || typeof hex !== "string") return [];
  try {
    const l = new Lecteur(hex);
    l.ordre();
    const type = l.uint32();
    if ((type & 0x20000000) !== 0) l.uint32();
    const base = type & 0xff;
    const anneaux: LatLng[][] = [];

    const lirePolygone = () => {
      const nbAnneaux = l.uint32();
      for (let a = 0; a < nbAnneaux; a += 1) {
        const nbPoints = l.uint32();
        const points: LatLng[] = [];
        for (let p = 0; p < nbPoints; p += 1) {
          const lng = l.double();
          const lat = l.double();
          points.push({ lat, lng });
        }
        if (a === 0) anneaux.push(points);
      }
    };

    if (base === 3) {
      lirePolygone();
    } else if (base === 6) {
      const nb = l.uint32();
      for (let i = 0; i < nb; i += 1) {
        l.ordre();
        const t = l.uint32();
        if ((t & 0x20000000) !== 0) l.uint32();
        lirePolygone();
      }
    }
    return anneaux;
  } catch {
    return [];
  }
}

/** Point dans polygone (ray casting) sur les anneaux extérieurs. */
export function pointDansAnneaux(point: LatLng, anneaux: LatLng[][]): boolean {
  return anneaux.some((anneau) => {
    let dedans = false;
    for (let i = 0, j = anneau.length - 1; i < anneau.length; j = i, i += 1) {
      const a = anneau[i]!;
      const b = anneau[j]!;
      const croise =
        a.lat > point.lat !== b.lat > point.lat &&
        point.lng < ((b.lng - a.lng) * (point.lat - a.lat)) / (b.lat - a.lat) + a.lng;
      if (croise) dedans = !dedans;
    }
    return dedans;
  });
}

/* ------------------------------------------------------------------ */
/* Tableau de bord                                                     */
/* ------------------------------------------------------------------ */

function jourIso(d: Date) {
  return d.toISOString().slice(0, 10);
}

export interface DashboardData {
  balisesActives: number;
  balisesGenerees: number;
  installations7j: number;
  adressesPubliques: number;
  adressesPrivees: number;
  signalementsOuverts: number;
  agentsActifs: number;
  installationsParJour: { jour: string; total: number }[];
  parCategorie: { categorie: string; total: number }[];
  points: { lat: number; lng: number; visibility: string; number: string | null }[];
  /* Enrichissements Phase 1 */
  tendances: Record<"installations" | "adresses" | "commandes", { actuel: number; precedent: number }>;
  statutsBalises: { statut: string; total: number }[];
  topZones: { nom: string; total: number }[];
  activite: {
    installations: { id: string; numero: string | null; date: string | null }[];
    commandes: { id: string; ref: string; montant: number; statut: string; date: string | null }[];
    signalements: { id: string; raison: string; statut: string; date: string | null }[];
  };
  objectifs: { cle: string; valeur: number; cible: number }[];
}


export async function chargerDashboard(): Promise<DashboardData> {
  const maintenant = new Date();
  const il7j = new Date(maintenant.getTime() - 7 * 864e5).toISOString();
  const il30j = new Date(maintenant.getTime() - 30 * 864e5);

  const compte = async (
    table: "beacons" | "addresses" | "reports" | "agents" | "installations",
    filtres: (q: any) => any,
  ) => {
    const { count } = await filtres(
      supabaseAdmin.from(table).select("id", { count: "exact", head: true }),
    );
    return count ?? 0;
  };

  const [
    balisesActives,
    balisesGenerees,
    installations7j,
    adressesPubliques,
    adressesPrivees,
    signalementsOuverts,
    agentsActifs,
  ] = await Promise.all([
    compte("beacons", (q) => q.eq("status", "active")),
    compte("beacons", (q) => q.eq("status", "generated")),
    compte("installations", (q) => q.gte("installed_at", il7j)),
    compte("addresses", (q) => q.eq("visibility", "public").eq("status", "active")),
    compte("addresses", (q) => q.eq("visibility", "private").eq("status", "active")),
    compte("reports", (q) => q.in("status", ["new", "in_review"])),
    compte("agents", (q) => q.eq("active", true)),
  ]);

  const { data: installs } = await supabaseAdmin
    .from("installations")
    .select("installed_at")
    .gte("installed_at", il30j.toISOString())
    .limit(5000);

  const parJour = new Map<string, number>();
  for (let i = 29; i >= 0; i -= 1) {
    parJour.set(jourIso(new Date(maintenant.getTime() - i * 864e5)), 0);
  }
  for (const ligne of installs ?? []) {
    const jour = (ligne.installed_at ?? "").slice(0, 10);
    if (parJour.has(jour)) parJour.set(jour, (parJour.get(jour) ?? 0) + 1);
  }

  const { data: adresses } = await supabaseAdmin
    .from("addresses")
    .select("category, visibility, location, beacons(public_number)")
    .eq("status", "active")
    .limit(2000);

  const cats = new Map<string, number>();
  const points: DashboardData["points"] = [];
  for (const a of (adresses ?? []) as any[]) {
    cats.set(a.category ?? "autre", (cats.get(a.category ?? "autre") ?? 0) + 1);
    const p = parsePointHex(a.location);
    if (p) {
      points.push({
        ...p,
        visibility: a.visibility ?? "public",
        number: a.beacons?.public_number ?? null,
      });
    }
  }

  return {
    balisesActives,
    balisesGenerees,
    installations7j,
    adressesPubliques,
    adressesPrivees,
    signalementsOuverts,
    agentsActifs,
    installationsParJour: [...parJour.entries()].map(([jour, total]) => ({ jour, total })),
    parCategorie: [...cats.entries()]
      .map(([categorie, total]) => ({ categorie, total }))
      .sort((a, b) => b.total - a.total),
    points,
  };
}

/* ------------------------------------------------------------------ */
/* Journal d'audit                                                     */
/* ------------------------------------------------------------------ */

export async function listerAudit(f: {
  page: number;
  pageSize: number;
  actorId?: string | null;
  action?: string | null;
  entity?: string | null;
  from?: string | null;
  to?: string | null;
}) {
  const debut = (f.page - 1) * f.pageSize;
  let q = supabaseAdmin
    .from("audit_logs")
    .select("id, actor_id, action, entity, entity_id, before, after, created_at", {
      count: "exact",
    })
    .order("created_at", { ascending: false })
    .range(debut, debut + f.pageSize - 1);

  if (f.actorId) q = q.eq("actor_id", f.actorId);
  if (f.action) q = q.eq("action", f.action);
  if (f.entity) q = q.eq("entity", f.entity);
  if (f.from) q = q.gte("created_at", f.from);
  if (f.to) q = q.lte("created_at", f.to);

  const { data, count, error } = await q;
  if (error) throw new Error(error.message);

  const acteurs = [...new Set((data ?? []).map((l) => l.actor_id).filter(Boolean))] as string[];
  const noms = new Map<string, string>();
  if (acteurs.length > 0) {
    const { data: profils } = await supabaseAdmin
      .from("profiles")
      .select("id, full_name")
      .in("id", acteurs);
    for (const p of profils ?? []) noms.set(p.id, p.full_name ?? "");
  }

  return {
    rows: (data ?? []).map((l) => ({ ...l, actor_name: noms.get(l.actor_id ?? "") ?? null })),
    total: count ?? 0,
    page: f.page,
    pageSize: f.pageSize,
  };
}

/* ------------------------------------------------------------------ */
/* Statistiques                                                        */
/* ------------------------------------------------------------------ */

export interface AnalyticsData {
  recherchesParJour: { jour: string; total: number }[];
  itinerairesTotal: number;
  recherchesTotal: number;
  conversion: number;
  parProvider: { provider: string; total: number }[];
  topAdresses: { numero: string; total: number }[];
  chaleur: { lat: number; lng: number; poids: number }[];
}

export async function chargerAnalytics(jours: number): Promise<AnalyticsData> {
  const depuis = new Date(Date.now() - jours * 864e5);
  const depuisIso = depuis.toISOString();

  const [{ data: recherches }, { data: itineraires }] = await Promise.all([
    supabaseAdmin
      .from("search_logs")
      .select("created_at, beacon_id_found, query")
      .gte("created_at", depuisIso)
      .limit(20000),
    supabaseAdmin
      .from("route_logs")
      .select("launched_at, provider, beacon_id")
      .gte("launched_at", depuisIso)
      .limit(20000),
  ]);

  const parJour = new Map<string, number>();
  for (let i = jours - 1; i >= 0; i -= 1) {
    parJour.set(jourIso(new Date(Date.now() - i * 864e5)), 0);
  }
  const parRequete = new Map<string, number>();
  for (const r of recherches ?? []) {
    const jour = (r.created_at ?? "").slice(0, 10);
    if (parJour.has(jour)) parJour.set(jour, (parJour.get(jour) ?? 0) + 1);
    if (r.beacon_id_found) {
      parRequete.set(r.query, (parRequete.get(r.query) ?? 0) + 1);
    }
  }

  const providers = new Map<string, number>();
  for (const it of itineraires ?? []) {
    providers.set(it.provider ?? "inconnu", (providers.get(it.provider ?? "inconnu") ?? 0) + 1);
  }

  const top = [...parRequete.entries()]
    .map(([numero, total]) => ({ numero, total }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 20);

  const { data: adresses } = await supabaseAdmin
    .from("addresses")
    .select("location")
    .eq("status", "active")
    .limit(2000);

  const chaleur: AnalyticsData["chaleur"] = [];
  for (const a of (adresses ?? []) as any[]) {
    const p = parsePointHex(a.location);
    if (p) chaleur.push({ ...p, poids: 1 });
  }

  const recherchesTotal = recherches?.length ?? 0;
  const itinerairesTotal = itineraires?.length ?? 0;

  return {
    recherchesParJour: [...parJour.entries()].map(([jour, total]) => ({ jour, total })),
    recherchesTotal,
    itinerairesTotal,
    conversion: recherchesTotal === 0 ? 0 : Math.round((itinerairesTotal / recherchesTotal) * 100),
    parProvider: [...providers.entries()].map(([provider, total]) => ({ provider, total })),
    topAdresses: top,
    chaleur,
  };
}
