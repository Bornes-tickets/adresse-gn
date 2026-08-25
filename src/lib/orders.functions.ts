/**
 * src/lib/orders.functions.ts
 * Server functions publiques : création & lecture de commandes.
 * Aucun compte requis — suivi par guest_token.
 */
import { createServerFn } from "@tanstack/react-start";

// ============================================================
// Types partagés client/serveur
// ============================================================
export type OrderInput = {
  client_type: "particulier" | "professionnel" | "institutionnel";
  full_name: string;
  phone: string;
  email?: string;
  address_line: string;
  quartier?: string;
  city?: string;
  notes?: string;

  // Pro (optionnel)
  raison_sociale?: string;
  fonction?: string;
  rccm?: string;
  nif?: string;
  site_web?: string;
  nb_adresses?: number;
  devis_demande?: boolean;

  // Formule & paiement
  formule_code: string;
  formule_label: string;
  prix_ttc: number; // en GNF
  payment_method: string;
};

export type OrderResult = {
  id: string;
  guest_token: string;
  status: string;
  tracking_url: string;
  whatsapp_url: string;
};

// ============================================================
// CRÉER UNE COMMANDE
// ============================================================
export const createOrder = createServerFn({ method: "POST" })
  .inputValidator((input: OrderInput) => {
    if (!input?.full_name?.trim()) throw new Error("Nom requis");
    if (!input?.phone?.trim()) throw new Error("Téléphone requis");
    if (!input?.address_line?.trim()) throw new Error("Adresse requise");
    if (!input?.formule_code) throw new Error("Formule requise");
    if (!input?.payment_method) throw new Error("Mode de paiement requis");

    // Nettoyage téléphone : garde uniquement chiffres + préfixe +
    const phone = input.phone.replace(/[^\d+]/g, "");

    return {
      client_type: input.client_type,
      full_name: input.full_name.trim().slice(0, 120),
      phone,
      email: input.email?.trim().toLowerCase().slice(0, 200) || null,
      address_line: input.address_line.trim().slice(0, 500),
      quartier: input.quartier?.trim().slice(0, 120) || null,
      city: input.city?.trim().slice(0, 80) || "Conakry",
      notes: input.notes?.trim().slice(0, 1000) || null,
      raison_sociale: input.raison_sociale?.trim().slice(0, 200) || null,
      fonction: input.fonction?.trim().slice(0, 120) || null,
      rccm: input.rccm?.trim().slice(0, 80) || null,
      nif: input.nif?.trim().slice(0, 80) || null,
      site_web: input.site_web?.trim().slice(0, 200) || null,
      nb_adresses: Math.max(1, Math.min(input.nb_adresses ?? 1, 500)),
      devis_demande: !!input.devis_demande,
      formule_code: input.formule_code.slice(0, 40),
      formule_label: input.formule_label.slice(0, 200),
      prix_ttc: Math.max(0, Math.floor(input.prix_ttc)),
      payment_method: input.payment_method.slice(0, 40),
    };
  })
  .handler(async ({ data }): Promise<OrderResult> => {
    const { createServerOrder } = await import("@/lib/orders.server");
    return createServerOrder(data);
  });

// ============================================================
// LIRE UNE COMMANDE PAR SON TOKEN (public tracking)
// ============================================================
export const getOrderByToken = createServerFn({ method: "POST" })
  .inputValidator((input: { token: string }) => {
    if (!input?.token) throw new Error("Token requis");
    return { token: input.token.slice(0, 64) };
  })
  .handler(async ({ data }) => {
    const { fetchOrderByToken } = await import("@/lib/orders.server");
    return fetchOrderByToken(data.token);
  });
