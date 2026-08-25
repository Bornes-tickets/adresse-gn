/**
 * src/lib/orders.server.ts
 * Logique serveur des commandes. Ce fichier n'est jamais bundlé côté client.
 */
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type { OrderInput, OrderResult } from "@/lib/orders.functions";

// ⚙️ Numéro WhatsApp du service qui reçoit les nouvelles commandes
const SERVICE_WHATSAPP = "224620000000"; // sans +, format international
// ⚙️ URL publique du site (Netlify)
const BASE_URL = "https://adresse-gn.netlify.app";

/**
 * Formate un montant en GNF avec séparateurs de milliers.
 */
function formatGNF(n: number): string {
  return new Intl.NumberFormat("fr-FR").format(n) + " GNF";
}

/**
 * Génère un message WhatsApp pré-rempli résumant la commande.
 * L'utilisateur (ou le service) peut cliquer envoyer.
 */
function buildWhatsAppMessage(
  order: OrderInput,
  guest_token: string,
): string {
  const trackingUrl = `${BASE_URL}/suivi/${guest_token}`;
  const lines = [
    `🆕 *Nouvelle commande Adresse GN*`,
    ``,
    `👤 ${order.full_name} (${order.client_type})`,
    `📞 ${order.phone}`,
    order.email ? `✉️ ${order.email}` : null,
    ``,
    `📍 *Adresse à créer* :`,
    `${order.address_line}`,
    order.quartier ? `Quartier : ${order.quartier}` : null,
    `Ville : ${order.city ?? "Conakry"}`,
    order.notes ? `\nNotes : ${order.notes}` : null,
    ``,
    `💼 *Formule* : ${order.formule_label}`,
    order.devis_demande
      ? `💰 Devis demandé`
      : `💰 Prix : ${formatGNF(order.prix_ttc)}`,
    `💳 Paiement : ${order.payment_method}`,
    ``,
    `🔗 Suivi : ${trackingUrl}`,
  ]
    .filter(Boolean)
    .join("\n");
  return lines;
}

/**
 * Crée une commande + retourne le lien de suivi et le lien WhatsApp.
 * Pas de compte requis. Un token unique est stocké dans localStorage
 * côté client pour retrouver ses commandes.
 */
export async function createServerOrder(
  input: OrderInput,
): Promise<OrderResult> {
  const { data, error } = await supabaseAdmin
    .from("orders")
    .insert({
      client_type: input.client_type,
      full_name: input.full_name,
      phone: input.phone,
      email: input.email,
      address_line: input.address_line,
      quartier: input.quartier,
      city: input.city,
      notes: input.notes,
      raison_sociale: input.raison_sociale,
      fonction: input.fonction,
      rccm: input.rccm,
      nif: input.nif,
      site_web: input.site_web,
      nb_adresses: input.nb_adresses,
      devis_demande: input.devis_demande,
      formule_code: input.formule_code,
      formule_label: input.formule_label,
      prix_ttc: input.prix_ttc,
      payment_method: input.payment_method,
      status: "pending",
    })
    .select("id, guest_token, status")
    .single();

  if (error || !data) {
    console.error("[createServerOrder] Supabase error:", error);
    throw new Error(`Création commande impossible : ${error?.message ?? "unknown"}`);
  }

  const trackingUrl = `${BASE_URL}/suivi/${data.guest_token}`;
  const message = buildWhatsAppMessage(input, data.guest_token);
  const whatsappUrl = `https://wa.me/${SERVICE_WHATSAPP}?text=${encodeURIComponent(message)}`;

  // 🔔 TODO : plus tard, envoi automatique via Twilio WhatsApp Business API :
  //   await sendWhatsAppMessage(SERVICE_WHATSAPP, message);
  //   await sendWhatsAppMessage(input.phone, `Merci ! Suivi : ${trackingUrl}`);

  return {
    id: data.id,
    guest_token: data.guest_token,
    status: data.status,
    tracking_url: trackingUrl,
    whatsapp_url: whatsappUrl,
  };
}

/**
 * Récupère une commande par son token (page publique de suivi).
 */
export async function fetchOrderByToken(token: string) {
  const { data, error } = await supabaseAdmin
    .from("orders")
    .select(
      `
      id, guest_token, status, client_type, full_name, phone, email,
      address_line, quartier, city, notes,
      formule_code, formule_label, prix_ttc, payment_method,
      created_at, confirmed_at, installed_at,
      beacon_id
    `,
    )
    .eq("guest_token", token)
    .maybeSingle();

  if (error) {
    console.error("[fetchOrderByToken]", error);
    return null;
  }
  return data;
}
