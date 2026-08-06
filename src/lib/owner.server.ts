/**
 * Portail propriétaire : données et mutations serveur.
 * Toutes les fonctions reçoivent l'identifiant de l'utilisateur authentifié
 * et filtrent strictement sur ses propres ressources.
 */
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type {
  BeaconContext,
  OwnerBeacon,
  OwnerDashboard,
  OwnerFavorite,
  OwnerReport,
} from "@/lib/portal";

const JOUR_MS = 86_400_000;

function ilYaJours(jours: number): string {
  return new Date(Date.now() - jours * JOUR_MS).toISOString();
}

function serieParJour(dates: string[], jours: number) {
  const buckets = new Map<string, number>();
  for (let i = jours - 1; i >= 0; i -= 1) {
    const jour = new Date(Date.now() - i * JOUR_MS).toISOString().slice(0, 10);
    buckets.set(jour, 0);
  }
  for (const d of dates) {
    const jour = d.slice(0, 10);
    if (buckets.has(jour)) buckets.set(jour, (buckets.get(jour) ?? 0) + 1);
  }
  return [...buckets.entries()].map(([day, count]) => ({ day, count }));
}

/** Balises (adresses) dont l'utilisateur est propriétaire. */
async function mesAdresses(userId: string) {
  const { data, error } = await supabaseAdmin
    .from("addresses")
    .select(
      "id, beacon_id, name, category, visibility, verification_level, status, access_point_note, beacons(public_number), establishments(id)",
    )
    .eq("owner_id", userId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function chargerMesBalises(userId: string): Promise<OwnerBeacon[]> {
  const adresses = await mesAdresses(userId);
  const beaconIds = adresses.map((a: any) => a.beacon_id).filter(Boolean) as string[];

  const parBalise = new Map<string, string[]>();
  if (beaconIds.length) {
    const { data: logs } = await supabaseAdmin
      .from("search_logs")
      .select("beacon_id_found, created_at")
      .in("beacon_id_found", beaconIds)
      .gte("created_at", ilYaJours(30));
    for (const l of logs ?? []) {
      const cle = l.beacon_id_found as string;
      if (!parBalise.has(cle)) parBalise.set(cle, []);
      parBalise.get(cle)!.push(l.created_at as string);
    }
  }

  return adresses.map((a: any) => ({
    address_id: a.id,
    beacon_id: a.beacon_id ?? null,
    public_number: a.beacons?.public_number ?? "—",
    name: a.name ?? null,
    category: a.category,
    visibility: a.visibility,
    verification_level: a.verification_level,
    status: a.status,
    access_point_note: a.access_point_note ?? null,
    establishment_id: a.establishments?.[0]?.id ?? a.establishments?.id ?? null,
    searches_30d: serieParJour(parBalise.get(a.beacon_id ?? "") ?? [], 30),
  }));
}

export async function chargerDashboardProprietaire(userId: string): Promise<OwnerDashboard> {
  const adresses = await mesAdresses(userId);
  const beaconIds = adresses.map((a: any) => a.beacon_id).filter(Boolean) as string[];
  const numeros = new Map<string, string>();
  for (const a of adresses as any[]) {
    if (a.beacon_id) numeros.set(a.beacon_id, a.beacons?.public_number ?? "—");
  }

  let searches30d = 0;
  let routes30d = 0;
  const activites: OwnerDashboard["activities"] = [];

  if (beaconIds.length) {
    const [{ data: recherches }, { data: itineraires }] = await Promise.all([
      supabaseAdmin
        .from("search_logs")
        .select("beacon_id_found, created_at")
        .in("beacon_id_found", beaconIds)
        .gte("created_at", ilYaJours(30))
        .order("created_at", { ascending: false }),
      supabaseAdmin
        .from("route_logs")
        .select("beacon_id, provider, launched_at")
        .in("beacon_id", beaconIds)
        .gte("launched_at", ilYaJours(30))
        .order("launched_at", { ascending: false }),
    ]);

    searches30d = recherches?.length ?? 0;
    routes30d = itineraires?.length ?? 0;

    for (const r of (recherches ?? []).slice(0, 3)) {
      activites.push({
        label: "Recherche",
        detail: numeros.get(r.beacon_id_found as string) ?? "—",
        at: r.created_at as string,
      });
    }
    for (const i of (itineraires ?? []).slice(0, 3)) {
      activites.push({
        label: `Itinéraire (${i.provider ?? "—"})`,
        detail: numeros.get(i.beacon_id as string) ?? "—",
        at: i.launched_at as string,
      });
    }
  }

  activites.sort((a, b) => (a.at < b.at ? 1 : -1));

  return {
    beaconCount: adresses.length,
    searches30d,
    routes30d,
    activities: activites.slice(0, 3),
  };
}

export async function majMaBalise(
  userId: string,
  input: {
    addressId: string;
    name: string | null;
    category: string;
    visibility: string;
    accessPointNote: string | null;
  },
) {
  const { data: adresse } = await supabaseAdmin
    .from("addresses")
    .select("id, owner_id")
    .eq("id", input.addressId)
    .maybeSingle();
  if (!adresse || adresse.owner_id !== userId) {
    throw new Error("Cette adresse ne vous appartient pas.");
  }

  const { error } = await supabaseAdmin
    .from("addresses")
    .update({
      name: input.name?.trim() || null,
      category: input.category,
      visibility: input.visibility,
      access_point_note: input.accessPointNote?.trim() || null,
    })
    .eq("id", input.addressId);
  if (error) throw new Error(error.message);
  return { success: true };
}

export async function suspendreMaBalise(userId: string, addressId: string) {
  const { data: adresse } = await supabaseAdmin
    .from("addresses")
    .select("id, owner_id")
    .eq("id", addressId)
    .maybeSingle();
  if (!adresse || adresse.owner_id !== userId) {
    throw new Error("Cette adresse ne vous appartient pas.");
  }
  const { error } = await supabaseAdmin
    .from("addresses")
    .update({ status: "suspended" })
    .eq("id", addressId);
  if (error) throw new Error(error.message);
  return { success: true };
}

/* ------------------------------ FAVORIS ------------------------------ */

export async function chargerFavoris(userId: string): Promise<OwnerFavorite[]> {
  const { data, error } = await supabaseAdmin
    .from("favorites")
    .select("id, alias, created_at, beacon_id, beacons(public_number)")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);

  const beaconIds = (data ?? []).map((f: any) => f.beacon_id).filter(Boolean);
  const infos = new Map<string, { name: string | null; category: string | null }>();
  if (beaconIds.length) {
    const { data: adresses } = await supabaseAdmin
      .from("addresses")
      .select("beacon_id, name, category, visibility")
      .in("beacon_id", beaconIds);
    for (const a of adresses ?? []) {
      infos.set(a.beacon_id as string, {
        name: a.visibility === "public" ? (a.name ?? null) : null,
        category: a.category ?? null,
      });
    }
  }

  return (data ?? []).map((f: any) => ({
    id: f.id,
    alias: f.alias ?? null,
    created_at: f.created_at,
    public_number: f.beacons?.public_number ?? "—",
    name: infos.get(f.beacon_id ?? "")?.name ?? null,
    category: infos.get(f.beacon_id ?? "")?.category ?? null,
  }));
}

export async function basculerFavori(userId: string, number: string, alias: string | null) {
  const { data: beacon } = await supabaseAdmin
    .from("beacons")
    .select("id")
    .eq("public_number", number)
    .maybeSingle();
  if (!beacon) throw new Error("Balise introuvable.");

  const { data: existant } = await supabaseAdmin
    .from("favorites")
    .select("id")
    .eq("user_id", userId)
    .eq("beacon_id", beacon.id)
    .maybeSingle();

  if (existant) {
    await supabaseAdmin.from("favorites").delete().eq("id", existant.id);
    return { favorited: false, id: null as string | null };
  }

  const { data: cree, error } = await supabaseAdmin
    .from("favorites")
    .insert({ user_id: userId, beacon_id: beacon.id, alias: alias?.trim() || null })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  return { favorited: true, id: cree.id as string };
}

export async function majFavori(userId: string, id: string, alias: string | null) {
  const { error } = await supabaseAdmin
    .from("favorites")
    .update({ alias: alias?.trim() || null })
    .eq("id", id)
    .eq("user_id", userId);
  if (error) throw new Error(error.message);
  return { success: true };
}

export async function supprimerFavori(userId: string, id: string) {
  const { error } = await supabaseAdmin
    .from("favorites")
    .delete()
    .eq("id", id)
    .eq("user_id", userId);
  if (error) throw new Error(error.message);
  return { success: true };
}

/* --------------------------- SIGNALEMENTS --------------------------- */

export async function chargerMesSignalements(userId: string): Promise<OwnerReport[]> {
  const { data, error } = await supabaseAdmin
    .from("reports")
    .select("id, reason, description, status, created_at, beacons(public_number)")
    .eq("reporter_id", userId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);

  return (data ?? []).map((r: any) => {
    const texte: string = r.description ?? "";
    const index = texte.indexOf("[Admin]");
    return {
      id: r.id,
      reason: r.reason,
      description: index >= 0 ? texte.slice(0, index).trim() || null : (r.description ?? null),
      status: r.status,
      created_at: r.created_at,
      public_number: r.beacons?.public_number ?? null,
      admin_response: index >= 0 ? texte.slice(index + 7).trim() : null,
    };
  });
}

export async function creerSignalement(
  userId: string,
  input: { number: string; reason: string; description: string | null },
) {
  const { data: beacon } = await supabaseAdmin
    .from("beacons")
    .select("id")
    .eq("public_number", input.number)
    .maybeSingle();
  if (!beacon) throw new Error("Balise introuvable.");

  const { error } = await supabaseAdmin.from("reports").insert({
    beacon_id: beacon.id,
    reporter_id: userId,
    reason: input.reason,
    description: input.description?.trim() || null,
  });
  if (error) throw new Error(error.message);
  return { success: true };
}

/* --------------------------- PARAMÈTRES --------------------------- */

export async function chargerMonProfil(userId: string) {
  const { data, error } = await supabaseAdmin
    .from("profiles")
    .select("id, full_name, phone, role, created_at")
    .eq("id", userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

export async function majMonProfil(
  userId: string,
  input: { fullName: string | null; phone: string | null },
) {
  const { error } = await supabaseAdmin
    .from("profiles")
    .update({
      full_name: input.fullName?.trim() || null,
      phone: input.phone?.trim() || null,
    })
    .eq("id", userId);
  if (error) throw new Error(error.message);
  return { success: true };
}

/** Désactivation de compte : on bannit l'accès, on conserve les traces d'audit. */
export async function desactiverMonCompte(userId: string) {
  const { error } = await supabaseAdmin.auth.admin.updateUserById(userId, {
    ban_duration: "876000h",
  });
  if (error) throw new Error(error.message);

  await supabaseAdmin.from("audit_logs").insert({
    actor_id: userId,
    action: "account_deactivated",
    entity: "profiles",
    entity_id: userId,
    after: { deactivated_at: new Date().toISOString() },
  });
  return { success: true };
}

/* ------------------------ CONTEXTE FICHE PUBLIQUE ------------------------ */

export async function chargerContexteBalise(
  userId: string,
  number: string,
): Promise<BeaconContext> {
  const vide: BeaconContext = {
    address_id: null,
    owner_id: null,
    is_mine: false,
    establishment_id: null,
    favorite_id: null,
    claim_status: null,
  };

  const { data: beacon } = await supabaseAdmin
    .from("beacons")
    .select("id")
    .eq("public_number", number)
    .maybeSingle();
  if (!beacon) return vide;

  const [{ data: adresse }, { data: favori }, { data: claim }] = await Promise.all([
    supabaseAdmin
      .from("addresses")
      .select("id, owner_id, establishments(id)")
      .eq("beacon_id", beacon.id)
      .maybeSingle(),
    supabaseAdmin
      .from("favorites")
      .select("id")
      .eq("user_id", userId)
      .eq("beacon_id", beacon.id)
      .maybeSingle(),
    supabaseAdmin
      .from("claim_requests")
      .select("status")
      .eq("beacon_id", beacon.id)
      .eq("requester_id", userId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const etablissement = (adresse as any)?.establishments;
  const estMien = !!adresse?.owner_id && adresse.owner_id === userId;

  return {
    address_id: adresse?.id ?? null,
    owner_id: adresse?.owner_id ?? null,
    is_mine: estMien,
    establishment_id: estMien
      ? (Array.isArray(etablissement) ? etablissement[0]?.id : etablissement?.id) ?? null
      : null,
    favorite_id: favori?.id ?? null,
    claim_status: claim?.status ?? null,
  };
}

/* --------------------------- RÉCLAMATIONS --------------------------- */

function base64EnOctets(base64: string): Uint8Array {
  const nu = base64.includes(",") ? base64.split(",")[1]! : base64;
  const binaire = atob(nu);
  const octets = new Uint8Array(binaire.length);
  for (let i = 0; i < binaire.length; i += 1) octets[i] = binaire.charCodeAt(i);
  return octets;
}

export async function creerReclamation(
  userId: string,
  input: { number: string; explanation: string; photoBase64: string | null },
) {
  const { data: beacon } = await supabaseAdmin
    .from("beacons")
    .select("id")
    .eq("public_number", input.number)
    .maybeSingle();
  if (!beacon) throw new Error("Balise introuvable.");

  const { data: adresse } = await supabaseAdmin
    .from("addresses")
    .select("id, owner_id")
    .eq("beacon_id", beacon.id)
    .maybeSingle();
  if (adresse?.owner_id) {
    throw new Error("Cette adresse a déjà un propriétaire enregistré.");
  }

  const { data: enAttente } = await supabaseAdmin
    .from("claim_requests")
    .select("id")
    .eq("beacon_id", beacon.id)
    .eq("requester_id", userId)
    .eq("status", "pending")
    .maybeSingle();
  if (enAttente) throw new Error("Une demande est déjà en cours pour cette adresse.");

  let preuve = input.explanation.trim();
  if (input.photoBase64) {
    const chemin = `${userId}/${input.number}-${Date.now()}.jpg`;
    const { error: erreurUpload } = await supabaseAdmin.storage
      .from("claim-evidence")
      .upload(chemin, base64EnOctets(input.photoBase64), {
        contentType: "image/jpeg",
        upsert: true,
      });
    if (erreurUpload) throw new Error("Envoi de la preuve impossible : " + erreurUpload.message);
    const { data: signee } = await supabaseAdmin.storage
      .from("claim-evidence")
      .createSignedUrl(chemin, 60 * 60 * 24 * 365);
    if (signee?.signedUrl) preuve = `${preuve}\n\nPreuve : ${signee.signedUrl}`;
  }

  const { data: proprietaireNonReclame } = await supabaseAdmin
    .from("unclaimed_owners")
    .select("id")
    .eq("beacon_id", beacon.id)
    .maybeSingle();

  const { error } = await supabaseAdmin.from("claim_requests").insert({
    beacon_id: beacon.id,
    requester_id: userId,
    unclaimed_owner_id: proprietaireNonReclame?.id ?? null,
    evidence: preuve,
  });
  if (error) throw new Error(error.message);
  return { success: true };
}

export async function chargerMesReclamations(userId: string) {
  const { data, error } = await supabaseAdmin
    .from("claim_requests")
    .select("id, status, evidence, decision_note, created_at, decided_at, beacons(public_number)")
    .eq("requester_id", userId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []).map((c: any) => ({
    id: c.id,
    status: c.status,
    evidence: c.evidence,
    decision_note: c.decision_note ?? null,
    created_at: c.created_at,
    decided_at: c.decided_at ?? null,
    public_number: c.beacons?.public_number ?? "—",
  }));
}
