/** Back-office : file des réclamations de propriété. */
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export async function listerReclamations(statut: string | null) {
  let req = supabaseAdmin
    .from("claim_requests")
    .select(
      "id, status, evidence, decision_note, created_at, decided_at, requester_id, unclaimed_owner_id, beacon_id, beacons(public_number)",
    )
    .order("created_at", { ascending: false })
    .limit(200);
  if (statut) req = req.eq("status", statut);

  const { data, error } = await req;
  if (error) throw new Error(error.message);

  const demandeurs = [...new Set((data ?? []).map((c: any) => c.requester_id).filter(Boolean))];
  const profils = new Map<string, { nom: string | null; tel: string | null }>();
  if (demandeurs.length) {
    const { data: lignes } = await supabaseAdmin
      .from("profiles")
      .select("id, full_name, phone")
      .in("id", demandeurs as string[]);
    for (const p of lignes ?? []) {
      profils.set(p.id, { nom: p.full_name ?? null, tel: p.phone ?? null });
    }
  }

  const nonReclames = [
    ...new Set((data ?? []).map((c: any) => c.unclaimed_owner_id).filter(Boolean)),
  ];
  const declares = new Map<string, { name: string | null; phone: string | null }>();
  if (nonReclames.length) {
    const { data: lignes } = await supabaseAdmin
      .from("unclaimed_owners")
      .select("id, name, phone")
      .in("id", nonReclames as string[]);
    for (const u of lignes ?? []) {
      declares.set(u.id, { name: u.name ?? null, phone: u.phone ?? null });
    }
  }

  return (data ?? []).map((c: any) => ({
    id: c.id,
    status: c.status,
    evidence: c.evidence ?? null,
    decision_note: c.decision_note ?? null,
    created_at: c.created_at,
    decided_at: c.decided_at ?? null,
    beacon_id: c.beacon_id,
    beacon_number: c.beacons?.public_number ?? "—",
    requester_id: c.requester_id,
    requester_name: profils.get(c.requester_id ?? "")?.nom ?? null,
    requester_phone: profils.get(c.requester_id ?? "")?.tel ?? null,
    unclaimed_owner: c.unclaimed_owner_id ? (declares.get(c.unclaimed_owner_id) ?? null) : null,
  }));
}

export async function deciderReclamation(input: {
  id: string;
  decision: "approved" | "rejected";
  note: string | null;
  actorId: string;
}) {
  const { data: demande } = await supabaseAdmin
    .from("claim_requests")
    .select("id, beacon_id, requester_id, status")
    .eq("id", input.id)
    .maybeSingle();
  if (!demande) throw new Error("Demande introuvable.");
  if (demande.status !== "pending") throw new Error("Cette demande a déjà été traitée.");

  const maintenant = new Date().toISOString();

  if (input.decision === "approved") {
    const { data: adresse } = await supabaseAdmin
      .from("addresses")
      .select("id, owner_id")
      .eq("beacon_id", demande.beacon_id)
      .maybeSingle();
    if (!adresse) throw new Error("Aucune adresse rattachée à cette balise.");

    const { error: erreurAdresse } = await supabaseAdmin
      .from("addresses")
      .update({ owner_id: demande.requester_id, verification_level: "declared" })
      .eq("id", adresse.id);
    if (erreurAdresse) throw new Error(erreurAdresse.message);

    await supabaseAdmin.from("audit_logs").insert({
      actor_id: input.actorId,
      action: "claim_approved",
      entity: "addresses",
      entity_id: adresse.id,
      before: { owner_id: adresse.owner_id },
      after: { owner_id: demande.requester_id, claim_id: input.id },
    });
  } else {
    await supabaseAdmin.from("audit_logs").insert({
      actor_id: input.actorId,
      action: "claim_rejected",
      entity: "claim_requests",
      entity_id: input.id,
      after: { note: input.note ?? null },
    });
  }

  const { error } = await supabaseAdmin
    .from("claim_requests")
    .update({
      status: input.decision,
      decision_note: input.note?.trim() || null,
      decided_at: maintenant,
      decided_by: input.actorId,
    })
    .eq("id", input.id);
  if (error) throw new Error(error.message);

  await supabaseAdmin.from("notifications").insert({
    user_id: demande.requester_id,
    type: "claim_decision",
    payload: {
      claim_id: input.id,
      status: input.decision,
      note: input.note ?? null,
    },
  });

  return { success: true };
}
