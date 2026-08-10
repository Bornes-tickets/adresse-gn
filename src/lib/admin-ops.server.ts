/**
 * Opérations serveur du back-office : balises, adresses, QC, signalements,
 * utilisateurs, agents, lots, zones, planification. Bloqué des bundles navigateur.
 */
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type { Database, Json } from "@/integrations/supabase/types";
import { parsePointHex, parsePolygonHex, pointDansAnneaux } from "@/lib/admin.server";

const PAGE_MAX = 100;
function plage(page: number, pageSize: number): [number, number] {
  const taille = Math.min(Math.max(pageSize, 1), PAGE_MAX);
  const debut = (Math.max(page, 1) - 1) * taille;
  return [debut, debut + taille - 1];
}

/* ------------------------------ BALISES ------------------------------ */

export async function listerBalises(f: {
  page: number;
  pageSize: number;
  statuses?: string[];
  lotId?: string | null;
  from?: string | null;
  to?: string | null;
  q?: string | null;
}) {
  const [debut, fin] = plage(f.page, f.pageSize);
  let req = supabaseAdmin
    .from("beacons")
    .select("id, public_number, status, created_at, activated_at, lot_id, category, lots(code)", {
      count: "exact",
    })
    .order("created_at", { ascending: false })
    .range(debut, fin);
  if (f.statuses?.length) req = req.in("status", f.statuses);
  if (f.lotId) req = req.eq("lot_id", f.lotId);
  if (f.from) req = req.gte("created_at", f.from);
  if (f.to) req = req.lte("created_at", f.to);
  if (f.q) req = req.ilike("public_number", `%${f.q}%`);
  const { data, count, error } = await req;
  if (error) throw new Error(error.message);
  return {
    rows: (data ?? []).map((b: any) => ({
      id: b.id,
      public_number: b.public_number,
      status: b.status,
      created_at: b.created_at,
      activated_at: b.activated_at,
      lot_id: b.lot_id,
      lot_code: b.lots?.code ?? null,
      category: b.category ?? null,
    })),
    total: count ?? 0,
    page: f.page,
    pageSize: f.pageSize,
  };
}

export async function detailBalise(id: string) {
  const { data: beacon } = await supabaseAdmin
    .from("beacons")
    .select("*, lots(code, supplier, status, category)")
    .eq("id", id)
    .maybeSingle();
  if (!beacon) throw new Error("Balise introuvable.");
  const { data: adresse } = await supabaseAdmin
    .from("addresses")
    .select("id, name, category, visibility, verification_level, status, location")
    .eq("beacon_id", id)
    .maybeSingle();
  const { data: installation } = await supabaseAdmin
    .from("installations")
    .select("id, gps_lat, gps_lng, accuracy_m, installed_at, validated_at, agent_id")
    .eq("beacon_id", id)
    .order("installed_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return {
    beacon,
    adresse: adresse
      ? { ...adresse, point: parsePointHex((adresse as any).location), location: undefined }
      : null,
    installation: installation ?? null,
  };
}

export async function changerStatutBalise(id: string, statut: string) {
  const { error } = await supabaseAdmin.from("beacons").update({ status: statut }).eq("id", id);
  if (error) throw new Error(error.message);
  return { success: true };
}

export async function genererLotBalises(input: {
  quantity: number;
  regionId: string;
  category?: string | null;
  supplier: string | null;
  unitPriceGnf: number | null;
}) {
  const quantite = Math.min(Math.max(Math.round(input.quantity), 1), 1000);
  const category = input.category?.trim() || "residential";
  const { data: region } = await supabaseAdmin
    .from("regions")
    .select("id, code")
    .eq("id", input.regionId)
    .maybeSingle();
  if (!region) throw new Error("Zone (région) introuvable.");
  const prefixe = `GN-${region.code.toUpperCase().slice(0, 3)}-`;
  const { data: derniere } = await supabaseAdmin
    .from("beacons")
    .select("public_number")
    .like("public_number", `${prefixe}%`)
    .order("public_number", { ascending: false })
    .limit(1)
    .maybeSingle();
  let suivant = derniere ? Number(derniere.public_number.slice(-6)) + 1 : 100011;
  if (!Number.isFinite(suivant)) suivant = 100011;
  const code = `LOT-${region.code.toUpperCase()}-${Date.now().toString().slice(-8)}`;
  const { data: lot, error: erreurLot } = await supabaseAdmin
    .from("lots")
    .insert({
      code,
      quantity: quantite,
      supplier: input.supplier,
      status: "generated",
      category,
      received_at: new Date().toISOString(),
    })
    .select("id, code")
    .single();
  if (erreurLot || !lot) throw new Error(erreurLot?.message ?? "Création du lot impossible.");
  const balises = Array.from({ length: quantite }, (_, i) => ({
    public_number: `${prefixe}${String(suivant + i).padStart(6, "0")}`,
    qr_token: crypto.randomUUID(),
    status: "generated",
    lot_id: lot.id,
    category,
  }));
  const { error: erreurBalises } = await supabaseAdmin.from("beacons").insert(balises);
  if (erreurBalises) throw new Error(erreurBalises.message);
  return {
    success: true,
    lotId: lot.id,
    lotCode: lot.code,
    quantite,
    category,
    premier: balises[0]!.public_number,
    dernier: balises[balises.length - 1]!.public_number,
    prixUnitaire: input.unitPriceGnf,
  };
}

export async function affecterLotAgent(lotId: string, agentId: string) {
  const { error } = await supabaseAdmin.from("lot_assignments").insert({
    lot_id: lotId,
    agent_id: agentId,
    assigned_at: new Date().toISOString(),
  });
  if (error) throw new Error(error.message);
  await supabaseAdmin
    .from("beacons")
    .update({ status: "assigned" })
    .eq("lot_id", lotId)
    .eq("status", "generated");
  await supabaseAdmin.from("lots").update({ status: "distributed" }).eq("id", lotId);
  return { success: true };
}

export async function numerosDuLot(lotId: string, limite = 600) {
  const { data } = await supabaseAdmin
    .from("beacons")
    .select("public_number")
    .eq("lot_id", lotId)
    .order("public_number")
    .limit(limite);
  return (data ?? []).map((b) => b.public_number);
}

export async function codeDuLot(lotId: string) {
  const { data } = await supabaseAdmin.from("lots").select("code").eq("id", lotId).maybeSingle();
  return data?.code ?? "INCONNU";
}

/* ------------------------------ ADRESSES ------------------------------ */

export async function listerAdresses(f: {
  page: number;
  pageSize: number;
  visibility?: string | null;
  category?: string | null;
  verification?: string | null;
  communeId?: string | null;
  status?: string | null;
  from?: string | null;
  to?: string | null;
  q?: string | null;
}) {
  const [debut, fin] = plage(f.page, f.pageSize);
  let req = supabaseAdmin
    .from("addresses")
    .select(
      "id, name, category, visibility, verification_level, status, created_at, commune_id, beacon_id, beacons(public_number), communes(name)",
      { count: "exact" },
    )
    .order("created_at", { ascending: false })
    .range(debut, fin);
  if (f.visibility) req = req.eq("visibility", f.visibility);
  if (f.category) req = req.eq("category", f.category);
  if (f.verification) req = req.eq("verification_level", f.verification);
  if (f.communeId) req = req.eq("commune_id", f.communeId);
  if (f.status) req = req.eq("status", f.status);
  if (f.from) req = req.gte("created_at", f.from);
  if (f.to) req = req.lte("created_at", f.to);
  if (f.q) req = req.ilike("name", `%${f.q}%`);
  const { data, count, error } = await req;
  if (error) throw new Error(error.message);
  return {
    rows: (data ?? []).map((a: any) => ({
      id: a.id,
      name: a.name,
      category: a.category,
      visibility: a.visibility,
      verification_level: a.verification_level,
      status: a.status,
      created_at: a.created_at,
      beacon_number: a.beacons?.public_number ?? null,
      commune_name: a.communes?.name ?? null,
    })),
    total: count ?? 0,
    page: f.page,
    pageSize: f.pageSize,
  };
}

export async function detailAdresse(id: string) {
  const { data: adresse } = await supabaseAdmin
    .from("addresses")
    .select("*, beacons(public_number, status), communes(name), districts(name)")
    .eq("id", id)
    .maybeSingle();
  if (!adresse) throw new Error("Adresse introuvable.");
  const { data: journal } = await supabaseAdmin
    .from("audit_logs")
    .select("id, action, actor_id, created_at, before, after")
    .eq("entity", "addresses")
    .eq("entity_id", id)
    .order("created_at", { ascending: false })
    .limit(30);
  const { data: etablissement } = await supabaseAdmin
    .from("establishments")
    .select("id, business_name, phone, description, cover_url")
    .eq("address_id", id)
    .maybeSingle();
  const { location, ...reste } = adresse as any;
  return {
    adresse: { ...reste, point: parsePointHex(location) },
    journal: journal ?? [],
    etablissement: etablissement ?? null,
  };
}

export async function majAdresse(
  id: string,
  patch: {
    name?: string | null;
    category?: string;
    visibility?: string;
    verification_level?: string;
    status?: string;
    access_point_note?: string | null;
  },
) {
  const { error } = await supabaseAdmin
    .from("addresses")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw new Error(error.message);
  return { success: true };
}

export async function reassignerProprietaire(addressId: string, email: string) {
  const { data: liste } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  const utilisateur = liste?.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
  if (!utilisateur) throw new Error("Aucun utilisateur avec cet email.");
  const { error } = await supabaseAdmin
    .from("addresses")
    .update({ owner_id: utilisateur.id, updated_at: new Date().toISOString() })
    .eq("id", addressId);
  if (error) throw new Error(error.message);
  return { success: true, userId: utilisateur.id };
}

/* --------------------------- INSTALLATIONS / QC --------------------------- */

const MOTIF_QC = "qc_recheck";

export async function listerInstallations(f: {
  page: number;
  pageSize: number;
  agentId?: string | null;
  validation?: "validated" | "pending" | null;
  accuracyMax?: number | null;
}) {
  const [debut, fin] = plage(f.page, f.pageSize);
  let req = supabaseAdmin
    .from("installations")
    .select(
      "id, beacon_id, agent_id, gps_lat, gps_lng, accuracy_m, photo_url, installed_at, validated_at, validator_id, beacons(public_number)",
      { count: "exact" },
    )
    .order("installed_at", { ascending: false })
    .range(debut, fin);
  if (f.agentId) req = req.eq("agent_id", f.agentId);
  if (f.validation === "validated") req = req.not("validated_at", "is", null);
  if (f.validation === "pending") req = req.is("validated_at", null);
  if (f.accuracyMax) req = req.lte("accuracy_m", f.accuracyMax);
  const { data, count, error } = await req;
  if (error) throw new Error(error.message);
  const agents = [...new Set((data ?? []).map((i: any) => i.agent_id).filter(Boolean))];
  const badges = new Map<string, string>();
  if (agents.length) {
    const { data: lignes } = await supabaseAdmin
      .from("agents")
      .select("id, badge_number")
      .in("id", agents as string[]);
    for (const a of lignes ?? []) badges.set(a.id, a.badge_number);
  }
  return {
    rows: (data ?? []).map((i: any) => ({
      id: i.id,
      beacon_number: i.beacons?.public_number ?? null,
      agent_id: i.agent_id,
      agent_badge: badges.get(i.agent_id ?? "") ?? null,
      gps_lat: i.gps_lat,
      gps_lng: i.gps_lng,
      accuracy_m: i.accuracy_m,
      photo_url: i.photo_url,
      installed_at: i.installed_at,
      validated_at: i.validated_at,
    })),
    total: count ?? 0,
    page: f.page,
    pageSize: f.pageSize,
  };
}

export async function tirerControleQc(pourcentage: number) {
  const taux = Math.min(Math.max(pourcentage, 1), 100) / 100;
  const depuis = new Date(Date.now() - 30 * 864e5).toISOString();
  const { data } = await supabaseAdmin
    .from("installations")
    .select("id, beacon_id")
    .is("validated_at", null)
    .gte("installed_at", depuis)
    .limit(2000);
  const candidats = data ?? [];
  const cible = Math.max(1, Math.round(candidats.length * taux));
  const melange = [...candidats].sort(() => Math.random() - 0.5).slice(0, cible);
  if (melange.length === 0) return { success: true, tirees: 0 };
  const lignes = melange
    .filter((i) => i.beacon_id)
    .map((i) => ({
      beacon_id: i.beacon_id,
      reason: MOTIF_QC,
      description: `Contrôle qualité aléatoire (installation ${i.id}).`,
      status: "new",
    }));
  if (lignes.length) {
    const { error } = await supabaseAdmin.from("reports").insert(lignes);
    if (error) throw new Error(error.message);
  }
  return { success: true, tirees: lignes.length };
}

export async function fileQc(limite = 50) {
  const { data: signalements } = await supabaseAdmin
    .from("reports")
    .select("id, beacon_id, description, created_at, status")
    .eq("reason", MOTIF_QC)
    .in("status", ["new", "in_review"])
    .order("created_at", { ascending: false })
    .limit(limite);
  const balises = [...new Set((signalements ?? []).map((r) => r.beacon_id).filter(Boolean))];
  if (balises.length === 0) return [];
  const [{ data: installations }, { data: adresses }] = await Promise.all([
    supabaseAdmin
      .from("installations")
      .select("id, beacon_id, gps_lat, gps_lng, accuracy_m, photo_url, installed_at, agent_id")
      .in("beacon_id", balises as string[]),
    supabaseAdmin
      .from("addresses")
      .select("id, beacon_id, commune_id, communes(name, boundary)")
      .in("beacon_id", balises as string[]),
  ]);
  const { data: numeros } = await supabaseAdmin
    .from("beacons")
    .select("id, public_number")
    .in("id", balises as string[]);
  const parBalise = new Map((numeros ?? []).map((b) => [b.id, b.public_number]));
  const mesures = new Map<string, number>();
  const idsInstall = (installations ?? []).map((i) => i.id);
  if (idsInstall.length) {
    const { data: pts } = await supabaseAdmin
      .from("installation_measures")
      .select("installation_id")
      .in("installation_id", idsInstall);
    for (const m of pts ?? []) {
      mesures.set(m.installation_id!, (mesures.get(m.installation_id!) ?? 0) + 1);
    }
  }
  return (signalements ?? []).map((r) => {
    const install = (installations ?? []).find((i) => i.beacon_id === r.beacon_id);
    const adresse: any = (adresses ?? []).find((a: any) => a.beacon_id === r.beacon_id);
    let coherence: "ok" | "hors_zone" | "indetermine" = "indetermine";
    if (install && adresse?.communes?.boundary) {
      const anneaux = parsePolygonHex(adresse.communes.boundary);
      if (anneaux.length) {
        coherence = pointDansAnneaux(
          { lat: Number(install.gps_lat), lng: Number(install.gps_lng) },
          anneaux,
        )
          ? "ok"
          : "hors_zone";
      }
    }
    return {
      report_id: r.id,
      status: r.status,
      created_at: r.created_at,
      beacon_number: parBalise.get(r.beacon_id ?? "") ?? null,
      installation_id: install?.id ?? null,
      agent_id: install?.agent_id ?? null,
      gps_lat: install?.gps_lat ?? null,
      gps_lng: install?.gps_lng ?? null,
      accuracy_m: install?.accuracy_m ?? null,
      photo_url: install?.photo_url ?? null,
      nb_mesures: install ? (mesures.get(install.id) ?? 0) : 0,
      commune_name: adresse?.communes?.name ?? null,
      coherence,
    };
  });
}

export async function statuerInstallation(input: {
  validatorId: string;
  installationId: string | null;
  reportId: string | null;
  decision: "valider" | "rejeter";
  motif?: string | null;
}) {
  if (input.decision === "rejeter" && !input.motif?.trim()) {
    throw new Error("Un motif est obligatoire pour rejeter une installation.");
  }
  if (input.decision === "valider" && input.installationId) {
    const { error } = await supabaseAdmin
      .from("installations")
      .update({ validated_at: new Date().toISOString(), validator_id: input.validatorId })
      .eq("id", input.installationId);
    if (error) throw new Error(error.message);
  }
  if (input.reportId) {
    await supabaseAdmin
      .from("reports")
      .update({ status: input.decision === "valider" ? "resolved" : "rejected" })
      .eq("id", input.reportId);
  }
  if (input.decision === "rejeter" && input.installationId) {
    const { data: install } = await supabaseAdmin
      .from("installations")
      .select("beacon_id, agent_id")
      .eq("id", input.installationId)
      .maybeSingle();
    if (install?.beacon_id) {
      await supabaseAdmin.from("reports").insert({
        beacon_id: install.beacon_id,
        reporter_id: input.validatorId,
        reason: "qc_reject",
        description: input.motif!.trim(),
        status: "in_review",
      });
    }
    if (install?.agent_id) {
      await supabaseAdmin.from("notifications").insert({
        user_id: install.agent_id,
        type: "qc_reject",
        payload: { installation_id: input.installationId, motif: input.motif },
      });
    }
  }
  return { success: true };
}

export async function metriquesAgents() {
  const { data: agents } = await supabaseAdmin.from("agents").select("id, badge_number, active");
  const { data: installations } = await supabaseAdmin
    .from("installations")
    .select("agent_id, accuracy_m, validated_at")
    .limit(10000);
  const { data: rejets } = await supabaseAdmin
    .from("reports")
    .select("id, description")
    .eq("reason", "qc_reject")
    .limit(2000);
  const parAgent = new Map<string, { total: number; valides: number; precision: number; nbPrecision: number }>();
  for (const i of installations ?? []) {
    if (!i.agent_id) continue;
    const cur = parAgent.get(i.agent_id) ?? { total: 0, valides: 0, precision: 0, nbPrecision: 0 };
    cur.total += 1;
    if (i.validated_at) cur.valides += 1;
    if (i.accuracy_m != null) {
      cur.precision += Number(i.accuracy_m);
      cur.nbPrecision += 1;
    }
    parAgent.set(i.agent_id, cur);
  }
  return (agents ?? []).map((a) => {
    const m = parAgent.get(a.id);
    const total = m?.total ?? 0;
    return {
      agent_id: a.id,
      badge_number: a.badge_number,
      active: a.active,
      total,
      taux_validation: total ? Math.round(((m?.valides ?? 0) / total) * 100) : 0,
      taux_rejet: total
        ? Math.round((((rejets ?? []).length ? 0 : 0) + (total - (m?.valides ?? 0)) / total) * 100)
        : 0,
      precision_moyenne: m?.nbPrecision ? Math.round(m.precision / m.nbPrecision) : null,
    };
  });
}

/* --------------------------- PLANIFICATION --------------------------- */

export async function listerPlanifications(f: {
  from?: string | null;
  to?: string | null;
  agentId?: string | null;
  status?: string | null;
}) {
  let req = supabaseAdmin
    .from("installation_plans")
    .select("id, beacon_id, agent_id, commune_id, scheduled_date, address_hint, notes, status, created_at, beacons(public_number), communes(name)")
    .order("scheduled_date", { ascending: true })
    .limit(500);
  if (f.from) req = req.gte("scheduled_date", f.from);
  if (f.to) req = req.lte("scheduled_date", f.to);
  if (f.agentId) req = req.eq("agent_id", f.agentId);
  if (f.status) req = req.eq("status", f.status);
  const { data, error } = await req;
  if (error) throw new Error(error.message);
  const agents = [...new Set((data ?? []).map((p: any) => p.agent_id).filter(Boolean))] as string[];
  const badges = new Map<string, { badge: string; nom: string | null }>();
  if (agents.length) {
    const [{ data: ags }, { data: profs }] = await Promise.all([
      supabaseAdmin.from("agents").select("id, badge_number").in("id", agents),
      supabaseAdmin.from("profiles").select("id, full_name").in("id", agents),
    ]);
    for (const a of ags ?? []) badges.set(a.id, { badge: a.badge_number, nom: null });
    for (const p of profs ?? []) {
      const cur = badges.get(p.id) ?? { badge: "—", nom: null };
      cur.nom = p.full_name ?? null;
      badges.set(p.id, cur);
    }
  }
  return (data ?? []).map((p: any) => ({
    id: p.id,
    beacon_id: p.beacon_id,
    beacon_number: p.beacons?.public_number ?? null,
    agent_id: p.agent_id,
    agent_badge: badges.get(p.agent_id ?? "")?.badge ?? null,
    agent_name: badges.get(p.agent_id ?? "")?.nom ?? null,
    commune_id: p.commune_id,
    commune_name: p.communes?.name ?? null,
    scheduled_date: p.scheduled_date,
    address_hint: p.address_hint,
    notes: p.notes,
    status: p.status,
    created_at: p.created_at,
  }));
}

export async function creerPlanification(input: {
  beaconId: string | null;
  agentId: string;
  communeId: string | null;
  scheduledDate: string;
  addressHint: string | null;
  notes: string | null;
  createdBy: string;
}) {
  if (!input.agentId) throw new Error("Agent obligatoire.");
  if (!input.scheduledDate) throw new Error("Date obligatoire.");
  const { data, error } = await supabaseAdmin
    .from("installation_plans")
    .insert({
      beacon_id: input.beaconId,
      agent_id: input.agentId,
      commune_id: input.communeId,
      scheduled_date: input.scheduledDate,
      address_hint: input.addressHint,
      notes: input.notes,
      status: "planned",
      created_by: input.createdBy,
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  return { success: true, id: data.id };
}

export async function majPlanification(id: string, patch: {
  agentId?: string;
  scheduledDate?: string;
  status?: string;
  addressHint?: string | null;
  notes?: string | null;
  communeId?: string | null;
}) {
  const update: Database["public"]["Tables"]["installation_plans"]["Update"] = {
    updated_at: new Date().toISOString(),
  };
  if (patch.agentId) update['agent_id'] = patch.agentId;
  if (patch.scheduledDate) update['scheduled_date'] = patch.scheduledDate;
  if (patch.status) update['status'] = patch.status;
  if (patch.addressHint !== undefined) update['address_hint'] = patch.addressHint;
  if (patch.notes !== undefined) update['notes'] = patch.notes;
  if (patch.communeId !== undefined) update['commune_id'] = patch.communeId;
  const { error } = await supabaseAdmin.from("installation_plans").update(update).eq("id", id);
  if (error) throw new Error(error.message);
  return { success: true };
}

export async function supprimerPlanification(id: string) {
  const { error } = await supabaseAdmin.from("installation_plans").delete().eq("id", id);
  if (error) throw new Error(error.message);
  return { success: true };
}

/* --------------------------- RAPPORT D'INSTALLATIONS --------------------------- */

export async function rapportInstallations(f: {
  from?: string | null;
  to?: string | null;
  agentId?: string | null;
  communeId?: string | null;
  validation?: "validated" | "pending" | "rejected" | null;
}) {
  let req = supabaseAdmin
    .from("installations")
    .select("id, beacon_id, agent_id, gps_lat, gps_lng, accuracy_m, photo_url, installed_at, validated_at, validator_id, beacons(public_number, category)")
    .order("installed_at", { ascending: false })
    .limit(2000);
  if (f.from) req = req.gte("installed_at", f.from);
  if (f.to) req = req.lte("installed_at", f.to);
  if (f.agentId) req = req.eq("agent_id", f.agentId);
  if (f.validation === "validated") req = req.not("validated_at", "is", null);
  if (f.validation === "pending") req = req.is("validated_at", null);
  const { data, error } = await req;
  if (error) throw new Error(error.message);
  const agents = [...new Set((data ?? []).map((i: any) => i.agent_id).filter(Boolean))] as string[];
  const badges = new Map<string, string>();
  if (agents.length) {
    const { data: ags } = await supabaseAdmin.from("agents").select("id, badge_number").in("id", agents);
    for (const a of ags ?? []) badges.set(a.id, a.badge_number);
  }
  // installations n'a pas de lien direct vers addresses : on passe par beacon_id
  const beaconIds = [...new Set((data ?? []).map((i: any) => i.beacon_id).filter(Boolean))] as string[];
  const communesParBalise = new Map<string, { id: string | null; name: string | null }>();
  if (beaconIds.length) {
    const { data: adrs } = await supabaseAdmin
      .from("addresses")
      .select("beacon_id, commune_id, communes(name)")
      .in("beacon_id", beaconIds);
    for (const a of (adrs ?? []) as any[]) {
      if (a.beacon_id && !communesParBalise.has(a.beacon_id)) {
        communesParBalise.set(a.beacon_id, { id: a.commune_id ?? null, name: a.communes?.name ?? null });
      }
    }
  }
  let rows = (data ?? []).map((i: any) => ({
    id: i.id,
    beacon_number: i.beacons?.public_number ?? null,
    beacon_category: i.beacons?.category ?? null,
    agent_id: i.agent_id,
    agent_badge: badges.get(i.agent_id ?? "") ?? null,
    commune_name: communesParBalise.get(i.beacon_id ?? "")?.name ?? null,
    commune_id: communesParBalise.get(i.beacon_id ?? "")?.id ?? null,
    gps_lat: i.gps_lat,
    gps_lng: i.gps_lng,
    accuracy_m: i.accuracy_m,
    photo_url: i.photo_url,
    installed_at: i.installed_at,
    validated_at: i.validated_at,
  }));
  if (f.communeId) rows = rows.filter((r) => r.commune_id === f.communeId);

  const stats = {
    total: rows.length,
    validees: rows.filter((r) => r.validated_at).length,
    enAttente: rows.filter((r) => !r.validated_at).length,
    precisionMoyenne: (() => {
      const avecPrec = rows.filter((r) => r.accuracy_m != null);
      if (!avecPrec.length) return null;
      return Math.round(avecPrec.reduce((s, r) => s + Number(r.accuracy_m), 0) / avecPrec.length);
    })(),
  };
  return { rows, stats };
}

/* --------------------------- SIGNALEMENTS --------------------------- */

export async function listerSignalements(statut: string | null) {
  let req = supabaseAdmin
    .from("reports")
    .select("id, beacon_id, reporter_id, reason, description, status, created_at, beacons(public_number)")
    .order("created_at", { ascending: false })
    .limit(200);
  if (statut) req = req.eq("status", statut);
  const { data, error } = await req;
  if (error) throw new Error(error.message);
  const declarants = [...new Set((data ?? []).map((r: any) => r.reporter_id).filter(Boolean))];
  const profils = new Map<string, { nom: string | null; tel: string | null }>();
  if (declarants.length) {
    const { data: lignes } = await supabaseAdmin
      .from("profiles")
      .select("id, full_name, phone")
      .in("id", declarants as string[]);
    for (const p of lignes ?? []) {
      profils.set(p.id, { nom: p.full_name ?? null, tel: p.phone ?? null });
    }
  }
  return (data ?? []).map((r: any) => ({
    id: r.id,
    beacon_number: r.beacons?.public_number ?? null,
    reason: r.reason,
    description: r.description,
    status: r.status,
    created_at: r.created_at,
    reporter_id: r.reporter_id,
    reporter_name: profils.get(r.reporter_id ?? "")?.nom ?? null,
    reporter_phone: profils.get(r.reporter_id ?? "")?.tel ?? null,
  }));
}

export async function majSignalement(input: { id: string; status: string; comment?: string | null; actorId: string }) {
  const { data: report } = await supabaseAdmin
    .from("reports")
    .select("id, reporter_id, description")
    .eq("id", input.id)
    .maybeSingle();
  if (!report) throw new Error("Signalement introuvable.");
  const description = input.comment?.trim()
    ? `${report.description ?? ""}\n\n[Admin] ${input.comment.trim()}`.trim()
    : report.description;
  const { error } = await supabaseAdmin
    .from("reports")
    .update({ status: input.status, description })
    .eq("id", input.id);
  if (error) throw new Error(error.message);
  if (report.reporter_id) {
    await supabaseAdmin.from("notifications").insert({
      user_id: report.reporter_id,
      type: "report_status",
      payload: { report_id: input.id, status: input.status, comment: input.comment ?? null },
    });
  }
  return { success: true };
}

/* --------------------------- UTILISATEURS --------------------------- */

export async function listerUtilisateurs(page: number, recherche: string | null) {
  const perPage = 50;
  const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage });
  if (error) throw new Error(error.message);
  const ids = data.users.map((u) => u.id);
  const profils = new Map<string, { role: string; full_name: string | null; phone: string | null }>();
  if (ids.length) {
    const { data: lignes } = await supabaseAdmin
      .from("profiles")
      .select("id, role, full_name, phone")
      .in("id", ids);
    for (const p of lignes ?? []) {
      profils.set(p.id, { role: p.role, full_name: p.full_name ?? null, phone: p.phone ?? null });
    }
  }
  let rows = data.users.map((u) => ({
    id: u.id,
    email: u.email ?? null,
    created_at: u.created_at,
    banned: Boolean((u as any).banned_until),
    full_name: profils.get(u.id)?.full_name ?? null,
    phone: profils.get(u.id)?.phone ?? null,
    role: profils.get(u.id)?.role ?? "user",
  }));
  if (recherche) {
    const q = recherche.toLowerCase();
    rows = rows.filter(
      (r) =>
        (r.email ?? "").toLowerCase().includes(q) ||
        (r.full_name ?? "").toLowerCase().includes(q) ||
        (r.phone ?? "").includes(q),
    );
  }
  return { rows, page, hasMore: data.users.length === perPage };
}

export async function changerRole(userId: string, role: string) {
  const { error } = await supabaseAdmin.from("profiles").update({ role }).eq("id", userId);
  if (error) throw new Error(error.message);
  return { success: true };
}

export async function desactiverUtilisateur(userId: string, desactiver: boolean) {
  const { error } = await supabaseAdmin.auth.admin.updateUserById(userId, {
    ban_duration: desactiver ? "876000h" : "none",
  });
  if (error) throw new Error(error.message);
  return { success: true };
}

export async function reinitialiserMotDePasse(email: string, origine: string) {
  const { error } = await supabaseAdmin.auth.resetPasswordForEmail(email, {
    redirectTo: `${origine}/login`,
  });
  if (error) throw new Error(error.message);
  return { success: true };
}

export async function creerUtilisateur(input: {
  email: string;
  password: string;
  role: string;
  fullName: string | null;
  phone: string | null;
}) {
  const { data, error } = await supabaseAdmin.auth.admin.createUser({
    email: input.email,
    password: input.password,
    email_confirm: true,
    user_metadata: { full_name: input.fullName, phone: input.phone },
  });
  if (error || !data.user) throw new Error(error?.message ?? "Création impossible.");
  await supabaseAdmin.from("profiles").upsert({
    id: data.user.id,
    role: input.role,
    full_name: input.fullName,
    phone: input.phone,
  });
  return { success: true, userId: data.user.id };
}

/* ------------------------------- AGENTS ------------------------------- */

export async function listerAgents() {
  const { data: agents, error } = await supabaseAdmin
    .from("agents")
    .select("id, badge_number, zone_id, active, hired_at, communes(name)");
  if (error) throw new Error(error.message);
  const ids = (agents ?? []).map((a) => a.id);
  const profils = new Map<string, { nom: string | null; tel: string | null }>();
  if (ids.length) {
    const { data: lignes } = await supabaseAdmin
      .from("profiles")
      .select("id, full_name, phone")
      .in("id", ids);
    for (const p of lignes ?? []) {
      profils.set(p.id, { nom: p.full_name ?? null, tel: p.phone ?? null });
    }
  }
  const { data: installations } = await supabaseAdmin
    .from("installations")
    .select("agent_id, installed_at")
    .limit(10000);
  const stats = new Map<string, { total: number; dernier: string | null }>();
  for (const i of installations ?? []) {
    if (!i.agent_id) continue;
    const cur = stats.get(i.agent_id) ?? { total: 0, dernier: null };
    cur.total += 1;
    if (!cur.dernier || (i.installed_at ?? "") > cur.dernier) cur.dernier = i.installed_at ?? null;
    stats.set(i.agent_id, cur);
  }
  return (agents ?? []).map((a: any) => ({
    id: a.id,
    badge_number: a.badge_number,
    full_name: profils.get(a.id)?.nom ?? null,
    phone: profils.get(a.id)?.tel ?? null,
    zone_id: a.zone_id,
    zone_name: a.communes?.name ?? null,
    active: a.active,
    hired_at: a.hired_at,
    installations: stats.get(a.id)?.total ?? 0,
    derniere_installation: stats.get(a.id)?.dernier ?? null,
  }));
}

export async function majAgent(input: {
  id: string;
  badgeNumber?: string;
  zoneId?: string | null;
  active?: boolean;
  fullName?: string | null;
  phone?: string | null;
}) {
  const patchAgent: Record<string, unknown> = {};
  if (input.badgeNumber) patchAgent['badge_number'] = input.badgeNumber;
  if (input.zoneId !== undefined) patchAgent['zone_id'] = input.zoneId;
  if (input.active !== undefined) patchAgent['active'] = input.active;
  if (Object.keys(patchAgent).length) {
    const { error } = await supabaseAdmin.from("agents").update(patchAgent as any).eq("id", input.id);
    if (error) throw new Error(error.message);
  }
  const patchProfil: Record<string, unknown> = {};
  if (input.fullName !== undefined) patchProfil['full_name'] = input.fullName;
  if (input.phone !== undefined) patchProfil['phone'] = input.phone;
  if (Object.keys(patchProfil).length) {
    await supabaseAdmin.from("profiles").update(patchProfil as any).eq("id", input.id);
  }
  return { success: true };
}

export async function creerAgent(input: {
  email: string;
  password: string;
  fullName: string;
  phone: string | null;
  badgeNumber: string;
  zoneId: string | null;
}) {
  const { userId } = await creerUtilisateur({
    email: input.email,
    password: input.password,
    role: "agent",
    fullName: input.fullName,
    phone: input.phone,
  });
  const { error } = await supabaseAdmin.from("agents").insert({
    id: userId,
    badge_number: input.badgeNumber,
    zone_id: input.zoneId,
    active: true,
    hired_at: new Date().toISOString().slice(0, 10),
  });
  if (error) throw new Error(error.message);
  return { success: true, userId };
}

/* -------------------------------- LOTS -------------------------------- */

export async function listerLots() {
  const { data: lots, error } = await supabaseAdmin
    .from("lots")
    .select("id, code, quantity, supplier, status, received_at, category")
    .order("received_at", { ascending: false });
  if (error) throw new Error(error.message);
  const { data: affectations } = await supabaseAdmin
    .from("lot_assignments")
    .select("lot_id, agent_id, assigned_at, agents(badge_number)");
  return (lots ?? []).map((l) => ({
    ...l,
    assignations: ((affectations ?? []) as any[])
      .filter((a) => a.lot_id === l.id)
      .map((a) => ({
        agent_id: a.agent_id,
        badge: a.agents?.badge_number ?? null,
        assigned_at: a.assigned_at,
      })),
  }));
}

export async function majLot(id: string, statut: string) {
  const { error } = await supabaseAdmin.from("lots").update({ status: statut }).eq("id", id);
  if (error) throw new Error(error.message);
  return { success: true };
}

/* -------------------------------- ZONES -------------------------------- */

export async function listerZones() {
  const [{ data: regions }, { data: communes }, { data: districts }] = await Promise.all([
    supabaseAdmin.from("regions").select("id, code, name, country_code").order("name"),
    supabaseAdmin.from("communes").select("id, name, region_id").order("name"),
    supabaseAdmin.from("districts").select("id, name, commune_id").order("name"),
  ]);
  return { regions: regions ?? [], communes: communes ?? [], districts: districts ?? [] };
}

export async function enregistrerZone(input: {
  niveau: "region" | "commune" | "district";
  id?: string | null;
  name: string;
  code?: string | null;
  parentId?: string | null;
  geojson?: string | null;
}) {
  const geo = input.geojson ? JSON.parse(input.geojson) : null;
  const geometrie = geo
    ? geo.type === "FeatureCollection"
      ? geo.features?.[0]?.geometry
      : geo.type === "Feature"
        ? geo.geometry
        : geo
    : null;
  const boundary = geometrie ? (JSON.stringify(geometrie) as unknown as string) : null;
  if (input.niveau === "region") {
    const ligne = {
      name: input.name,
      code: (input.code ?? input.name.slice(0, 3)).toUpperCase(),
      country_code: "GN",
    };
    if (input.id) {
      const { error } = await supabaseAdmin.from("regions").update(ligne).eq("id", input.id);
      if (error) throw new Error(error.message);
    } else {
      const { error } = await supabaseAdmin.from("regions").insert(ligne);
      if (error) throw new Error(error.message);
    }
    return { success: true };
  }
  const table = input.niveau === "commune" ? "communes" : "districts";
  const cleParent = input.niveau === "commune" ? "region_id" : "commune_id";
  const ligne: Record<string, unknown> = { name: input.name, [cleParent]: input.parentId };
  if (boundary) ligne['boundary'] = boundary;
  if (input.id) {
    const { error } = await supabaseAdmin.from(table).update(ligne as any).eq("id", input.id);
    if (error) throw new Error(error.message);
  } else {
    const { error } = await supabaseAdmin.from(table).insert(ligne as any);
    if (error) throw new Error(error.message);
  }
  return { success: true };
}

export async function supprimerZone(niveau: "region" | "commune" | "district", id: string) {
  const table = niveau === "region" ? "regions" : niveau === "commune" ? "communes" : "districts";
  const { error } = await supabaseAdmin.from(table).delete().eq("id", id);
  if (error) throw new Error(error.message);
  return { success: true };
}
/* --------------------------- NOTIFICATIONS --------------------------- */

export async function listerNotifications(userId: string, limite = 20) {
  const { data, error } = await supabaseAdmin
    .from("notifications")
    .select("id, type, payload, read_at, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limite);
  if (error) throw new Error(error.message);
  return {
    rows: data ?? [],
    nonLues: (data ?? []).filter((n: any) => !n.read_at).length,
  };
}

export async function marquerNotificationLue(userId: string, id: string) {
  const { error } = await supabaseAdmin
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("id", id)
    .eq("user_id", userId);
  if (error) throw new Error(error.message);
  return { success: true };
}

export async function marquerToutesLues(userId: string) {
  const { error } = await supabaseAdmin
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("user_id", userId)
    .is("read_at", null);
  if (error) throw new Error(error.message);
  return { success: true };
}
/* --------------------------- PRÉFÉRENCES UTILISATEUR --------------------------- */

export async function chargerPreferences(userId: string) {
  const { data, error } = await supabaseAdmin
    .from("profiles")
    .select("preferences")
    .eq("id", userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  const preferences = data?.preferences;
  if (!preferences || Array.isArray(preferences) || typeof preferences !== "object") {
    return { theme: null, accent: null };
  }
  return {
    theme: preferences['theme'] === "dark" || preferences['theme'] === "light"
      ? preferences['theme']
      : null,
    accent: typeof preferences['accent'] === "string" ? preferences['accent'] : null,
  };
}

export async function sauverPreferences(
  userId: string,
  patch: {
    theme?: "dark" | "light" | undefined;
    accent?: string | undefined;
  },
) {
  const { data, error: readError } = await supabaseAdmin
    .from("profiles")
    .select("preferences")
    .eq("id", userId)
    .maybeSingle();
  if (readError) throw new Error(readError.message);
  const current = data?.preferences;
  const base: { [key: string]: Json | undefined } =
    current && !Array.isArray(current) && typeof current === "object" ? current : {};
  const merged: Json = { ...base, ...patch };
  const { error } = await supabaseAdmin
    .from("profiles")
    .update({ preferences: merged })
    .eq("id", userId);
  if (error) throw new Error(error.message);
  return {
    theme: merged['theme'] === "dark" || merged['theme'] === "light" ? merged['theme'] : null,
    accent: typeof merged['accent'] === "string" ? merged['accent'] : null,
  };
}
