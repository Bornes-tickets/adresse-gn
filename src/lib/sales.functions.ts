/** Points d'entrée serveur de l'espace Sales (commercial). */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const salesWhoami = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { requireSales } = await import("@/lib/admin.server");
    return requireSales(context.userId);
  });

export const salesDashboard = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { requireSales } = await import("@/lib/admin.server");
    const { chargerDashboardSales } = await import("@/lib/sales-ops.server");
    await requireSales(context.userId);
    return chargerDashboardSales();
  });

/* --------------------------- PAIEMENTS --------------------------- */

export const salesPaiements = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { statut?: string; page?: number; pageSize?: number }) => ({
    statut: input?.statut ?? "pending",
    page: Number(input?.page ?? 1),
    pageSize: Number(input?.pageSize ?? 25),
  }))
  .handler(async ({ context, data }) => {
    const { requireSales } = await import("@/lib/admin.server");
    const { listerPaiements } = await import("@/lib/payment.server");
    await requireSales(context.userId);
    return listerPaiements(data);
  });

export const salesConfirmerPaiement = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { paymentId: string; externalRef: string; note?: string | null }) => {
    const ref = String(input?.externalRef ?? "").trim();
    if (!input?.paymentId) throw new Error("Paiement manquant.");
    if (ref.length < 3) throw new Error("Référence du reçu obligatoire (3 caractères minimum).");
    return { paymentId: String(input.paymentId), externalRef: ref, note: input.note ?? null };
  })
  .handler(async ({ context, data }) => {
    const { requireSales } = await import("@/lib/admin.server");
    const { confirmerPaiementManuel } = await import("@/lib/payment.server");
    await requireSales(context.userId);
    return confirmerPaiementManuel(context.userId, data);
  });

export const salesRejeterPaiement = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { paymentId: string; motif: string }) => {
    const motif = String(input?.motif ?? "").trim();
    if (!input?.paymentId) throw new Error("Paiement manquant.");
    if (motif.length < 3) throw new Error("Motif de rejet obligatoire.");
    return { paymentId: String(input.paymentId), motif };
  })
  .handler(async ({ context, data }) => {
    const { requireSales } = await import("@/lib/admin.server");
    const { rejeterPaiement } = await import("@/lib/payment.server");
    await requireSales(context.userId);
    return rejeterPaiement(context.userId, data);
  });

/* --------------------------- INSTALLATIONS À PLANIFIER --------------------------- */

export const salesInstallationsAPlanifier = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input?: { statut?: string | null; agentId?: string | null }) => ({
    statut: input?.statut ? String(input.statut) : null,
    agentId: input?.agentId ? String(input.agentId) : null,
  }))
  .handler(async ({ context, data }) => {
    const { requireSales } = await import("@/lib/admin.server");
    const { listerInstallationsEnAttente } = await import("@/lib/payment.server");
    await requireSales(context.userId);
    return listerInstallationsEnAttente(data);
  });

export const salesAffecterInstallation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string; agentId: string }) => {
    if (!input?.id || !input?.agentId) throw new Error("Agent ou demande manquant.");
    return { id: String(input.id), agentId: String(input.agentId) };
  })
  .handler(async ({ context, data }) => {
    const { requireSales } = await import("@/lib/admin.server");
    const { affecterInstallation } = await import("@/lib/payment.server");
    await requireSales(context.userId);
    return affecterInstallation(context.userId, data);
  });

export const salesStatutInstallation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string; statut: string; note?: string | null }) => {
    const statuts = ["pending", "assigned", "planned", "done", "cancelled"];
    if (!input?.id) throw new Error("Demande manquante.");
    if (!statuts.includes(String(input?.statut))) throw new Error("Statut invalide.");
    return { id: String(input.id), statut: String(input.statut), note: input.note ?? null };
  })
  .handler(async ({ context, data }) => {
    const { requireSales } = await import("@/lib/admin.server");
    const { changerStatutInstallationEnAttente } = await import("@/lib/payment.server");
    await requireSales(context.userId);
    return changerStatutInstallationEnAttente(context.userId, data);
  });

/* --------------------------- COMMANDES --------------------------- */

export const salesCommandes = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { statut?: string; q?: string; page?: number; pageSize?: number }) => ({
    statut: input?.statut ?? "all",
    q: input?.q?.trim() ?? "",
    page: Number(input?.page ?? 1),
    pageSize: Number(input?.pageSize ?? 25),
  }))
  .handler(async ({ context, data }) => {
    const { requireSales } = await import("@/lib/admin.server");
    const { listerCommandes } = await import("@/lib/sales-ops.server");
    await requireSales(context.userId);
    return listerCommandes(data);
  });

/* --------------------------- ABONNEMENTS --------------------------- */

export const salesAbonnements = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { requireSales } = await import("@/lib/admin.server");
    const { listerAbonnements } = await import("@/lib/payment.server");
    await requireSales(context.userId);
    return listerAbonnements();
  });
/* --------------------------- OFFRES & TARIFS --------------------------- */

export const salesOffres = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { requireSales } = await import("@/lib/admin.server");
    const { listerOffres } = await import("@/lib/sales-ops.server");
    await requireSales(context.userId);
    return listerOffres();
  });

/* --------------------------- CLIENTS --------------------------- */

export const salesClients = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { q?: string; page?: number; pageSize?: number }) => ({
    q: input?.q?.trim() ?? "",
    page: Number(input?.page ?? 1),
    pageSize: Number(input?.pageSize ?? 25),
  }))
  .handler(async ({ context, data }) => {
    const { requireSales } = await import("@/lib/admin.server");
    const { listerClients } = await import("@/lib/sales-ops.server");
    await requireSales(context.userId);
    return listerClients(data);
  });
