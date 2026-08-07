/**
 * Édition manuelle d'une installation terrain avant sa clôture (validation QC).
 * Chaque modification est tracée dans audit_logs (valeurs avant / après).
 * Fichier bloqué des bundles navigateur (*.server.ts).
 */
import { supabaseAdmin } from "@/integrations/supabase/client.server";

/** Champs modifiables manuellement par l'administration. */
export interface PatchInstallation {
  agent_id?: string | null;
  gps_lat?: number | null;
  gps_lng?: number | null;
  accuracy_m?: number | null;
  photo_url?: string | null;
  installed_at?: string | null;
}

const CHAMPS: (keyof PatchInstallation)[] = [
  "agent_id",
  "gps_lat",
  "gps_lng",
  "accuracy_m",
  "photo_url",
  "installed_at",
];

/** Détail d'une installation + son journal d'audit. */
export async function detailInstallation(id: string) {
  const { data: installation, error } = await supabaseAdmin
    .from("installations")
    .select(
      "id, beacon_id, agent_id, gps_lat, gps_lng, accuracy_m, photo_url, installed_at, validated_at, validator_id, client_uuid, beacons(public_number, status)",
    )
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!installation) throw new Error("Installation introuvable.");

  const [{ data: agent }, { data: mesures }, { data: journal }] = await Promise.all([
    installation.agent_id
      ? supabaseAdmin
          .from("agents")
          .select("id, badge_number")
          .eq("id", installation.agent_id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    supabaseAdmin
      .from("installation_measures")
      .select("id, lat, lng, accuracy_m, taken_at")
      .eq("installation_id", id)
      .order("taken_at", { ascending: true }),
    supabaseAdmin
      .from("audit_logs")
      .select("id, action, actor_id, created_at, before, after")
      .eq("entity", "installations")
      .eq("entity_id", id)
      .order("created_at", { ascending: false })
      .limit(50),
  ]);

  const acteurs = [...new Set((journal ?? []).map((l) => l.actor_id).filter(Boolean))] as string[];
  const noms = new Map<string, string>();
  if (acteurs.length > 0) {
    const { data: profils } = await supabaseAdmin
      .from("profiles")
      .select("id, full_name")
      .in("id", acteurs);
    for (const p of profils ?? []) noms.set(p.id, p.full_name ?? "");
  }

  const { beacons, ...reste } = installation as any;
  return {
    installation: {
      ...reste,
      beacon_number: beacons?.public_number ?? null,
      beacon_status: beacons?.status ?? null,
      agent_badge: agent?.badge_number ?? null,
      cloturee: reste.validated_at != null,
    },
    mesures: mesures ?? [],
    journal: (journal ?? []).map((l) => ({
      ...l,
      actor_name: noms.get(l.actor_id ?? "") ?? null,
    })),
  };
}

/**
 * Applique un patch sur une installation non clôturée et journalise le diff.
 * Refuse toute modification si l'installation est déjà validée.
 */
export async function modifierInstallation(input: {
  id: string;
  actorId: string;
  patch: PatchInstallation;
  motif?: string | null;
}) {
  const { data: avant, error: erreurLecture } = await supabaseAdmin
    .from("installations")
    .select(
      "id, beacon_id, agent_id, gps_lat, gps_lng, accuracy_m, photo_url, installed_at, validated_at",
    )
    .eq("id", input.id)
    .maybeSingle();
  if (erreurLecture) throw new Error(erreurLecture.message);
  if (!avant) throw new Error("Installation introuvable.");
  if (avant.validated_at) {
    throw new Error("Installation déjà clôturée : modification manuelle impossible.");
  }

  if (input.patch.agent_id) {
    const { data: agent } = await supabaseAdmin
      .from("agents")
      .select("id")
      .eq("id", input.patch.agent_id)
      .maybeSingle();
    if (!agent) throw new Error("Agent inconnu.");
  }

  const lat = input.patch.gps_lat;
  const lng = input.patch.gps_lng;
  if (lat != null && (!Number.isFinite(lat) || lat < -90 || lat > 90)) {
    throw new Error("Latitude invalide (attendu entre -90 et 90).");
  }
  if (lng != null && (!Number.isFinite(lng) || lng < -180 || lng > 180)) {
    throw new Error("Longitude invalide (attendu entre -180 et 180).");
  }
  if (input.patch.accuracy_m != null && Number(input.patch.accuracy_m) < 0) {
    throw new Error("La précision doit être positive.");
  }

  const patch: Record<string, unknown> = {};
  const diffAvant: Record<string, unknown> = {};
  const diffApres: Record<string, unknown> = {};

  for (const champ of CHAMPS) {
    if (!(champ in input.patch)) continue;
    const valeur = input.patch[champ] ?? null;
    const actuelle = (avant as any)[champ] ?? null;
    if (String(actuelle ?? "") === String(valeur ?? "")) continue;
    patch[champ] = valeur;
    diffAvant[champ] = actuelle;
    diffApres[champ] = valeur;
  }

  if (Object.keys(patch).length === 0) {
    return { success: true, modifies: 0 as number };
  }

  const { error } = await supabaseAdmin.from("installations").update(patch).eq("id", input.id);
  if (error) throw new Error(error.message);

  await supabaseAdmin.from("audit_logs").insert({
    actor_id: input.actorId,
    action: "admin_edit_installation",
    entity: "installations",
    entity_id: input.id,
    before: diffAvant,
    after: { ...diffApres, motif: input.motif?.trim() || null },
  });

  return { success: true, modifies: Object.keys(patch).length };
}
