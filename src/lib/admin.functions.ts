/** Points d'entrée serveur du back-office. Chaque handler vérifie le rôle admin. */
import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const adminWhoami = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { requireAdmin } = await import("@/lib/admin.server");
    return requireAdmin(context.userId);
  });

export const adminDashboard = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { requireAdmin, chargerDashboard } = await import("@/lib/admin.server");
    await requireAdmin(context.userId);
    return chargerDashboard();
  });

export const adminAnalytics = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { jours?: number }) => ({
    jours: Math.min(Math.max(Math.round(input?.jours ?? 30), 7), 180),
  }))
  .handler(async ({ context, data }) => {
    const { requireAdmin, chargerAnalytics } = await import("@/lib/admin.server");
    await requireAdmin(context.userId);
    return chargerAnalytics(data.jours);
  });

export const adminAudit = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: Record<string, unknown>) => input ?? {})
  .handler(async ({ context, data }) => {
    const { requireAdmin, listerAudit } = await import("@/lib/admin.server");
    await requireAdmin(context.userId);
    return listerAudit({
      page: Number(data['page'] ?? 1),
      pageSize: Number(data['pageSize'] ?? 25),
      actorId: (data['actorId'] as string | null) ?? null,
      action: (data['action'] as string | null) ?? null,
      entity: (data['entity'] as string | null) ?? null,
      from: (data['from'] as string | null) ?? null,
      to: (data['to'] as string | null) ?? null,
    });
  });

/* ------------------------------ BALISES ------------------------------ */

export const adminBeacons = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: Record<string, unknown>) => input ?? {})
  .handler(async ({ context, data }) => {
    const { requireAdmin } = await import("@/lib/admin.server");
    const { listerBalises } = await import("@/lib/admin-ops.server");
    await requireAdmin(context.userId);
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

export const adminBeaconDetail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => ({ id: String(input.id) }))
  .handler(async ({ context, data }) => {
    const { requireAdmin } = await import("@/lib/admin.server");
    const { detailBalise } = await import("@/lib/admin-ops.server");
    await requireAdmin(context.userId);
    return detailBalise(data.id);
  });

export const adminSetBeaconStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string; status: string }) => {
    if (!["generated", "assigned", "active", "suspended", "cancelled"].includes(input.status)) {
      throw new Error("Statut de balise invalide.");
    }
    return { id: String(input.id), status: input.status };
  })
  .handler(async ({ context, data }) => {
    const { requireAdmin } = await import("@/lib/admin.server");
    const { changerStatutBalise } = await import("@/lib/admin-ops.server");
    await requireAdmin(context.userId);
    return changerStatutBalise(data.id, data.status);
  });

export const adminGenerateBeaconLot = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      quantity: number;
      regionId: string;
      supplier?: string | null;
      unitPriceGnf?: number | null;
    }) => {
      const quantite = Math.round(Number(input.quantity));
      if (!Number.isFinite(quantite) || quantite < 1 || quantite > 1000) {
        throw new Error("La quantité doit être comprise entre 1 et 1000.");
      }
      if (!input.regionId) throw new Error("Zone obligatoire.");
      return {
        quantity: quantite,
        regionId: String(input.regionId),
        supplier: input.supplier?.trim() || null,
        unitPriceGnf: input.unitPriceGnf != null ? Number(input.unitPriceGnf) : null,
      };
    },
  )
  .handler(async ({ context, data }) => {
    const { requireAdmin } = await import("@/lib/admin.server");
    const { genererLotBalises } = await import("@/lib/admin-ops.server");
    await requireAdmin(context.userId);
    return genererLotBalises(data);
  });

export const adminAssignLot = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { lotId: string; agentId: string }) => ({
    lotId: String(input.lotId),
    agentId: String(input.agentId),
  }))
  .handler(async ({ context, data }) => {
    const { requireAdmin } = await import("@/lib/admin.server");
    const { affecterLotAgent } = await import("@/lib/admin-ops.server");
    await requireAdmin(context.userId);
    return affecterLotAgent(data.lotId, data.agentId);
  });

export const adminExportQrPdf = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { lotId: string }) => ({ lotId: String(input.lotId) }))
  .handler(async ({ context, data }) => {
    const { requireAdmin } = await import("@/lib/admin.server");
    const { numerosDuLot, codeDuLot } = await import("@/lib/admin-ops.server");
    const { genererPdfQr, baseSite } = await import("@/lib/admin-pdf.server");
    await requireAdmin(context.userId);
    const base = baseSite();
    const [numeros, lotCode] = await Promise.all([
      numerosDuLot(data.lotId),
      codeDuLot(data.lotId),
    ]);
    if (numeros.length === 0) throw new Error("Aucune balise dans ce lot.");
    const pdf = await genererPdfQr(numeros, base);
    return { ...pdf, balises: numeros.length, lotCode };
  });

/* ------------------------------ ADRESSES ------------------------------ */

export const adminAddresses = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: Record<string, unknown>) => input ?? {})
  .handler(async ({ context, data }) => {
    const { requireAdmin } = await import("@/lib/admin.server");
    const { listerAdresses } = await import("@/lib/admin-ops.server");
    await requireAdmin(context.userId);
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

export const adminAddressDetail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => ({ id: String(input.id) }))
  .handler(async ({ context, data }) => {
    const { requireAdmin } = await import("@/lib/admin.server");
    const { detailAdresse } = await import("@/lib/admin-ops.server");
    await requireAdmin(context.userId);
    return detailAdresse(data.id);
  });

export const adminUpdateAddress = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string; patch: Record<string, unknown> }) => ({
    id: String(input.id),
    patch: input.patch ?? {},
  }))
  .handler(async ({ context, data }) => {
    const { requireAdmin } = await import("@/lib/admin.server");
    const { majAdresse } = await import("@/lib/admin-ops.server");
    await requireAdmin(context.userId);
    return majAdresse(data.id, data.patch as any);
  });

export const adminReassignOwner = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { addressId: string; email: string }) => ({
    addressId: String(input.addressId),
    email: String(input.email).trim(),
  }))
  .handler(async ({ context, data }) => {
    const { requireAdmin } = await import("@/lib/admin.server");
    const { reassignerProprietaire } = await import("@/lib/admin-ops.server");
    await requireAdmin(context.userId);
    return reassignerProprietaire(data.addressId, data.email);
  });

/* --------------------------- INSTALLATIONS / QC --------------------------- */

export const adminInstallations = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: Record<string, unknown>) => input ?? {})
  .handler(async ({ context, data }) => {
    const { requireAdmin } = await import("@/lib/admin.server");
    const { listerInstallations } = await import("@/lib/admin-ops.server");
    await requireAdmin(context.userId);
    return listerInstallations({
      page: Number(data['page'] ?? 1),
      pageSize: Number(data['pageSize'] ?? 20),
      agentId: (data['agentId'] as string | null) ?? null,
      validation: (data['validation'] as "validated" | "pending" | null) ?? null,
      accuracyMax: data['accuracyMax'] != null ? Number(data['accuracyMax']) : null,
    });
  });

export const adminDrawQc = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { percent?: number }) => ({
    percent: Math.min(Math.max(Math.round(Number(input?.percent ?? 10)), 1), 100),
  }))
  .handler(async ({ context, data }) => {
    const { requireAdmin } = await import("@/lib/admin.server");
    const { tirerControleQc } = await import("@/lib/admin-ops.server");
    await requireAdmin(context.userId);
    return tirerControleQc(data.percent);
  });

export const adminQcQueue = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { requireAdmin } = await import("@/lib/admin.server");
    const { fileQc } = await import("@/lib/admin-ops.server");
    await requireAdmin(context.userId);
    return fileQc();
  });

export const adminReviewInstallation = createServerFn({ method: "POST" })
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
    const { requireAdmin } = await import("@/lib/admin.server");
    const { statuerInstallation } = await import("@/lib/admin-ops.server");
    await requireAdmin(context.userId);
    return statuerInstallation({ ...data, validatorId: context.userId });
  });

export const adminInstallationDetail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => ({ id: String(input.id) }))
  .handler(async ({ context, data }) => {
    const { requireAdmin } = await import("@/lib/admin.server");
    const { detailInstallation } = await import("@/lib/admin-install-edit.server");
    await requireAdmin(context.userId);
    return detailInstallation(data.id);
  });

export const adminUpdateInstallation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      id: string;
      motif?: string | null;
      patch: Record<string, unknown>;
    }) => {
      const brut = input?.patch ?? {};
      const patch: Record<string, unknown> = {};
      if ("agent_id" in brut) patch['agent_id'] = brut['agent_id'] ? String(brut['agent_id']) : null;
      for (const cle of ["gps_lat", "gps_lng", "accuracy_m"]) {
        if (cle in brut) {
          const v = brut[cle];
          patch[cle] = v === "" || v == null ? null : Number(v);
          if (patch[cle] != null && !Number.isFinite(patch[cle] as number)) {
            throw new Error("Valeur numérique invalide.");
          }
        }
      }
      if ("photo_url" in brut) {
        const v = brut['photo_url'];
        patch['photo_url'] = v ? String(v).trim() : null;
      }
      if ("installed_at" in brut) {
        const v = brut['installed_at'];
        patch['installed_at'] = v ? new Date(String(v)).toISOString() : null;
      }
      return { id: String(input.id), motif: input.motif ?? null, patch };
    },
  )
  .handler(async ({ context, data }) => {
    const { requireAdmin } = await import("@/lib/admin.server");
    const { modifierInstallation } = await import("@/lib/admin-install-edit.server");
    await requireAdmin(context.userId);
    return modifierInstallation({
      id: data.id,
      actorId: context.userId,
      patch: data.patch,
      motif: data.motif,
    });
  });

export const adminAgentMetrics = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { requireAdmin } = await import("@/lib/admin.server");
    const { metriquesAgents } = await import("@/lib/admin-ops.server");
    await requireAdmin(context.userId);
    return metriquesAgents();
  });

/* --------------------------- SIGNALEMENTS --------------------------- */

export const adminReports = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { status?: string | null }) => ({ status: input?.status ?? null }))
  .handler(async ({ context, data }) => {
    const { requireAdmin } = await import("@/lib/admin.server");
    const { listerSignalements } = await import("@/lib/admin-ops.server");
    await requireAdmin(context.userId);
    return listerSignalements(data.status);
  });

export const adminUpdateReport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string; status: string; comment?: string | null }) => {
    if (!["new", "in_review", "resolved", "rejected"].includes(input.status)) {
      throw new Error("Statut de signalement invalide.");
    }
    return { id: String(input.id), status: input.status, comment: input.comment ?? null };
  })
  .handler(async ({ context, data }) => {
    const { requireAdmin } = await import("@/lib/admin.server");
    const { majSignalement } = await import("@/lib/admin-ops.server");
    await requireAdmin(context.userId);
    return majSignalement({ ...data, actorId: context.userId });
  });

/* --------------------------- UTILISATEURS --------------------------- */

export const adminUsers = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { page?: number; q?: string | null }) => ({
    page: Math.max(Math.round(Number(input?.page ?? 1)), 1),
    q: input?.q?.trim() || null,
  }))
  .handler(async ({ context, data }) => {
    const { requireAdmin } = await import("@/lib/admin.server");
    const { listerUtilisateurs } = await import("@/lib/admin-ops.server");
    await requireAdmin(context.userId);
    return listerUtilisateurs(data.page, data.q);
  });

export const adminSetRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { userId: string; role: string }) => {
    if (!["user", "agent", "supervisor", "admin", "super_admin"].includes(input.role)) {
      throw new Error("Rôle invalide.");
    }
    return { userId: String(input.userId), role: input.role };
  })
  .handler(async ({ context, data }) => {
    const { requireAdmin, requireSuperAdmin } = await import("@/lib/admin.server");
    const { changerRole } = await import("@/lib/admin-ops.server");
    if (data.role === "admin" || data.role === "super_admin") {
      await requireSuperAdmin(context.userId);
    } else {
      await requireAdmin(context.userId);
    }
    return changerRole(data.userId, data.role);
  });

export const adminDisableUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { userId: string; disable: boolean }) => ({
    userId: String(input.userId),
    disable: Boolean(input.disable),
  }))
  .handler(async ({ context, data }) => {
    const { requireAdmin } = await import("@/lib/admin.server");
    const { desactiverUtilisateur } = await import("@/lib/admin-ops.server");
    await requireAdmin(context.userId);
    if (data.userId === context.userId) throw new Error("Impossible de se désactiver soi-même.");
    return desactiverUtilisateur(data.userId, data.disable);
  });

export const adminResetPassword = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { email: string; origin: string }) => ({
    email: String(input.email).trim(),
    origin: String(input.origin ?? "").replace(/\/$/, ""),
  }))
  .handler(async ({ context, data }) => {
    const { requireAdmin } = await import("@/lib/admin.server");
    const { reinitialiserMotDePasse } = await import("@/lib/admin-ops.server");
    await requireAdmin(context.userId);
    return reinitialiserMotDePasse(data.email, data.origin);
  });

export const adminCreateUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      email: string;
      password: string;
      role: string;
      fullName?: string | null;
      phone?: string | null;
    }) => {
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(input.email ?? "")) throw new Error("Email invalide.");
      if ((input.password ?? "").length < 8) {
        throw new Error("Le mot de passe doit contenir au moins 8 caractères.");
      }
      if (!["user", "agent", "supervisor", "admin", "super_admin"].includes(input.role)) {
        throw new Error("Rôle invalide.");
      }
      return {
        email: input.email.trim().toLowerCase(),
        password: input.password,
        role: input.role,
        fullName: input.fullName?.trim() || null,
        phone: input.phone?.trim() || null,
      };
    },
  )
  .handler(async ({ context, data }) => {
    const { requireAdmin, requireSuperAdmin } = await import("@/lib/admin.server");
    const { creerUtilisateur } = await import("@/lib/admin-ops.server");
    if (data.role === "admin" || data.role === "super_admin") {
      await requireSuperAdmin(context.userId);
    } else {
      await requireAdmin(context.userId);
    }
    return creerUtilisateur(data);
  });

/* ------------------------------- AGENTS ------------------------------- */

export const adminAgents = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { requireAdmin } = await import("@/lib/admin.server");
    const { listerAgents } = await import("@/lib/admin-ops.server");
    await requireAdmin(context.userId);
    return listerAgents();
  });

export const adminUpdateAgent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: Record<string, unknown>) => input ?? {})
  .handler(async ({ context, data }) => {
    const { requireAdmin } = await import("@/lib/admin.server");
    const { majAgent } = await import("@/lib/admin-ops.server");
    await requireAdmin(context.userId);
    return majAgent(data as any);
  });

export const adminCreateAgent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      email: string;
      password: string;
      fullName: string;
      phone?: string | null;
      badgeNumber: string;
      zoneId?: string | null;
    }) => {
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(input.email ?? "")) throw new Error("Email invalide.");
      if ((input.password ?? "").length < 8) {
        throw new Error("Le mot de passe doit contenir au moins 8 caractères.");
      }
      if (!input.badgeNumber?.trim()) throw new Error("Numéro de badge obligatoire.");
      return {
        email: input.email.trim().toLowerCase(),
        password: input.password,
        fullName: input.fullName?.trim() || "",
        phone: input.phone?.trim() || null,
        badgeNumber: input.badgeNumber.trim().toUpperCase(),
        zoneId: input.zoneId || null,
      };
    },
  )
  .handler(async ({ context, data }) => {
    const { requireAdmin } = await import("@/lib/admin.server");
    const { creerAgent } = await import("@/lib/admin-ops.server");
    await requireAdmin(context.userId);
    return creerAgent(data);
  });

/* -------------------------------- LOTS -------------------------------- */

export const adminLots = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { requireAdmin } = await import("@/lib/admin.server");
    const { listerLots } = await import("@/lib/admin-ops.server");
    await requireAdmin(context.userId);
    return listerLots();
  });

export const adminUpdateLot = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string; status: string }) => ({
    id: String(input.id),
    status: String(input.status),
  }))
  .handler(async ({ context, data }) => {
    const { requireAdmin } = await import("@/lib/admin.server");
    const { majLot } = await import("@/lib/admin-ops.server");
    await requireAdmin(context.userId);
    return majLot(data.id, data.status);
  });

/* -------------------------------- ZONES -------------------------------- */

export const adminZones = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { requireAdmin } = await import("@/lib/admin.server");
    const { listerZones } = await import("@/lib/admin-ops.server");
    await requireAdmin(context.userId);
    return listerZones();
  });

export const adminSaveZone = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: Record<string, unknown>) => {
    if (!["region", "commune", "district"].includes(String(input['niveau']))) {
      throw new Error("Niveau de zone invalide.");
    }
    if (!String(input['name'] ?? "").trim()) throw new Error("Nom obligatoire.");
    return input;
  })
  .handler(async ({ context, data }) => {
    const { requireAdmin } = await import("@/lib/admin.server");
    const { enregistrerZone } = await import("@/lib/admin-ops.server");
    await requireAdmin(context.userId);
    return enregistrerZone(data as any);
  });

export const adminDeleteZone = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { niveau: "region" | "commune" | "district"; id: string }) => ({
    niveau: input.niveau,
    id: String(input.id),
  }))
  .handler(async ({ context, data }) => {
    const { requireAdmin } = await import("@/lib/admin.server");
    const { supprimerZone } = await import("@/lib/admin-ops.server");
    await requireAdmin(context.userId);
    return supprimerZone(data.niveau, data.id);
  });

/* --------------------------- RÉCLAMATIONS --------------------------- */

export const adminClaims = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { statut?: string | null }) => ({
    statut: input?.statut ?? null,
  }))
  .handler(async ({ context, data }) => {
    const { requireAdmin } = await import("@/lib/admin.server");
    const { listerReclamations } = await import("@/lib/admin-claims.server");
    await requireAdmin(context.userId);
    return listerReclamations(data.statut);
  });

export const adminDecideClaim = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string; decision: "approved" | "rejected"; note?: string | null }) => {
    if (!input?.id) throw new Error("Demande requise");
    if (input.decision !== "approved" && input.decision !== "rejected") {
      throw new Error("Décision invalide.");
    }
    return { id: input.id, decision: input.decision, note: input.note?.slice(0, 500) ?? null };
  })
  .handler(async ({ context, data }) => {
    const { requireAdmin } = await import("@/lib/admin.server");
    const { deciderReclamation } = await import("@/lib/admin-claims.server");
    const identite = await requireAdmin(context.userId);
    return deciderReclamation({ ...data, actorId: identite.userId });
  });
