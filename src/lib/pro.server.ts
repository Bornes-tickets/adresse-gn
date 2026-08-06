/**
 * Portail professionnel : espaces business, établissements, statistiques,
 * équipe, facturation et clés API. Toutes les fonctions filtrent sur
 * l'utilisateur authentifié ou son équipe.
 */
import bcrypt from "bcryptjs";

import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { PLANS } from "@/lib/portal";
import type { ApiKeyRow, BusinessProfile, ProEstablishment, ProStats } from "@/lib/portal";

const JOUR_MS = 86_400_000;

function ilYaJours(jours: number): string {
  return new Date(Date.now() - jours * JOUR_MS).toISOString();
}

function base64EnOctets(base64: string): Uint8Array {
  const nu = base64.includes(",") ? base64.split(",")[1]! : base64;
  const binaire = atob(nu);
  const octets = new Uint8Array(binaire.length);
  for (let i = 0; i < binaire.length; i += 1) octets[i] = binaire.charCodeAt(i);
  return octets;
}

async function urlSignee(chemin: string): Promise<string> {
  const { data } = await supabaseAdmin.storage
    .from("establishment-photos")
    .createSignedUrl(chemin, 60 * 60 * 24 * 365 * 5);
  return data?.signedUrl ?? chemin;
}

async function televerserPhoto(userId: string, base64: string, suffixe: string): Promise<string> {
  const chemin = `${userId}/${Date.now()}-${suffixe}.jpg`;
  const { error } = await supabaseAdmin.storage
    .from("establishment-photos")
    .upload(chemin, base64EnOctets(base64), { contentType: "image/jpeg", upsert: true });
  if (error) throw new Error("Envoi de l'image impossible : " + error.message);
  return urlSignee(chemin);
}

/* --------------------------- ESPACE BUSINESS --------------------------- */

export async function chargerMonBusiness(userId: string): Promise<BusinessProfile | null> {
  const { data: possede } = await supabaseAdmin
    .from("business_profiles")
    .select("*")
    .eq("owner_id", userId)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (possede) return { ...(possede as any), my_role: "owner" };

  const { data: membre } = await supabaseAdmin
    .from("team_members")
    .select("role, business_id, business_profiles(*)")
    .eq("member_id", userId)
    .limit(1)
    .maybeSingle();

  if (!membre?.business_profiles) return null;
  return { ...((membre as any).business_profiles as any), my_role: (membre as any).role };
}

/** Identifiants des utilisateurs dont je peux gérer les établissements. */
async function idsGerables(userId: string): Promise<string[]> {
  const business = await chargerMonBusiness(userId);
  const ids = new Set<string>([userId]);
  if (business) {
    ids.add(business.owner_id);
    const { data: membres } = await supabaseAdmin
      .from("team_members")
      .select("member_id")
      .eq("business_id", business.id);
    for (const m of membres ?? []) ids.add(m.member_id as string);
  }
  return [...ids];
}

export async function creerBusiness(
  userId: string,
  input: {
    legalName: string | null;
    tradeName: string;
    category: string | null;
    taxId: string | null;
    contactPhone: string | null;
    contactEmail: string | null;
    headquartersAddress: string | null;
    planCode: string;
  },
) {
  const existant = await chargerMonBusiness(userId);
  if (existant) throw new Error("Vous avez déjà un espace professionnel.");

  const offre = PLANS.find((p) => p.code === input.planCode);
  if (!offre) throw new Error("Offre inconnue.");

  const debut = new Date();
  const fin = new Date(debut.getTime() + 30 * JOUR_MS);

  const { data: business, error } = await supabaseAdmin
    .from("business_profiles")
    .insert({
      owner_id: userId,
      legal_name: input.legalName?.trim() || null,
      trade_name: input.tradeName.trim(),
      category: input.category?.trim() || null,
      tax_id: input.taxId?.trim() || null,
      contact_phone: input.contactPhone?.trim() || null,
      contact_email: input.contactEmail?.trim() || null,
      headquarters_address: input.headquartersAddress?.trim() || null,
      plan_code: input.planCode,
      plan_started_at: debut.toISOString(),
      plan_ends_at: fin.toISOString(),
    })
    .select("*")
    .single();
  if (error) throw new Error(error.message);

  await supabaseAdmin.from("team_members").insert({
    business_id: business.id,
    member_id: userId,
    role: "owner",
    joined_at: debut.toISOString(),
  });

  await supabaseAdmin
    .from("profiles")
    .update({ role: "business_owner" })
    .eq("id", userId)
    .eq("role", "user");

  await creerCommande(userId, input.planCode, offre.setupGnf + offre.monthlyGnf);

  return { ...(business as any), my_role: "owner" } as BusinessProfile;
}

export async function majBusiness(
  userId: string,
  input: Partial<{
    legalName: string | null;
    tradeName: string;
    category: string | null;
    taxId: string | null;
    contactPhone: string | null;
    contactEmail: string | null;
    headquartersAddress: string | null;
  }>,
) {
  const business = await chargerMonBusiness(userId);
  if (!business || business.owner_id !== userId) {
    throw new Error("Action réservée au propriétaire de l'espace.");
  }
  const { error } = await supabaseAdmin
    .from("business_profiles")
    .update({
      legal_name: input.legalName ?? business.legal_name,
      trade_name: input.tradeName ?? business.trade_name,
      category: input.category ?? business.category,
      tax_id: input.taxId ?? business.tax_id,
      contact_phone: input.contactPhone ?? business.contact_phone,
      contact_email: input.contactEmail ?? business.contact_email,
      headquarters_address: input.headquartersAddress ?? business.headquarters_address,
    })
    .eq("id", business.id);
  if (error) throw new Error(error.message);
  return { success: true };
}

/* ---------------------------- ÉTABLISSEMENTS ---------------------------- */

export async function chargerEtablissements(userId: string): Promise<ProEstablishment[]> {
  const ids = await idsGerables(userId);
  const { data, error } = await supabaseAdmin
    .from("establishments")
    .select(
      "id, address_id, business_name, phone, description, cover_url, opening_hours, addresses!inner(owner_id, category, beacons(public_number)), establishment_photos(id, url, order)",
    )
    .in("addresses.owner_id", ids)
    .order("business_name");
  if (error) throw new Error(error.message);

  return (data ?? []).map((e: any) => ({
    id: e.id,
    address_id: e.address_id,
    business_name: e.business_name,
    phone: e.phone ?? null,
    description: e.description ?? null,
    cover_url: e.cover_url ?? null,
    opening_hours: e.opening_hours ?? null,
    public_number: e.addresses?.beacons?.public_number ?? "—",
    category: e.addresses?.category ?? "autre",
    photos: (e.establishment_photos ?? []).sort(
      (a: any, b: any) => (a.order ?? 0) - (b.order ?? 0),
    ),
  }));
}

export async function chargerEtablissement(
  userId: string,
  id: string,
): Promise<ProEstablishment | null> {
  const tous = await chargerEtablissements(userId);
  return tous.find((e) => e.id === id) ?? null;
}

/** Adresses possédées sans fiche établissement (pour la création). */
export async function chargerAdressesDisponibles(userId: string) {
  const ids = await idsGerables(userId);
  const { data, error } = await supabaseAdmin
    .from("addresses")
    .select("id, name, category, beacons(public_number), establishments(id)")
    .in("owner_id", ids);
  if (error) throw new Error(error.message);

  return (data ?? [])
    .filter((a: any) => {
      const e = a.establishments;
      return Array.isArray(e) ? e.length === 0 : !e;
    })
    .map((a: any) => ({
      id: a.id,
      name: a.name ?? null,
      category: a.category,
      public_number: a.beacons?.public_number ?? "—",
    }));
}

async function verifierAdresseGerable(userId: string, addressId: string) {
  const ids = await idsGerables(userId);
  const { data } = await supabaseAdmin
    .from("addresses")
    .select("id, owner_id")
    .eq("id", addressId)
    .maybeSingle();
  if (!data || !data.owner_id || !ids.includes(data.owner_id)) {
    throw new Error("Cette adresse ne fait pas partie de votre espace.");
  }
}

export interface EtablissementPayload {
  addressId: string;
  businessName: string;
  phone: string | null;
  description: string | null;
  category: string | null;
  openingHours: Record<string, string> | null;
  coverBase64: string | null;
  photosBase64: string[];
}

export async function creerEtablissement(userId: string, input: EtablissementPayload) {
  await verifierAdresseGerable(userId, input.addressId);

  const { data: existant } = await supabaseAdmin
    .from("establishments")
    .select("id")
    .eq("address_id", input.addressId)
    .maybeSingle();
  if (existant) throw new Error("Cette adresse possède déjà une fiche établissement.");

  const coverUrl = input.coverBase64
    ? await televerserPhoto(userId, input.coverBase64, "cover")
    : null;

  const { data: etablissement, error } = await supabaseAdmin
    .from("establishments")
    .insert({
      address_id: input.addressId,
      business_name: input.businessName.trim(),
      phone: input.phone?.trim() || null,
      description: input.description?.trim() || null,
      opening_hours: input.openingHours,
      cover_url: coverUrl,
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);

  if (input.category) {
    await supabaseAdmin
      .from("addresses")
      .update({ category: input.category })
      .eq("id", input.addressId);
  }

  await ajouterPhotos(userId, etablissement.id as string, input.photosBase64);
  return { id: etablissement.id as string };
}

export async function majEtablissement(
  userId: string,
  input: EtablissementPayload & { id: string },
) {
  const fiche = await chargerEtablissement(userId, input.id);
  if (!fiche) throw new Error("Fiche introuvable ou hors de votre espace.");

  const coverUrl = input.coverBase64
    ? await televerserPhoto(userId, input.coverBase64, "cover")
    : fiche.cover_url;

  const { error } = await supabaseAdmin
    .from("establishments")
    .update({
      business_name: input.businessName.trim(),
      phone: input.phone?.trim() || null,
      description: input.description?.trim() || null,
      opening_hours: input.openingHours,
      cover_url: coverUrl,
    })
    .eq("id", input.id);
  if (error) throw new Error(error.message);

  if (input.category) {
    await supabaseAdmin
      .from("addresses")
      .update({ category: input.category })
      .eq("id", fiche.address_id);
  }

  if (input.photosBase64.length) {
    await ajouterPhotos(userId, input.id, input.photosBase64);
  }
  return { success: true };
}

export async function ajouterPhotos(userId: string, establishmentId: string, images: string[]) {
  if (!images.length) return { success: true };
  const fiche = await chargerEtablissement(userId, establishmentId);
  if (!fiche) throw new Error("Fiche introuvable ou hors de votre espace.");

  const restant = Math.max(0, 8 - fiche.photos.length);
  const aTraiter = images.slice(0, restant);
  let ordre = fiche.photos.length;

  for (const image of aTraiter) {
    const url = await televerserPhoto(userId, image, `photo-${ordre}`);
    await supabaseAdmin
      .from("establishment_photos")
      .insert({ establishment_id: establishmentId, url, order: ordre });
    ordre += 1;
  }
  return { success: true, added: aTraiter.length };
}

export async function reordonnerPhotos(userId: string, establishmentId: string, ids: string[]) {
  const fiche = await chargerEtablissement(userId, establishmentId);
  if (!fiche) throw new Error("Fiche introuvable ou hors de votre espace.");
  for (let i = 0; i < ids.length; i += 1) {
    await supabaseAdmin
      .from("establishment_photos")
      .update({ order: i })
      .eq("id", ids[i]!)
      .eq("establishment_id", establishmentId);
  }
  return { success: true };
}

export async function supprimerPhoto(userId: string, establishmentId: string, photoId: string) {
  const fiche = await chargerEtablissement(userId, establishmentId);
  if (!fiche) throw new Error("Fiche introuvable ou hors de votre espace.");
  const { error } = await supabaseAdmin
    .from("establishment_photos")
    .delete()
    .eq("id", photoId)
    .eq("establishment_id", establishmentId);
  if (error) throw new Error(error.message);
  return { success: true };
}

/* ------------------------------ STATISTIQUES ------------------------------ */

export async function chargerStatsEtablissement(
  userId: string,
  establishmentId: string,
  jours = 90,
): Promise<ProStats> {
  const fiche = await chargerEtablissement(userId, establishmentId);
  if (!fiche) throw new Error("Fiche introuvable ou hors de votre espace.");

  const { data: adresse } = await supabaseAdmin
    .from("addresses")
    .select("beacon_id")
    .eq("id", fiche.address_id)
    .maybeSingle();
  const beaconId = adresse?.beacon_id;

  const vide: ProStats = {
    searchesByDay: [],
    routesByProvider: [],
    conversion: 0,
    heatmap: Array.from({ length: 24 }, (_, hour) => ({ hour, count: 0 })),
    totalSearches: 0,
    totalRoutes: 0,
  };
  if (!beaconId) return vide;

  const depuis = ilYaJours(jours);
  const [{ data: recherches }, { data: itineraires }] = await Promise.all([
    supabaseAdmin
      .from("search_logs")
      .select("created_at")
      .eq("beacon_id_found", beaconId)
      .gte("created_at", depuis),
    supabaseAdmin
      .from("route_logs")
      .select("provider, launched_at")
      .eq("beacon_id", beaconId)
      .gte("launched_at", depuis),
  ]);

  const parJour = new Map<string, number>();
  for (let i = jours - 1; i >= 0; i -= 1) {
    parJour.set(new Date(Date.now() - i * JOUR_MS).toISOString().slice(0, 10), 0);
  }
  const heures = new Map<number, number>();
  for (let h = 0; h < 24; h += 1) heures.set(h, 0);

  for (const r of recherches ?? []) {
    const jour = (r.created_at as string).slice(0, 10);
    if (parJour.has(jour)) parJour.set(jour, (parJour.get(jour) ?? 0) + 1);
    const heure = new Date(r.created_at as string).getUTCHours();
    heures.set(heure, (heures.get(heure) ?? 0) + 1);
  }

  const parProvider = new Map<string, number>();
  for (const i of itineraires ?? []) {
    const p = (i.provider as string) ?? "autre";
    parProvider.set(p, (parProvider.get(p) ?? 0) + 1);
  }

  const totalSearches = recherches?.length ?? 0;
  const totalRoutes = itineraires?.length ?? 0;

  return {
    searchesByDay: [...parJour.entries()].map(([day, count]) => ({ day, count })),
    routesByProvider: [...parProvider.entries()].map(([provider, count]) => ({ provider, count })),
    conversion: totalSearches ? Math.round((totalRoutes / totalSearches) * 1000) / 10 : 0,
    heatmap: [...heures.entries()].map(([hour, count]) => ({ hour, count })),
    totalSearches,
    totalRoutes,
  };
}

export async function chargerDashboardPro(userId: string) {
  const etablissements = await chargerEtablissements(userId);
  const adresseIds = etablissements.map((e) => e.address_id);

  let searches30d = 0;
  let routes30d = 0;

  if (adresseIds.length) {
    const { data: adresses } = await supabaseAdmin
      .from("addresses")
      .select("beacon_id")
      .in("id", adresseIds);
    const beaconIds = (adresses ?? []).map((a) => a.beacon_id).filter(Boolean) as string[];

    if (beaconIds.length) {
      const [{ count: cr }, { count: ci }] = await Promise.all([
        supabaseAdmin
          .from("search_logs")
          .select("id", { count: "exact", head: true })
          .in("beacon_id_found", beaconIds)
          .gte("created_at", ilYaJours(30)),
        supabaseAdmin
          .from("route_logs")
          .select("id", { count: "exact", head: true })
          .in("beacon_id", beaconIds)
          .gte("launched_at", ilYaJours(30)),
      ]);
      searches30d = cr ?? 0;
      routes30d = ci ?? 0;
    }
  }

  return {
    establishmentCount: etablissements.length,
    searches30d,
    routes30d,
    conversion: searches30d ? Math.round((routes30d / searches30d) * 1000) / 10 : 0,
    averageRating: null as number | null,
  };
}

/* -------------------------------- ÉQUIPE -------------------------------- */

export async function chargerEquipe(userId: string) {
  const business = await chargerMonBusiness(userId);
  if (!business) return { business: null, members: [] as any[] };

  const { data, error } = await supabaseAdmin
    .from("team_members")
    .select("id, role, invited_at, joined_at, member_id, profiles(full_name, phone)")
    .eq("business_id", business.id)
    .order("invited_at");
  if (error) throw new Error(error.message);

  const { data: comptes } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  const emails = new Map(comptes?.users.map((u) => [u.id, u.email ?? null]) ?? []);

  return {
    business,
    members: (data ?? []).map((m: any) => ({
      id: m.id,
      member_id: m.member_id,
      role: m.role,
      invited_at: m.invited_at,
      joined_at: m.joined_at ?? null,
      full_name: m.profiles?.full_name ?? null,
      email: emails.get(m.member_id) ?? null,
      is_me: m.member_id === userId,
    })),
  };
}

async function exigerProprietaire(userId: string) {
  const business = await chargerMonBusiness(userId);
  if (!business || business.owner_id !== userId) {
    throw new Error("Action réservée au propriétaire de l'espace professionnel.");
  }
  return business;
}

export async function inviterMembre(userId: string, email: string, role: string) {
  const business = await exigerProprietaire(userId);
  const cible = email.trim().toLowerCase();

  const { data: comptes } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  const existant = comptes?.users.find((u) => (u.email ?? "").toLowerCase() === cible);

  if (existant) {
    const { error } = await supabaseAdmin.from("team_members").insert({
      business_id: business.id,
      member_id: existant.id,
      role,
      joined_at: new Date().toISOString(),
    });
    if (error) throw new Error(error.message);

    await supabaseAdmin.from("notifications").insert({
      user_id: existant.id,
      type: "team_invite",
      payload: { business_id: business.id, business_name: business.trade_name, role },
    });
    return { invited: true, mode: "direct" as const };
  }

  const { data: invite, error } = await supabaseAdmin.auth.admin.inviteUserByEmail(cible);
  if (error) throw new Error("Invitation impossible : " + error.message);

  if (invite?.user) {
    await supabaseAdmin
      .from("team_members")
      .insert({ business_id: business.id, member_id: invite.user.id, role });
  }
  return { invited: true, mode: "email" as const };
}

export async function majRoleMembre(userId: string, memberRowId: string, role: string) {
  const business = await exigerProprietaire(userId);
  const { error } = await supabaseAdmin
    .from("team_members")
    .update({ role })
    .eq("id", memberRowId)
    .eq("business_id", business.id);
  if (error) throw new Error(error.message);
  return { success: true };
}

export async function retirerMembre(userId: string, memberRowId: string) {
  const business = await exigerProprietaire(userId);
  const { data: ligne } = await supabaseAdmin
    .from("team_members")
    .select("member_id")
    .eq("id", memberRowId)
    .eq("business_id", business.id)
    .maybeSingle();
  if (ligne?.member_id === business.owner_id) {
    throw new Error("Le propriétaire ne peut pas être retiré de l'équipe.");
  }
  const { error } = await supabaseAdmin
    .from("team_members")
    .delete()
    .eq("id", memberRowId)
    .eq("business_id", business.id);
  if (error) throw new Error(error.message);
  return { success: true };
}

/* ------------------------------ FACTURATION ------------------------------ */

async function creerCommande(userId: string, planCode: string, montant: number) {
  const { data, error } = await supabaseAdmin
    .from("orders")
    .insert({
      customer_id: userId,
      offer_code: planCode,
      amount_gnf: montant,
      status: "pending",
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  return data;
}

export async function chargerFacturation(userId: string) {
  const business = await chargerMonBusiness(userId);

  const { data: commandes } = await supabaseAdmin
    .from("orders")
    .select("id, offer_code, amount_gnf, status, created_at, invoices(id, number, pdf_url, issued_at)")
    .eq("customer_id", userId)
    .order("created_at", { ascending: false });

  const { data: abonnements } = await supabaseAdmin
    .from("subscriptions")
    .select("id, plan_code, start_date, end_date, status, price_gnf")
    .eq("customer_id", userId)
    .order("start_date", { ascending: false });

  return {
    business,
    orders: (commandes ?? []).map((o: any) => ({
      id: o.id,
      offer_code: o.offer_code,
      amount_gnf: o.amount_gnf,
      status: o.status,
      created_at: o.created_at,
      invoices: o.invoices ?? [],
    })),
    subscriptions: abonnements ?? [],
  };
}

export async function changerOffre(userId: string, planCode: string) {
  const business = await exigerProprietaire(userId);
  const offre = PLANS.find((p) => p.code === planCode);
  if (!offre) throw new Error("Offre inconnue.");

  const commande = await creerCommande(userId, planCode, offre.monthlyGnf);

  const debut = new Date();
  const fin = new Date(debut.getTime() + 30 * JOUR_MS);
  await supabaseAdmin.from("subscriptions").insert({
    customer_id: userId,
    plan_code: planCode,
    start_date: debut.toISOString().slice(0, 10),
    end_date: fin.toISOString().slice(0, 10),
    status: "pending",
    price_gnf: offre.monthlyGnf,
  });

  await supabaseAdmin
    .from("business_profiles")
    .update({
      plan_code: planCode,
      plan_started_at: debut.toISOString(),
      plan_ends_at: fin.toISOString(),
    })
    .eq("id", business.id);

  return { orderId: commande.id as string };
}

/* -------------------------------- CLÉS API -------------------------------- */

async function organisationDeUtilisateur(userId: string) {
  const business = await exigerProprietaire(userId);
  const { data: existante } = await supabaseAdmin
    .from("organizations")
    .select("id")
    .eq("contact_id", userId)
    .maybeSingle();
  if (existante) return existante.id as string;

  const { data, error } = await supabaseAdmin
    .from("organizations")
    .insert({ name: business.trade_name, type: "business", contact_id: userId })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  return data.id as string;
}

function genererCle(): string {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  const octets = new Uint8Array(48);
  crypto.getRandomValues(octets);
  let corps = "";
  for (const o of octets) corps += alphabet[o % alphabet.length];
  return `adr_live_${corps}`;
}

export async function creerCleApi(userId: string) {
  const orgId = await organisationDeUtilisateur(userId);
  const cle = genererCle();
  const hash = await bcrypt.hash(cle, 10);

  const { data, error } = await supabaseAdmin
    .from("api_keys")
    .insert({
      org_id: orgId,
      key_hash: hash,
      scopes: ["search:read"],
      quota_month: 10_000,
      active: true,
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);

  // On stocke le préfixe lisible dans un enregistrement d'audit pour l'affichage.
  await supabaseAdmin.from("audit_logs").insert({
    actor_id: userId,
    action: "api_key_created",
    entity: "api_keys",
    entity_id: data.id,
    after: { prefix: cle.slice(0, 17) },
  });

  return { id: data.id as string, key: cle, prefix: cle.slice(0, 17) };
}

export async function chargerClesApi(userId: string): Promise<ApiKeyRow[]> {
  const business = await chargerMonBusiness(userId);
  if (!business || business.owner_id !== userId) return [];

  const { data: org } = await supabaseAdmin
    .from("organizations")
    .select("id")
    .eq("contact_id", userId)
    .maybeSingle();
  if (!org) return [];

  const { data: cles, error } = await supabaseAdmin
    .from("api_keys")
    .select("id, scopes, quota_month, active, created_at")
    .eq("org_id", org.id)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  if (!cles?.length) return [];

  const debutMois = new Date();
  debutMois.setUTCDate(1);
  debutMois.setUTCHours(0, 0, 0, 0);

  const { data: prefixes } = await supabaseAdmin
    .from("audit_logs")
    .select("entity_id, after")
    .eq("action", "api_key_created")
    .in("entity_id", cles.map((c) => c.id));
  const parId = new Map(
    (prefixes ?? []).map((p: any) => [p.entity_id as string, (p.after?.prefix as string) ?? null]),
  );

  const resultats: ApiKeyRow[] = [];
  for (const c of cles) {
    const { count } = await supabaseAdmin
      .from("api_usage")
      .select("id", { count: "exact", head: true })
      .eq("key_id", c.id)
      .gte("ts", debutMois.toISOString());
    resultats.push({
      id: c.id as string,
      prefix: parId.get(c.id as string) ?? "adr_live_••••",
      scopes: (c.scopes as string[] | null) ?? null,
      quota_month: c.quota_month ?? null,
      active: !!c.active,
      created_at: c.created_at as string,
      usage_month: count ?? 0,
    });
  }
  return resultats;
}

export async function revoquerCleApi(userId: string, keyId: string) {
  const { data: org } = await supabaseAdmin
    .from("organizations")
    .select("id")
    .eq("contact_id", userId)
    .maybeSingle();
  if (!org) throw new Error("Aucune organisation associée.");

  const { error } = await supabaseAdmin
    .from("api_keys")
    .update({ active: false })
    .eq("id", keyId)
    .eq("org_id", org.id);
  if (error) throw new Error(error.message);
  return { success: true };
}
