/**
 * Coeur métier du paiement (§8 et §9) : commandes, intentions de paiement,
 * confirmation manuelle par l'administration, activation post-paiement,
 * factures PDF et facturation récurrente.
 * Serveur uniquement (*.server.ts exclu des bundles navigateur).
 */
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { genererPdfFacture } from "@/lib/invoice-pdf.server";
import {
  buildOrderItems,
  getOffer,
  itemsTotal,
  type OrderItem,
} from "@/lib/pricing";
import { getProvider } from "@/server/payment";
import type { PaymentAction } from "@/server/payment/provider";

/** Les nouvelles colonnes peuvent précéder la régénération des types. */
const db = supabaseAdmin as any;
const JOUR_MS = 86_400_000;

/* ------------------------------------------------------------------ */
/* Journal d'audit                                                     */
/* ------------------------------------------------------------------ */

async function auditer(
  actorId: string | null,
  action: string,
  entity: string,
  entityId: string | null,
  after: unknown,
) {
  await db.from("audit_logs").insert({
    actor_id: actorId,
    action,
    entity,
    entity_id: entityId,
    after: after as never,
  });
}

async function notifier(userId: string | null, type: string, payload: unknown) {
  if (!userId) return;
  await db.from("notifications").insert({ user_id: userId, type, payload: payload as never });
}

/* ------------------------------------------------------------------ */
/* Commandes                                                           */
/* ------------------------------------------------------------------ */

export interface OrderView {
  id: string;
  order_ref: string;
  offer_code: string;
  amount_gnf: number;
  status: string;
  created_at: string;
  items: OrderItem[];
  beacon_id: string | null;
  business_id: string | null;
  invoice?: { number: string; pdf_url: string | null; status: string } | null;
  payment?: {
    id: string;
    provider: string | null;
    status: string;
    external_ref: string | null;
  } | null;
}

export async function creerCommande(
  userId: string,
  input: { offerCode: string; businessId?: string | null; beaconId?: string | null },
): Promise<{ orderRef: string }> {
  const offre = getOffer(input.offerCode);
  if (!offre) throw new Error("Offre inconnue.");
  if (offre.quoteOnly) {
    throw new Error("Cette offre est sur devis : contactez notre équipe commerciale.");
  }

  const items = buildOrderItems(offre);
  const montant = itemsTotal(items);

  if (input.businessId) {
    const { data: business } = await db
      .from("business_profiles")
      .select("id, owner_id")
      .eq("id", input.businessId)
      .maybeSingle();
    if (!business || business.owner_id !== userId) {
      throw new Error("Entreprise introuvable ou non autorisée.");
    }
  }

  const { data, error } = await db
    .from("orders")
    .insert({
      customer_id: userId,
      offer_code: offre.code,
      amount_gnf: montant,
      status: "pending",
      items: items as never,
      business_id: input.businessId ?? null,
      beacon_id: input.beaconId ?? null,
    })
    .select("id, order_ref")
    .single();

  if (error) throw new Error(error.message);
  await auditer(userId, "order.create", "orders", data.id, {
    order_ref: data.order_ref,
    amount_gnf: montant,
  });
  return { orderRef: data.order_ref };
}

async function chargerCommandeBrute(orderRef: string) {
  const { data, error } = await db
    .from("orders")
    .select(
      "id, order_ref, offer_code, amount_gnf, status, created_at, items, beacon_id, business_id, subscription_id, customer_id, notes",
    )
    .eq("order_ref", orderRef)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

export async function chargerCommande(userId: string, orderRef: string): Promise<OrderView> {
  const commande = await chargerCommandeBrute(orderRef);
  if (!commande || commande.customer_id !== userId) {
    throw new Error("Commande introuvable.");
  }

  const { data: paiements } = await db
    .from("payments")
    .select("id, provider, status, external_ref")
    .eq("order_id", commande.id)
    .order("id", { ascending: false })
    .limit(1);

  const { data: factures } = await db
    .from("invoices")
    .select("number, pdf_url, status")
    .eq("order_id", commande.id)
    .limit(1);

  return {
    id: commande.id,
    order_ref: commande.order_ref,
    offer_code: commande.offer_code,
    amount_gnf: commande.amount_gnf,
    status: commande.status,
    created_at: commande.created_at,
    items: (commande.items ?? []) as OrderItem[],
    beacon_id: commande.beacon_id,
    business_id: commande.business_id,
    payment: paiements?.[0] ?? null,
    invoice: factures?.[0] ?? null,
  };
}

export async function listerMesCommandes(userId: string): Promise<OrderView[]> {
  const { data, error } = await db
    .from("orders")
    .select("id, order_ref, offer_code, amount_gnf, status, created_at, items, beacon_id, business_id")
    .eq("customer_id", userId)
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) throw new Error(error.message);
  const commandes = data ?? [];
  if (!commandes.length) return [];

  const ids = commandes.map((c: any) => c.id);
  const { data: factures } = await db
    .from("invoices")
    .select("order_id, number, pdf_url, status")
    .in("order_id", ids);
  const { data: paiements } = await db
    .from("payments")
    .select("id, order_id, provider, status, external_ref")
    .in("order_id", ids);

  return commandes.map((c: any) => ({
    ...c,
    items: (c.items ?? []) as OrderItem[],
    invoice: factures?.find((f: any) => f.order_id === c.id) ?? null,
    payment: paiements?.find((p: any) => p.order_id === c.id) ?? null,
  }));
}

/* ------------------------------------------------------------------ */
/* Intention de paiement                                               */
/* ------------------------------------------------------------------ */

export async function initierPaiement(
  userId: string,
  orderRef: string,
  providerCode: string,
): Promise<{ action: PaymentAction; paymentId: string }> {
  const commande = await chargerCommandeBrute(orderRef);
  if (!commande || commande.customer_id !== userId) throw new Error("Commande introuvable.");
  if (commande.status === "paid") throw new Error("Cette commande est déjà payée.");

  const provider = getProvider(providerCode);

  const { data: profil } = await db
    .from("profiles")
    .select("phone")
    .eq("id", userId)
    .maybeSingle();

  const intention = await provider.createIntent({
    id: commande.id,
    order_ref: commande.order_ref,
    amount_gnf: commande.amount_gnf,
    offer_code: commande.offer_code,
    customer_id: commande.customer_id,
    customer_phone: profil?.phone ?? null,
  });

  const { data: paiement, error } = await db
    .from("payments")
    .insert({
      order_id: commande.id,
      provider: provider.code,
      amount_gnf: commande.amount_gnf,
      status: "pending",
      intent_id: intention.intent_id,
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);

  await auditer(userId, "payment.intent", "payments", paiement.id, {
    provider: provider.code,
    order_ref: commande.order_ref,
  });

  return { action: intention.action, paymentId: paiement.id };
}

export async function statutCommande(
  userId: string,
  orderRef: string,
): Promise<{ orderStatus: string; paymentStatus: string | null; invoiceUrl: string | null }> {
  const commande = await chargerCommande(userId, orderRef);
  return {
    orderStatus: commande.status,
    paymentStatus: commande.payment?.status ?? null,
    invoiceUrl: commande.invoice?.pdf_url ?? null,
  };
}

/* ------------------------------------------------------------------ */
/* Administration des paiements                                        */
/* ------------------------------------------------------------------ */

export interface AdminPaymentRow {
  id: string;
  provider: string | null;
  status: string;
  amount_gnf: number;
  external_ref: string | null;
  paid_at: string | null;
  order_ref: string;
  offer_code: string;
  order_status: string;
  created_at: string | null;
  client: string;
  client_phone: string | null;
  notes: string | null;
}

export async function listerPaiements(filtre: {
  statut?: string;
  page?: number;
  pageSize?: number;
}): Promise<{ total: number; page: number; pageSize: number; lignes: AdminPaymentRow[] }> {

  const page = Math.max(1, filtre.page ?? 1);
  const pageSize = Math.min(100, filtre.pageSize ?? 25);
  let requete = db
    .from("payments")
    .select(
      "id, provider, status, amount_gnf, external_ref, intent_id, paid_at, confirmed_at, order_id, orders(order_ref, offer_code, status, created_at, customer_id, notes)",
      { count: "exact" },
    )
    .order("id", { ascending: false })
    .range((page - 1) * pageSize, page * pageSize - 1);

  if (filtre.statut && filtre.statut !== "all") requete = requete.eq("status", filtre.statut);

  const { data, error, count } = await requete;
  if (error) throw new Error(error.message);

  const clientIds = [
    ...new Set((data ?? []).map((p: any) => p.orders?.customer_id).filter(Boolean)),
  ];
  const { data: profils } = clientIds.length
    ? await db.from("profiles").select("id, full_name, phone").in("id", clientIds)
    : { data: [] as any[] };

  return {
    total: count ?? 0,
    page,
    pageSize,
    lignes: (data ?? []).map((p: any) => {
      const profil = profils?.find((u: any) => u.id === p.orders?.customer_id);
      return {
        id: p.id,
        provider: p.provider,
        status: p.status,
        amount_gnf: p.amount_gnf,
        external_ref: p.external_ref,
        paid_at: p.paid_at,
        order_ref: p.orders?.order_ref ?? "—",
        offer_code: p.orders?.offer_code ?? "—",
        order_status: p.orders?.status ?? "—",
        created_at: p.orders?.created_at ?? null,
        client: profil?.full_name ?? "Client",
        client_phone: profil?.phone ?? null,
        notes: p.orders?.notes ?? null,
      };
    }),
  };
}

export async function confirmerPaiementManuel(
  adminId: string,
  input: { paymentId: string; externalRef: string; note?: string | null },
) {
  const { data: paiement, error } = await db
    .from("payments")
    .select("id, order_id, provider, status")
    .eq("id", input.paymentId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!paiement) throw new Error("Paiement introuvable.");
  if (paiement.status !== "pending") throw new Error("Ce paiement n'est plus en attente.");
  if (paiement.provider !== "manual") {
    throw new Error("Seuls les paiements manuels se confirment à la main.");
  }

  const maintenant = new Date().toISOString();
  await db
    .from("payments")
    .update({
      status: "success",
      external_ref: input.externalRef,
      confirmed_by: adminId,
      confirmed_at: maintenant,
      paid_at: maintenant,
    })
    .eq("id", paiement.id);

  await db
    .from("orders")
    .update({ status: "paid", notes: input.note ?? null })
    .eq("id", paiement.order_id);

  const resultat = await postPaymentActivation(paiement.order_id);

  await auditer(adminId, "payment.confirm_manual", "payments", paiement.id, {
    external_ref: input.externalRef,
    note: input.note ?? null,
    activation: resultat,
  });

  return resultat;
}

export async function rejeterPaiement(
  adminId: string,
  input: { paymentId: string; motif: string },
) {
  const { data: paiement } = await db
    .from("payments")
    .select("id, order_id, status")
    .eq("id", input.paymentId)
    .maybeSingle();
  if (!paiement) throw new Error("Paiement introuvable.");
  if (paiement.status !== "pending") throw new Error("Ce paiement n'est plus en attente.");

  await db.from("payments").update({ status: "failed" }).eq("id", paiement.id);
  await db
    .from("orders")
    .update({ status: "cancelled", notes: input.motif })
    .eq("id", paiement.order_id);

  const { data: commande } = await db
    .from("orders")
    .select("customer_id, order_ref")
    .eq("id", paiement.order_id)
    .maybeSingle();

  await notifier(commande?.customer_id ?? null, "payment_rejected", {
    order_ref: commande?.order_ref,
    motif: input.motif,
    message: `Votre paiement pour la commande ${commande?.order_ref} n'a pas pu être validé : ${input.motif}`,
  });

  await auditer(adminId, "payment.reject", "payments", paiement.id, { motif: input.motif });
  return { ok: true };
}

/* ------------------------------------------------------------------ */
/* Activation post-paiement                                            */
/* ------------------------------------------------------------------ */

export async function postPaymentActivation(orderId: string) {
  const { data: commande } = await db
    .from("orders")
    .select(
      "id, order_ref, offer_code, amount_gnf, items, beacon_id, business_id, subscription_id, customer_id",
    )
    .eq("id", orderId)
    .maybeSingle();
  if (!commande) throw new Error("Commande introuvable.");

  const items = (commande.items ?? []) as OrderItem[];
  const effets: string[] = [];

  const { data: profil } = await db
    .from("profiles")
    .select("full_name, phone")
    .eq("id", commande.customer_id)
    .maybeSingle();

  for (const item of items) {
    if (item.kind === "beacon") {
      const { data: dejaEnAttente } = await db
        .from("pending_installations")
        .select("id")
        .eq("order_id", commande.id)
        .maybeSingle();
      if (!dejaEnAttente) {
        await db.from("pending_installations").insert({
          beacon_id: commande.beacon_id ?? null,
          order_id: commande.id,
          customer_id: commande.customer_id,
          phone: profil?.phone ?? null,
          note: `Offre ${commande.offer_code} — commande ${commande.order_ref}`,
          status: "pending",
        });
        effets.push("demande d'installation créée");
      }
      if (commande.beacon_id) {
        const { data: balise } = await db
          .from("beacons")
          .select("id, status")
          .eq("id", commande.beacon_id)
          .maybeSingle();
        if (balise && (balise.status === "generated" || balise.status === "assigned")) {
          await db.from("beacons").update({ status: "assigned" }).eq("id", balise.id);
          effets.push("balise réservée");
        }
      }
    }

    if (item.kind === "activation" || item.kind === "subscription") {
      await prolongerAbonnement(commande, item);
      effets.push("abonnement activé");
    }

    if (item.kind === "api") {
      if (commande.business_id) {
        const { data: orgs } = await db
          .from("api_keys")
          .select("id, quota_month")
          .eq("org_id", commande.business_id);
        for (const cle of orgs ?? []) {
          await db.from("api_keys").update({ active: true }).eq("id", cle.id);
        }
        effets.push("clés API réactivées");
      }
    }
  }

  const facture = await genererFacture(commande, items, profil);
  effets.push(`facture ${facture.number}`);

  await notifier(commande.customer_id, "payment_confirmed", {
    order_ref: commande.order_ref,
    invoice_number: facture.number,
    invoice_url: facture.pdf_url,
    message: "Votre paiement a été confirmé, voici votre facture.",
  });

  return { effets, invoice: facture };
}

async function prolongerAbonnement(commande: any, item: OrderItem) {
  const offre = getOffer(commande.offer_code);
  const prix = offre?.monthly_gnf ?? item.unit_price_gnf;

  const { data: existant } = await db
    .from("subscriptions")
    .select("id, end_date, status")
    .eq("customer_id", commande.customer_id)
    .eq("plan_code", commande.offer_code)
    .in("status", ["active", "suspended"])
    .order("end_date", { ascending: false })
    .limit(1);

  const base = existant?.[0]?.end_date
    ? new Date(Math.max(Date.parse(existant[0].end_date), Date.now()))
    : new Date();
  const fin = new Date(base.getTime() + 30 * JOUR_MS);

  if (existant?.[0]) {
    await db
      .from("subscriptions")
      .update({
        end_date: fin.toISOString().slice(0, 10),
        next_billing_date: fin.toISOString().slice(0, 10),
        status: "active",
        auto_renew: true,
      })
      .eq("id", existant[0].id);
    if (!commande.subscription_id) {
      await db.from("orders").update({ subscription_id: existant[0].id }).eq("id", commande.id);
    }
    return existant[0].id as string;
  }

  const { data: cree } = await db
    .from("subscriptions")
    .insert({
      customer_id: commande.customer_id,
      plan_code: commande.offer_code,
      start_date: new Date().toISOString().slice(0, 10),
      end_date: fin.toISOString().slice(0, 10),
      next_billing_date: fin.toISOString().slice(0, 10),
      status: "active",
      price_gnf: prix,
      auto_renew: true,
    })
    .select("id")
    .single();

  if (commande.business_id) {
    await db
      .from("business_profiles")
      .update({
        plan_code: commande.offer_code,
        plan_started_at: new Date().toISOString(),
        plan_ends_at: fin.toISOString(),
      })
      .eq("id", commande.business_id);
  }

  if (cree?.id) {
    await db.from("orders").update({ subscription_id: cree.id }).eq("id", commande.id);
  }
  return cree?.id as string;
}

async function genererFacture(commande: any, items: OrderItem[], profil: any) {
  const { data: deja } = await db
    .from("invoices")
    .select("id, number, pdf_url, status")
    .eq("order_id", commande.id)
    .maybeSingle();
  if (deja?.pdf_url) return deja;

  const jour = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const { count: dejaEmises } = await db
    .from("invoices")
    .select("id", { count: "exact", head: true })
    .like("number", `INV-${jour}-%`);
  const numero = `INV-${jour}-${String((dejaEmises ?? 0) + 1).padStart(4, "0")}`;

  const emisLe = new Date().toISOString();

  const { data: utilisateur } = await supabaseAdmin.auth.admin.getUserById(
    commande.customer_id,
  );

  const pdf = await genererPdfFacture({
    number: numero,
    issuedAt: emisLe,
    orderRef: commande.order_ref,
    clientName: profil?.full_name ?? "Client Adresse GN",
    clientPhone: profil?.phone ?? null,
    clientEmail: utilisateur?.user?.email ?? null,
    items,
    totalGnf: commande.amount_gnf,
  });

  const chemin = `${commande.customer_id}/${numero}.pdf`;
  const { error: erreurUpload } = await supabaseAdmin.storage
    .from("invoices")
    .upload(chemin, pdf, { contentType: "application/pdf", upsert: true });
  if (erreurUpload) throw new Error(`Envoi de la facture impossible : ${erreurUpload.message}`);

  const { data: signe } = await supabaseAdmin.storage
    .from("invoices")
    .createSignedUrl(chemin, 60 * 60 * 24 * 365);

  const ligne = {
    order_id: commande.id,
    number: numero,
    amount_gnf: commande.amount_gnf,
    status: "paid",
    paid_at: emisLe,
    issued_at: emisLe,
    pdf_url: signe?.signedUrl ?? null,
  };

  if (deja?.id) {
    await db.from("invoices").update(ligne).eq("id", deja.id);
    return { ...deja, ...ligne };
  }
  const { data: cree, error } = await db
    .from("invoices")
    .insert(ligne)
    .select("id, number, pdf_url, status")
    .single();
  if (error) throw new Error(error.message);
  return cree;
}

/* ------------------------------------------------------------------ */
/* Installations à planifier                                           */
/* ------------------------------------------------------------------ */

export async function listerInstallationsEnAttente() {
  const { data, error } = await db
    .from("pending_installations")
    .select(
      "id, beacon_id, order_id, customer_id, phone, note, status, assigned_agent_id, created_at, beacons(public_number), orders(order_ref, offer_code)",
    )
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) throw new Error(error.message);

  const ids = [...new Set((data ?? []).map((l: any) => l.customer_id).filter(Boolean))];
  const { data: profils } = ids.length
    ? await db.from("profiles").select("id, full_name, phone").in("id", ids)
    : { data: [] as any[] };

  const { data: agents } = await db
    .from("agents")
    .select("id, badge_number, active, profiles(full_name)")
    .eq("active", true);

  return {
    lignes: (data ?? []).map((l: any) => ({
      id: l.id,
      status: l.status,
      created_at: l.created_at,
      note: l.note,
      phone: l.phone,
      public_number: l.beacons?.public_number ?? null,
      order_ref: l.orders?.order_ref ?? null,
      offer_code: l.orders?.offer_code ?? null,
      assigned_agent_id: l.assigned_agent_id,
      client: profils?.find((p: any) => p.id === l.customer_id)?.full_name ?? "Client",
    })),
    agents: (agents ?? []).map((a: any) => ({
      id: a.id,
      label: `${a.badge_number} — ${a.profiles?.full_name ?? "Agent"}`,
    })),
  };
}

export async function affecterInstallation(
  adminId: string,
  input: { id: string; agentId: string },
) {
  const { error } = await db
    .from("pending_installations")
    .update({ assigned_agent_id: input.agentId, status: "assigned" })
    .eq("id", input.id);
  if (error) throw new Error(error.message);
  await auditer(adminId, "pending_installation.assign", "pending_installations", input.id, input);
  return { ok: true };
}

/* ------------------------------------------------------------------ */
/* Facturation récurrente (§G)                                         */
/* ------------------------------------------------------------------ */

export async function lancerFacturationRecurrente(adminId: string | null) {
  const aujourdhui = new Date().toISOString().slice(0, 10);
  const { data: abonnements, error } = await db
    .from("subscriptions")
    .select("id, customer_id, plan_code, price_gnf, next_billing_date, end_date, status")
    .eq("auto_renew", true)
    .lte("next_billing_date", aujourdhui)
    .in("status", ["active"]);
  if (error) throw new Error(error.message);

  let crees = 0;
  for (const abo of abonnements ?? []) {
    const offre = getOffer(abo.plan_code);
    const items: OrderItem[] = [
      {
        kind: "subscription",
        ref: abo.plan_code,
        qty: 1,
        unit_price_gnf: abo.price_gnf ?? offre?.monthly_gnf ?? 0,
        label: `${offre?.label ?? abo.plan_code} — renouvellement 1 mois`,
      },
    ];

    const { data: commande } = await db
      .from("orders")
      .insert({
        customer_id: abo.customer_id,
        offer_code: abo.plan_code,
        amount_gnf: itemsTotal(items),
        status: "pending",
        items: items as never,
        subscription_id: abo.id,
      })
      .select("id, order_ref")
      .single();
    if (!commande) continue;

    await db.from("payments").insert({
      order_id: commande.id,
      provider: "manual",
      amount_gnf: itemsTotal(items),
      status: "pending",
    });

    await notifier(abo.customer_id, "subscription_due", {
      order_ref: commande.order_ref,
      message: `Votre abonnement ${offre?.label ?? abo.plan_code} arrive à échéance — règlement à effectuer.`,
    });
    crees += 1;
  }

  // Suspension des abonnements impayés depuis plus de 7 jours.
  const limite = new Date(Date.now() - 7 * JOUR_MS).toISOString().slice(0, 10);
  const { data: enRetard } = await db
    .from("subscriptions")
    .select("id, customer_id, plan_code, next_billing_date")
    .eq("auto_renew", true)
    .eq("status", "active")
    .lt("next_billing_date", limite);

  let suspendus = 0;
  for (const abo of enRetard ?? []) {
    const { data: impayees } = await db
      .from("orders")
      .select("id, status")
      .eq("subscription_id", abo.id)
      .eq("status", "pending")
      .limit(1);
    if (!impayees?.length) continue;

    await db.from("subscriptions").update({ status: "suspended" }).eq("id", abo.id);
    const { data: business } = await db
      .from("business_profiles")
      .select("id")
      .eq("owner_id", abo.customer_id)
      .maybeSingle();
    if (business) {
      const { data: etabs } = await db
        .from("establishments")
        .select("id, address_id")
        .limit(500);
      const ids = (etabs ?? []).map((e: any) => e.address_id).filter(Boolean);
      if (ids.length) {
        await db
          .from("addresses")
          .update({ visibility: "private" })
          .in("id", ids)
          .eq("owner_id", abo.customer_id);
      }
    }
    await notifier(abo.customer_id, "subscription_suspended", {
      message:
        "Votre abonnement a été suspendu faute de règlement. Votre fiche n'est plus visible publiquement.",
    });
    suspendus += 1;
  }

  await auditer(adminId, "subscriptions.run_billing", "subscriptions", null, {
    crees,
    suspendus,
  });
  return { crees, suspendus };
}

export async function listerAbonnements() {
  const { data, error } = await db
    .from("subscriptions")
    .select(
      "id, customer_id, plan_code, start_date, end_date, next_billing_date, status, price_gnf, auto_renew",
    )
    .order("end_date", { ascending: false })
    .limit(200);
  if (error) throw new Error(error.message);

  const ids = [...new Set((data ?? []).map((s: any) => s.customer_id).filter(Boolean))];
  const { data: profils } = ids.length
    ? await db.from("profiles").select("id, full_name").in("id", ids)
    : { data: [] as any[] };

  return (data ?? []).map((s: any) => ({
    ...s,
    client: profils?.find((p: any) => p.id === s.customer_id)?.full_name ?? "Client",
  }));
}

/* ------------------------------------------------------------------ */
/* Webhooks                                                            */
/* ------------------------------------------------------------------ */

export async function tracerWebhook(input: {
  provider: string;
  headers: Record<string, string>;
  payload: unknown;
  signatureValid: boolean;
  error?: string | null;
  processed?: boolean;
}) {
  const { data } = await db
    .from("payment_webhooks")
    .insert({
      provider: input.provider,
      headers: input.headers as never,
      payload: input.payload as never,
      signature_valid: input.signatureValid,
      processed: input.processed ?? false,
      error: input.error ?? null,
    })
    .select("id")
    .single();
  return data?.id as string | undefined;
}

export async function appliquerEvenementProvider(
  webhookId: string | undefined,
  providerCode: string,
  evenement: { order_ref: string; status: "success" | "failed"; ref: string; raw?: unknown },
) {
  const commande = await chargerCommandeBrute(evenement.order_ref);
  if (!commande) {
    if (webhookId) {
      await db
        .from("payment_webhooks")
        .update({ error: "Commande inconnue", processed: true })
        .eq("id", webhookId);
    }
    return { ok: false, reason: "Commande inconnue" };
  }

  const { data: paiements } = await db
    .from("payments")
    .select("id, status")
    .eq("order_id", commande.id)
    .eq("provider", providerCode)
    .order("id", { ascending: false })
    .limit(1);

  const maintenant = new Date().toISOString();
  const majPaiement = {
    status: evenement.status === "success" ? "success" : "failed",
    external_ref: evenement.ref,
    webhook_payload: (evenement.raw ?? null) as never,
    paid_at: evenement.status === "success" ? maintenant : null,
  };

  if (paiements?.[0]) {
    await db.from("payments").update(majPaiement).eq("id", paiements[0].id);
  } else {
    await db.from("payments").insert({
      order_id: commande.id,
      provider: providerCode,
      amount_gnf: commande.amount_gnf,
      ...majPaiement,
    });
  }

  if (evenement.status === "success" && commande.status !== "paid") {
    await db.from("orders").update({ status: "paid" }).eq("id", commande.id);
    await postPaymentActivation(commande.id);
  } else if (evenement.status === "failed") {
    await notifier(commande.customer_id, "payment_failed", {
      order_ref: commande.order_ref,
      message: `Le paiement de la commande ${commande.order_ref} a échoué.`,
    });
  }

  if (webhookId) {
    await db.from("payment_webhooks").update({ processed: true }).eq("id", webhookId);
  }
  return { ok: true };
}
