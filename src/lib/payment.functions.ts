/** Points d'entrée serveur du paiement (§8). Fichier fin : imports + déclarations. */
import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/* --------------------------- Catalogue public --------------------------- */

export const paiementMoyens = createServerFn({ method: "GET" }).handler(async () => {
  const { listerMoyensPaiement } = await import("@/server/payment");
  return listerMoyensPaiement();
});

/* ------------------------------- Client -------------------------------- */

export const creerCommandeFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { offerCode: string; businessId?: string | null; beaconId?: string | null }) => {
    if (!input?.offerCode) throw new Error("Offre manquante.");
    return {
      offerCode: String(input.offerCode),
      businessId: input.businessId ?? null,
      beaconId: input.beaconId ?? null,
    };
  })
  .handler(async ({ context, data }) => {
    const { creerCommande } = await import("@/lib/payment.server");
    return creerCommande(context.userId, data);
  });

export const chargerCommandeFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { orderRef: string }) => ({ orderRef: String(input?.orderRef ?? "") }))
  .handler(async ({ context, data }) => {
    const { chargerCommande } = await import("@/lib/payment.server");
    return chargerCommande(context.userId, data.orderRef);
  });

export const mesCommandes = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { listerMesCommandes } = await import("@/lib/payment.server");
    return listerMesCommandes(context.userId);
  });

export const initierPaiementFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { orderRef: string; provider: string }) => ({
    orderRef: String(input?.orderRef ?? ""),
    provider: String(input?.provider ?? "manual"),
  }))
  .handler(async ({ context, data }) => {
    const { initierPaiement } = await import("@/lib/payment.server");
    return initierPaiement(context.userId, data.orderRef, data.provider);
  });

export const statutCommandeFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { orderRef: string }) => ({ orderRef: String(input?.orderRef ?? "") }))
  .handler(async ({ context, data }) => {
    const { statutCommande } = await import("@/lib/payment.server");
    return statutCommande(context.userId, data.orderRef);
  });

/* ---------------------------- Administration --------------------------- */

export const adminPaiements = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { statut?: string; page?: number; pageSize?: number }) => ({
    statut: input?.statut ?? "pending",
    page: Number(input?.page ?? 1),
    pageSize: Number(input?.pageSize ?? 25),
  }))
  .handler(async ({ context, data }) => {
    const { requireAdmin } = await import("@/lib/admin.server");
    const { listerPaiements } = await import("@/lib/payment.server");
    await requireAdmin(context.userId);
    return listerPaiements(data);
  });

export const adminConfirmerPaiement = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { paymentId: string; externalRef: string; note?: string | null }) => {
    const ref = String(input?.externalRef ?? "").trim();
    if (!input?.paymentId) throw new Error("Paiement manquant.");
    if (ref.length < 3) throw new Error("Référence du reçu obligatoire (3 caractères minimum).");
    return { paymentId: String(input.paymentId), externalRef: ref, note: input.note ?? null };
  })
  .handler(async ({ context, data }) => {
    const { requireAdmin } = await import("@/lib/admin.server");
    const { confirmerPaiementManuel } = await import("@/lib/payment.server");
    await requireAdmin(context.userId);
    return confirmerPaiementManuel(context.userId, data);
  });

export const adminRejeterPaiement = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { paymentId: string; motif: string }) => {
    const motif = String(input?.motif ?? "").trim();
    if (!input?.paymentId) throw new Error("Paiement manquant.");
    if (motif.length < 3) throw new Error("Motif de rejet obligatoire.");
    return { paymentId: String(input.paymentId), motif };
  })
  .handler(async ({ context, data }) => {
    const { requireAdmin } = await import("@/lib/admin.server");
    const { rejeterPaiement } = await import("@/lib/payment.server");
    await requireAdmin(context.userId);
    return rejeterPaiement(context.userId, data);
  });

export const adminInstallationsAPlanifier = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input?: { statut?: string | null; agentId?: string | null }) => ({
    statut: input?.statut ? String(input.statut) : null,
    agentId: input?.agentId ? String(input.agentId) : null,
  }))
  .handler(async ({ context, data }) => {
    const { requireAdmin } = await import("@/lib/admin.server");
    const { listerInstallationsEnAttente } = await import("@/lib/payment.server");
    await requireAdmin(context.userId);
    return listerInstallationsEnAttente(data);
  });

export const adminStatutInstallationAttente = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string; statut: string; note?: string | null }) => {
    const statuts = ["pending", "assigned", "planned", "done", "cancelled"];
    if (!input?.id) throw new Error("Demande manquante.");
    if (!statuts.includes(String(input?.statut))) throw new Error("Statut invalide.");
    return { id: String(input.id), statut: String(input.statut), note: input.note ?? null };
  })
  .handler(async ({ context, data }) => {
    const { requireAdmin } = await import("@/lib/admin.server");
    const { changerStatutInstallationEnAttente } = await import("@/lib/payment.server");
    await requireAdmin(context.userId);
    return changerStatutInstallationEnAttente(context.userId, data);
  });

export const adminAffecterInstallation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string; agentId: string }) => {
    if (!input?.id || !input?.agentId) throw new Error("Agent ou demande manquant.");
    return { id: String(input.id), agentId: String(input.agentId) };
  })
  .handler(async ({ context, data }) => {
    const { requireAdmin } = await import("@/lib/admin.server");
    const { affecterInstallation } = await import("@/lib/payment.server");
    await requireAdmin(context.userId);
    return affecterInstallation(context.userId, data);
  });

export const adminAbonnements = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { requireAdmin } = await import("@/lib/admin.server");
    const { listerAbonnements } = await import("@/lib/payment.server");
    await requireAdmin(context.userId);
    return listerAbonnements();
  });

export const adminLancerFacturation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { requireAdmin } = await import("@/lib/admin.server");
    const { lancerFacturationRecurrente } = await import("@/lib/payment.server");
    await requireAdmin(context.userId);
    return lancerFacturationRecurrente(context.userId);
  });
