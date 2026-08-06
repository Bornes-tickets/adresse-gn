/**
 * Logique serveur de l'installation d'une balise par un agent.
 * Ce fichier est bloqué des bundles navigateur (*.server.ts).
 */
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { BEACON_REGEX } from "@/lib/geo";

export interface InstallMeasure {
  lat: number;
  lng: number;
  accuracy_m: number;
  taken_at: string;
}

export interface InstallPayload {
  beacon_number: string;
  measures: InstallMeasure[];
  photo_base64: string;
  category: string;
  name: string | null;
  visibility: "private" | "public";
  access_point_note: string | null;
  owner_name: string | null;
  owner_phone: string | null;
  consent: boolean;
}

export interface InstallResult {
  success: boolean;
  code?: string;
  message?: string;
  address_id?: string;
  public_url?: string;
}

function erreur(code: string, message: string): InstallResult {
  return { success: false, code, message };
}

function base64ToBytes(base64: string): Uint8Array {
  const propre = base64.includes(",") ? base64.slice(base64.indexOf(",") + 1) : base64;
  const binaire = atob(propre);
  const octets = new Uint8Array(binaire.length);
  for (let i = 0; i < binaire.length; i += 1) octets[i] = binaire.charCodeAt(i);
  return octets;
}

const moyenne = (valeurs: number[]) =>
  valeurs.reduce((total, valeur) => total + valeur, 0) / valeurs.length;

/** Effectue l'enregistrement complet d'une installation. */
export async function performInstall(
  userId: string,
  payload: InstallPayload,
): Promise<InstallResult> {
  if (!BEACON_REGEX.test(payload.beacon_number)) {
    return erreur("numero_invalide", "Numéro de balise invalide.");
  }
  if (payload.consent !== true) {
    return erreur(
      "consentement_manquant",
      "Le consentement du propriétaire est obligatoire.",
    );
  }
  if (payload.measures.length !== 3) {
    return erreur("mesures_invalides", "Trois mesures GPS sont requises.");
  }
  if (!payload.photo_base64) {
    return erreur("photo_manquante", "La photo de l'entrée est obligatoire.");
  }

  // 1) L'utilisateur est-il un agent actif ?
  const [{ data: profile }, { data: agent }] = await Promise.all([
    supabaseAdmin.from("profiles").select("role").eq("id", userId).maybeSingle(),
    supabaseAdmin.from("agents").select("id, active").eq("id", userId).maybeSingle(),
  ]);

  if (profile?.role !== "agent" || !agent || agent.active === false) {
    return erreur("agent_invalide", "Compte agent introuvable ou inactif.");
  }

  // 2) La balise existe-t-elle, est-elle installable et assignée à cet agent ?
  const { data: beacon } = await supabaseAdmin
    .from("beacons")
    .select("id, status, lot_id")
    .eq("public_number", payload.beacon_number)
    .maybeSingle();

  if (!beacon) return erreur("balise_introuvable", "Cette balise n'existe pas.");
  if (!["generated", "assigned"].includes(beacon.status)) {
    return erreur(
      "statut_invalide",
      "Cette balise n'est plus installable (statut : " + beacon.status + ").",
    );
  }
  if (!beacon.lot_id) {
    return erreur("lot_manquant", "Cette balise n'appartient à aucun lot.");
  }

  const { data: assignation } = await supabaseAdmin
    .from("lot_assignments")
    .select("id")
    .eq("lot_id", beacon.lot_id)
    .eq("agent_id", userId)
    .maybeSingle();

  if (!assignation) {
    return erreur("non_assignee", "Cette balise ne vous est pas assignée.");
  }

  // 3) Position moyenne
  const lat = moyenne(payload.measures.map((m) => m.lat));
  const lng = moyenne(payload.measures.map((m) => m.lng));
  const accuracy = moyenne(payload.measures.map((m) => m.accuracy_m));

  // 4) Photo (bucket privé + URL signée)
  const chemin = `${userId}/${payload.beacon_number}.jpg`;
  const { error: erreurUpload } = await supabaseAdmin.storage
    .from("installation-photos")
    .upload(chemin, base64ToBytes(payload.photo_base64), {
      contentType: "image/jpeg",
      upsert: true,
    });

  if (erreurUpload) {
    return erreur("photo_upload", "Échec de l'envoi de la photo : " + erreurUpload.message);
  }

  const { data: signee } = await supabaseAdmin.storage
    .from("installation-photos")
    .createSignedUrl(chemin, 60 * 60 * 24 * 365);
  const photoUrl = signee?.signedUrl ?? chemin;

  // 5) Installation + mesures
  const { data: installation, error: erreurInstall } = await supabaseAdmin
    .from("installations")
    .insert({
      beacon_id: beacon.id,
      agent_id: userId,
      gps_lat: lat,
      gps_lng: lng,
      accuracy_m: accuracy,
      photo_url: photoUrl,
      installed_at: new Date().toISOString(),
    })
    .select("id")
    .single();

  if (erreurInstall || !installation) {
    return erreur(
      "installation_echec",
      "Enregistrement de l'installation impossible : " + (erreurInstall?.message ?? ""),
    );
  }

  await supabaseAdmin.from("installation_measures").insert(
    payload.measures.map((m) => ({
      installation_id: installation.id,
      lat: m.lat,
      lng: m.lng,
      accuracy_m: m.accuracy_m,
      taken_at: m.taken_at,
    })),
  );

  // 6) Adresse
  const { data: adresse, error: erreurAdresse } = await supabaseAdmin
    .from("addresses")
    .insert({
      beacon_id: beacon.id,
      owner_id: null,
      category: payload.category,
      name: payload.name,
      location: `SRID=4326;POINT(${lng} ${lat})`,
      accuracy_m: accuracy,
      visibility: payload.visibility,
      verification_level: "unverified",
      access_point_note: payload.access_point_note,
      status: "active",
    })
    .select("id")
    .single();

  if (erreurAdresse || !adresse) {
    return erreur(
      "adresse_echec",
      "Création de l'adresse impossible : " + (erreurAdresse?.message ?? ""),
    );
  }

  // 7) Propriétaire déclaré (non encore inscrit)
  if (payload.owner_name || payload.owner_phone) {
    await supabaseAdmin.from("unclaimed_owners").insert({
      beacon_id: beacon.id,
      name: payload.owner_name,
      phone: payload.owner_phone,
      consent_at: new Date().toISOString(),
    });
  }

  // 8) Activation de la balise
  await supabaseAdmin
    .from("beacons")
    .update({ status: "active", activated_at: new Date().toISOString() })
    .eq("id", beacon.id);

  // 9) Journal d'audit
  await supabaseAdmin.from("audit_logs").insert({
    actor_id: userId,
    action: "install",
    entity: "beacon",
    entity_id: beacon.id,
    after: {
      beacon_number: payload.beacon_number,
      address_id: adresse.id,
      installation_id: installation.id,
      gps_lat: lat,
      gps_lng: lng,
      accuracy_m: accuracy,
      category: payload.category,
      visibility: payload.visibility,
      consent: true,
      owner_name: payload.owner_name,
      owner_phone: payload.owner_phone,
    },
  });

  return {
    success: true,
    address_id: adresse.id,
    public_url: `/a/${payload.beacon_number}`,
  };
}
