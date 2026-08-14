/** Points d'entrée serveur de l'espace Support (signalements, réclamations, SAV). */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const supportWhoami = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { requireSupport } = await import("@/lib/admin.server");
    return requireSupport(context.userId);
  });

export const supportDashboard = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { requireSupport } = await import("@/lib/admin.server");
    const { chargerDashboardSupport } = await import("@/lib/support-ops.server");
    await requireSupport(context.userId);
    return chargerDashboardSupport();
  });

/* ---------- Signalements ---------- */

export const supportReports = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { status?: string | null }) => ({ status: input?.status ?? null }))
  .handler(async ({ context, data }) => {
    const { requireSupport } = await import("@/lib/admin.server");
    const { listerSignalements } = await import("@/lib/admin-ops.server");
    await requireSupport(context.userId);
    return listerSignalements(data.status);
  });

export const supportUpdateReport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string; status: string; comment?: string | null }) => {
    if (!["new", "in_review", "resolved", "rejected"].includes(input.status)) throw new Error("Statut invalide.");
    return { id: String(input.id), status: input.status, comment: input.comment ?? null };
  })
  .handler(async ({ context, data }) => {
    const { requireSupport } = await import("@/lib/admin.server");
    const { majSignalement } = await import("@/lib/admin-ops.server");
    await requireSupport(context.userId);
    return majSignalement({ ...data, actorId: context.userId });
  });

/* ---------- Réclamations ---------- */

export const supportClaims = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { statut?: string | null }) => ({ statut: input?.statut ?? null }))
  .handler(async ({ context, data }) => {
    const { requireSupport } = await import("@/lib/admin.server");
    const { listerReclamations } = await import("@/lib/admin-claims.server");
    await requireSupport(context.userId);
    return listerReclamations(data.statut);
  });

export const supportDecideClaim = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string; decision: "approved" | "rejected"; note?: string | null }) => {
    if (!input?.id) throw new Error("Demande requise.");
    if (input.decision !== "approved" && input.decision !== "rejected") throw new Error("Décision invalide.");
    return { id: input.id, decision: input.decision, note: input.note?.slice(0, 500) ?? null };
  })
  .handler(async ({ context, data }) => {
    const { requireSupport } = await import("@/lib/admin.server");
    const { deciderReclamation } = await import("@/lib/admin-claims.server");
    const identite = await requireSupport(context.userId);
    return deciderReclamation({ ...data, actorId: identite.userId });
  });
