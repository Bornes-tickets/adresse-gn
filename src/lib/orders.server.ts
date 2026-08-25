/** Logique serveur des commandes invité (page /commander). */
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export interface NouvelleCommande {
  client_type: string;
  full_name: string;
  phone: string;
  email?: string | undefined;
  address_line: string;
  quartier: string;
  city: string;
  notes?: string | undefined;
  raison_sociale?: string | undefined;
  fonction?: string | undefined;
  rccm?: string | undefined;
  nif?: string | undefined;
  site_web?: string | undefined;
  nb_adresses: number;
  devis_demande: boolean;
  formule_code: string;
  formule_label: string;
  prix_ttc: number;
  payment_method: string;
}

function siteUrl(): string {
  return (process.env["PUBLIC_SITE_URL"] || "https://adresse-gn.lovable.app").replace(/\/$/, "");
}

function whatsappUrl(data: NouvelleCommande, orderRef: string, token: string): string {
  const numero = (process.env["WHATSAPP_CONTACT"] || "224000000000").replace(/\D/g, "");
  const lignes = [
    `Bonjour Adresse GN, nouvelle commande ${orderRef}.`,
    `Formule : ${data.formule_label} (${data.formule_code})`,
    `Nom : ${data.full_name}`,
    `Téléphone : ${data.phone}`,
    `Adresse : ${data.address_line}, ${data.quartier}, ${data.city}`,
    data.raison_sociale ? `Structure : ${data.raison_sociale}` : "",
    data.devis_demande ? "Demande de devis" : `Montant : ${data.prix_ttc} GNF`,
    `Paiement : ${data.payment_method}`,
    `Suivi : ${siteUrl()}/suivi/${token}`,
  ].filter(Boolean);
  return `https://wa.me/${numero}?text=${encodeURIComponent(lignes.join("\n"))}`;
}

export async function creerCommandeInvite(data: NouvelleCommande) {
  const { data: row, error } = await supabaseAdmin
    .from("orders")
    .insert({
      offer_code: data.formule_code,
      formule_code: data.formule_code,
      formule_label: data.formule_label,
      amount_gnf: data.devis_demande ? 0 : data.prix_ttc,
      prix_ttc: data.devis_demande ? 0 : data.prix_ttc,
      devis_demande: data.devis_demande,
      nb_adresses: data.nb_adresses,
      client_type: data.client_type,
      full_name: data.full_name,
      phone: data.phone,
      email: data.email ?? null,
      address_line: data.address_line,
      quartier: data.quartier,
      city: data.city,
      notes: data.notes ?? null,
      raison_sociale: data.raison_sociale ?? null,
      fonction: data.fonction ?? null,
      rccm: data.rccm ?? null,
      nif: data.nif ?? null,
      site_web: data.site_web ?? null,
      payment_method: data.payment_method,
      status: "pending",
      items: [{ code: data.formule_code, label: data.formule_label, qty: data.nb_adresses }],
    })
    .select("id, order_ref, guest_token, status, created_at")
    .single();

  if (error || !row) {
    console.error("[orders.server] insert error:", error);
    throw new Error(error?.message ?? "Commande non enregistrée");
  }

  return {
    order_ref: row.order_ref,
    guest_token: row.guest_token,
    tracking_url: `${siteUrl()}/suivi/${row.guest_token}`,
    whatsapp_url: whatsappUrl(data, row.order_ref, row.guest_token),
  };
}

export async function chargerCommandeInvite(token: string) {
  const { data, error } = await supabaseAdmin
    .from("orders")
    .select(
      "order_ref, status, formule_label, formule_code, amount_gnf, prix_ttc, devis_demande, nb_adresses, full_name, phone, address_line, quartier, city, payment_method, created_at, confirmed_at, installed_at",
    )
    .eq("guest_token", token)
    .maybeSingle();

  if (error) {
    console.error("[orders.server] load error:", error);
    throw new Error(error.message);
  }
  return data;
}
