/** Points d'entrée serveur du back-office Superviseur. Périmètre : lecture + validations. */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const supervisorWhoami = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { requireSupervisor } = await import("@/lib/admin.server");
    return requireSupervisor(context.userId);
  });

export const supervisorDashboard = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { requireSupervisor, chargerDashboard } = await import("@/lib/admin.server");
    await requireSupervisor(context.userId);
    return chargerDashboard();
  });

/* ---------- Lectures larges (balises, lots, adresses, agents, zones) ---------- */

export const supervisorBeacons = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: Record<string, unknown>) => input ?? {})
  .handler(async ({ context, data }) => {
    const { requireSupervisor } = await import("@/lib/admin.server");
    const { listerBalises } = await import("@/lib/admin-ops.server");
    await requireSupervisor(context.userId);
    return listerBalises({
      page: Number(data['page'] ?? 1),
      pageSize: Number(data['pageSize'] ?? 20),
      statuses: (data['statuses'] as string[] | undefined) ?? [],
      lotId: (data['lotId'] as string | null) ?? null,
      from: (data['from'] as string | null) ?? null,
      to: (data['to'] as string | null) ?? null,
      q: (data['q'] as string | null) ?? null,
    });
  });

export const supervisorBeaconDetail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => ({ id: String(input.id) }))
  .handler(async ({ context, data }) => {
    const { requireSupervisor } = await import("@/lib/admin.server");
    const { detailBalise } = await import("@/lib/admin-ops.server");
    await requireSupervisor(context.userId);
    return detailBalise(data.id);
  });

export const supervisorLots = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { requireSupervisor } = await import("@/lib/admin.server");
    const { listerLots } = await import("@/lib/admin-ops.server");
    await requireSupervisor(context.userId);
    return listerLots();
  });

export const supervisorAddresses = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: Record<string, unknown>) => input ?? {})
  .handler(async ({ context, data }) => {
    const { requireSupervisor } = await import("@/lib/admin.server");
    const { listerAdresses } = await import("@/lib/admin-ops.server");
    await requireSupervisor(context.userId);
    return listerAdresses({
      page: Number(data['page'] ?? 1),
      pageSize: Number(data['pageSize'] ?? 20),
      visibility: (data['visibility'] as string | null) ?? null,
      category: (data['category'] as string | null) ?? null,
      verification: (data['verification'] as string | null) ?? null,
      communeId: (data['communeId'] as string | null) ?? null,
      status: (data['status'] as string | null) ?? null,
      from: (data['from'] as string | null) ?? null,
      to: (data['to'] as string | null) ?? null,
      q: (data['q'] as string | null) ?? null,
    });
  });

export const supervisorAddressDetail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => ({ id: String(input.id) }))
  .handler(async ({ context, data }) => {
    const { requireSupervisor } = await import("@/lib/admin.server");
    const { detailAdresse } = await import("@/lib/admin-ops.server");
    await requireSupervisor(context.userId);
    return detailAdresse(data.id);
  });

export const supervisorAgents = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { requireSupervisor } = await import("@/lib/admin.server");
    const { listerAgents } = await import("@/lib/admin-ops.server");
    await requireSupervisor(context.userId);
    return listerAgents();
  });

export const supervisorAgentMetrics = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { requireSupervisor } = await import("@/lib/admin.server");
    const { metriquesAgents } = await import("@/lib/admin-ops.server");
    await requireSupervisor(context.userId);
    return metriquesAgents();
  });

export const supervisorZones = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { requireSupervisor } = await import("@/lib/admin.server");
    const { listerZones } = await import("@/lib/admin-ops.server");
    await requireSupervisor(context.userId);
    return listerZones();
  });

/* --------------------- INSTALLATIONS / QC (validation) --------------------- */

export const supervisorInstallations = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: Record<string, unknown>) => input ?? {})
  .handler(async ({ context, data }) => {
    const { requireSupervisor } = await import("@/lib/admin.server");
    const { listerInstallations } = await import("@/lib/admin-ops.server");
    await requireSupervisor(context.userId);
    return listerInstallations({
      page: Number(data['page'] ?? 1),
      pageSize: Number(data['pageSize'] ?? 20),
      agentId: (data['agentId'] as string | null) ?? null,
      validation: (data['validation'] as "validated" | "pending" | null) ?? null,
      accuracyMax: data['accuracyMax'] != null ? Number(data['accuracyMax']) : null,
    });
  });

export const supervisorQcQueue = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { requireSupervisor } = await import("@/lib/admin.server");
    const { fileQc } = await import("@/lib/admin-ops.server");
    await requireSupervisor(context.userId);
    return fileQc();
  });

export const supervisorDrawQc = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { percent?: number }) => ({
    percent: Math.min(Math.max(Math.round(Number(input?.percent ?? 10)), 1), 100),
  }))
  .handler(async ({ context, data }) => {
    const { requireSupervisor } = await import("@/lib/admin.server");
    const { tirerControleQc } = await import("@/lib/admin-ops.server");
    await requireSupervisor(context.userId);
    return tirerControleQc(data.percent);
  });

/** Le superviseur valide/rejette une installation posée par un agent. */
export const supervisorReviewInstallation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      installationId: string | null;
      reportId: string | null;
      decision: "valider" | "rejeter";
      motif?: string | null;
    }) => {
      if (input.decision !== "valider" && input.decision !== "rejeter") {
        throw new Error("Décision invalide.");
      }
      return {
        installationId: input.installationId ?? null,
        reportId: input.reportId ?? null,
        decision: input.decision,
        motif: input.motif ?? null,
      };
    },
  )
  .handler(async ({ context, data }) => {
    const { requireSupervisor } = await import("@/lib/admin.server");
    const { statuerInstallation } = await import("@/lib/admin-ops.server");
    await requireSupervisor(context.userId);
    return statuerInstallation({ ...data, validatorId: context.userId });
  });

/* --------------------------- SIGNALEMENTS --------------------------- */

export const supervisorReports = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { status?: string | null }) => ({ status: input?.status ?? null }))
  .handler(async ({ context, data }) => {
    const { requireSupervisor } = await import("@/lib/admin.server");
    const { listerSignalements } = await import("@/lib/admin-ops.server");
    await requireSupervisor(context.userId);
    return listerSignalements(data.status);
  });

export const supervisorUpdateReport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string; status: string; comment?: string | null }) => {
    if (!["new", "in_review", "resolved", "rejected"].includes(input.status)) {
      throw new Error("Statut de signalement invalide.");
    }
    return { id: String(input.id), status: input.status, comment: input.comment ?? null };
  })
  .handler(async ({ context, data }) => {
    const { requireSupervisor } = await import("@/lib/admin.server");
    const { majSignalement } = await import("@/lib/admin-ops.server");
    await requireSupervisor(context.userId);
    return majSignalement({ ...data, actorId: context.userId });
  });

/* --------------------------- RÉCLAMATIONS --------------------------- */

export const supervisorClaims = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { statut?: string | null }) => ({ statut: input?.statut ?? null }))
  .handler(async ({ context, data }) => {
    const { requireSupervisor } = await import("@/lib/admin.server");
    const { listerReclamations } = await import("@/lib/admin-claims.server");
    await requireSupervisor(context.userId);
    return listerReclamations(data.statut);
  });

export const supervisorDecideClaim = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string; decision: "approved" | "rejected"; note?: string | null }) => {
    if (!input?.id) throw new Error("Demande requise");
    if (input.decision !== "approved" && input.decision !== "rejected") {
      throw new Error("Décision invalide.");
    }
    return { id: input.id, decision: input.decision, note: input.note?.slice(0, 500) ?? null };
  })
  .handler(async ({ context, data }) => {
    const { requireSupervisor } = await import("@/lib/admin.server");
    const { deciderReclamation } = await import("@/lib/admin-claims.server");
    const identite = await requireSupervisor(context.userId);
    return deciderReclamation({ ...data, actorId: identite.userId });
  });
