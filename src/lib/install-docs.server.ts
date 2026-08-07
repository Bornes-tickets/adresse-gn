/**
 * Pièces justificatives (photos, documents) rattachées aux installations en attente.
 * Bucket privé `installation-docs` — accès uniquement via URL signée temporaire.
 * Fichier bloqué des bundles navigateur (*.server.ts).
 */
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const BUCKET = "installation-docs";
const TAILLE_MAX = 8 * 1024 * 1024;
const MIMES = ["image/jpeg", "image/png", "image/webp", "application/pdf"];

export const KINDS = ["photo", "recu", "attestation", "autre"] as const;
export type DocKind = (typeof KINDS)[number];
export type DocStatut = "pending" | "approved" | "rejected";

function base64EnOctets(base64: string): Uint8Array {
  const propre = base64.includes(",") ? base64.slice(base64.indexOf(",") + 1) : base64;
  const binaire = atob(propre);
  const octets = new Uint8Array(binaire.length);
  for (let i = 0; i < binaire.length; i += 1) octets[i] = binaire.charCodeAt(i);
  return octets;
}

function extension(mime: string): string {
  if (mime === "application/pdf") return "pdf";
  if (mime === "image/png") return "png";
  if (mime === "image/webp") return "webp";
  return "jpg";
}

/** Installations en attente avec le décompte de pièces par statut. */
export async function listerInstallationsAvecDocs(filtre?: { statut?: string | null }) {
  let requete = supabaseAdmin
    .from("pending_installations")
    .select(
      "id, status, note, phone, created_at, customer_id, assigned_agent_id, beacons(public_number), orders(order_ref)",
    )
    .order("created_at", { ascending: false })
    .limit(200);
  if (filtre?.statut) requete = requete.eq("status", filtre.statut);

  const { data, error } = await requete;
  if (error) throw new Error(error.message);

  const ids = (data ?? []).map((l: any) => l.id);
  const compte = new Map<string, { total: number; pending: number; approved: number; rejected: number }>();
  if (ids.length > 0) {
    const { data: docs } = await supabaseAdmin
      .from("pending_installation_docs")
      .select("pending_installation_id, status")
      .in("pending_installation_id", ids);
    for (const d of docs ?? []) {
      const cur =
        compte.get(d.pending_installation_id) ?? { total: 0, pending: 0, approved: 0, rejected: 0 };
      cur.total += 1;
      if (d.status === "approved") cur.approved += 1;
      else if (d.status === "rejected") cur.rejected += 1;
      else cur.pending += 1;
      compte.set(d.pending_installation_id, cur);
    }
  }

  const clients = [...new Set((data ?? []).map((l: any) => l.customer_id).filter(Boolean))];
  const noms = new Map<string, string>();
  if (clients.length > 0) {
    const { data: profils } = await supabaseAdmin
      .from("profiles")
      .select("id, full_name")
      .in("id", clients as string[]);
    for (const p of profils ?? []) noms.set(p.id, p.full_name ?? "");
  }

  return (data ?? []).map((l: any) => ({
    id: l.id,
    status: l.status,
    note: l.note,
    phone: l.phone,
    created_at: l.created_at,
    beacon_number: l.beacons?.public_number ?? null,
    order_ref: l.orders?.order_ref ?? null,
    client: noms.get(l.customer_id ?? "") || "Client",
    docs: compte.get(l.id) ?? { total: 0, pending: 0, approved: 0, rejected: 0 },
  }));
}

/** Pièces d'une installation en attente, avec URL signée valable 1 heure. */
export async function listerDocs(pendingId: string) {
  const { data, error } = await supabaseAdmin
    .from("pending_installation_docs")
    .select(
      "id, kind, label, storage_path, mime_type, size_bytes, status, review_note, uploaded_by, reviewed_by, reviewed_at, created_at",
    )
    .eq("pending_installation_id", pendingId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);

  const lignes = await Promise.all(
    (data ?? []).map(async (d) => {
      const { data: signee } = await supabaseAdmin.storage
        .from(BUCKET)
        .createSignedUrl(d.storage_path, 3600);
      return { ...d, url: signee?.signedUrl ?? null };
    }),
  );
  return lignes;
}

/** Dépose une pièce dans le bucket privé et crée sa ligne (statut « en attente »). */
export async function ajouterDoc(input: {
  actorId: string;
  pendingId: string;
  kind: DocKind;
  label?: string | null;
  mimeType: string;
  base64: string;
}) {
  if (!MIMES.includes(input.mimeType)) {
    throw new Error("Format non accepté (JPEG, PNG, WEBP ou PDF).");
  }
  const { data: pending } = await supabaseAdmin
    .from("pending_installations")
    .select("id, status")
    .eq("id", input.pendingId)
    .maybeSingle();
  if (!pending) throw new Error("Installation en attente introuvable.");

  const octets = base64EnOctets(input.base64);
  if (octets.byteLength === 0) throw new Error("Fichier vide.");
  if (octets.byteLength > TAILLE_MAX) throw new Error("Fichier trop volumineux (max 8 Mo).");

  const chemin = `${input.pendingId}/${Date.now()}-${crypto.randomUUID()}.${extension(input.mimeType)}`;
  const { error: erreurUpload } = await supabaseAdmin.storage
    .from(BUCKET)
    .upload(chemin, octets, { contentType: input.mimeType, upsert: false });
  if (erreurUpload) throw new Error("Échec du dépôt : " + erreurUpload.message);

  const { data: ligne, error } = await supabaseAdmin
    .from("pending_installation_docs")
    .insert({
      pending_installation_id: input.pendingId,
      kind: input.kind,
      label: input.label?.trim() || null,
      storage_path: chemin,
      mime_type: input.mimeType,
      size_bytes: octets.byteLength,
      uploaded_by: input.actorId,
    })
    .select("id")
    .single();
  if (error) {
    await supabaseAdmin.storage.from(BUCKET).remove([chemin]);
    throw new Error(error.message);
  }

  await supabaseAdmin.from("audit_logs").insert({
    actor_id: input.actorId,
    action: "pending_installation_doc.upload",
    entity: "pending_installation_docs",
    entity_id: ligne.id,
    after: { pending_installation_id: input.pendingId, kind: input.kind, path: chemin } as never,
  });

  return { success: true, id: ligne.id };
}

/** Valide ou rejette une pièce (motif obligatoire au rejet). */
export async function statuerDoc(input: {
  actorId: string;
  docId: string;
  statut: DocStatut;
  note?: string | null;
}) {
  if (input.statut === "rejected" && !input.note?.trim()) {
    throw new Error("Un motif est obligatoire pour rejeter une pièce.");
  }
  const { data: avant } = await supabaseAdmin
    .from("pending_installation_docs")
    .select("id, status, pending_installation_id")
    .eq("id", input.docId)
    .maybeSingle();
  if (!avant) throw new Error("Pièce introuvable.");

  const { error } = await supabaseAdmin
    .from("pending_installation_docs")
    .update({
      status: input.statut,
      review_note: input.note?.trim() || null,
      reviewed_by: input.actorId,
      reviewed_at: input.statut === "pending" ? null : new Date().toISOString(),
    })
    .eq("id", input.docId);
  if (error) throw new Error(error.message);

  await supabaseAdmin.from("audit_logs").insert({
    actor_id: input.actorId,
    action: "pending_installation_doc.review",
    entity: "pending_installation_docs",
    entity_id: input.docId,
    before: { status: avant.status } as never,
    after: { status: input.statut, note: input.note?.trim() || null } as never,
  });

  return { success: true };
}

/** Supprime une pièce et son fichier. */
export async function supprimerDoc(input: { actorId: string; docId: string }) {
  const { data: doc } = await supabaseAdmin
    .from("pending_installation_docs")
    .select("id, storage_path, pending_installation_id")
    .eq("id", input.docId)
    .maybeSingle();
  if (!doc) throw new Error("Pièce introuvable.");

  await supabaseAdmin.storage.from(BUCKET).remove([doc.storage_path]);
  const { error } = await supabaseAdmin
    .from("pending_installation_docs")
    .delete()
    .eq("id", input.docId);
  if (error) throw new Error(error.message);

  await supabaseAdmin.from("audit_logs").insert({
    actor_id: input.actorId,
    action: "pending_installation_doc.delete",
    entity: "pending_installation_docs",
    entity_id: input.docId,
    before: { path: doc.storage_path, pending_installation_id: doc.pending_installation_id } as never,
  });

  return { success: true };
}
