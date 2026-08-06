/** Fonctions serveur du portail professionnel (/pro). */
import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { ApiKeyRow, BusinessProfile, ProEstablishment, ProStats } from "@/lib/portal";

type Payload = {
  addressId: string;
  businessName: string;
  phone?: string | null;
  description?: string | null;
  category?: string | null;
  openingHours?: Record<string, string> | null;
  coverBase64?: string | null;
  photosBase64?: string[];
};

function validerPayload(input: Payload) {
  if (!input?.addressId) throw new Error("Adresse requise");
  if (!input?.businessName?.trim()) throw new Error("Le nom commercial est obligatoire.");
  return {
    addressId: input.addressId,
    businessName: input.businessName.slice(0, 120),
    phone: input.phone?.slice(0, 30) ?? null,
    description: input.description?.slice(0, 2000) ?? null,
    category: input.category?.slice(0, 40) ?? null,
    openingHours: input.openingHours ?? null,
    coverBase64: input.coverBase64 ?? null,
    photosBase64: (input.photosBase64 ?? []).slice(0, 8),
  };
}

/* --------------------------- ESPACE BUSINESS --------------------------- */

export const proBusiness = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<BusinessProfile | null> => {
    const { chargerMonBusiness } = await import("@/lib/pro.server");
    return chargerMonBusiness(context.userId);
  });

export const proDashboard = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { chargerDashboardPro } = await import("@/lib/pro.server");
    return chargerDashboardPro(context.userId);
  });

export const proCreateBusiness = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      legalName?: string | null;
      tradeName: string;
      category?: string | null;
      taxId?: string | null;
      contactPhone?: string | null;
      contactEmail?: string | null;
      headquartersAddress?: string | null;
      planCode: string;
    }) => {
      if (!input?.tradeName?.trim()) throw new Error("Le nom commercial est obligatoire.");
      if (input.planCode !== "basic" && input.planCode !== "plus") {
        throw new Error("Offre invalide.");
      }
      return {
        legalName: input.legalName?.slice(0, 160) ?? null,
        tradeName: input.tradeName.slice(0, 160),
        category: input.category?.slice(0, 40) ?? null,
        taxId: input.taxId?.slice(0, 60) ?? null,
        contactPhone: input.contactPhone?.slice(0, 30) ?? null,
        contactEmail: input.contactEmail?.slice(0, 160) ?? null,
        headquartersAddress: input.headquartersAddress?.slice(0, 400) ?? null,
        planCode: input.planCode,
      };
    },
  )
  .handler(async ({ context, data }): Promise<BusinessProfile> => {
    const { creerBusiness } = await import("@/lib/pro.server");
    return creerBusiness(context.userId, data);
  });

export const proUpdateBusiness = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: Record<string, unknown>) => input ?? {})
  .handler(async ({ context, data }) => {
    const { majBusiness } = await import("@/lib/pro.server");
    return majBusiness(context.userId, data as never);
  });

/* ---------------------------- ÉTABLISSEMENTS ---------------------------- */

export const proEstablishments = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<ProEstablishment[]> => {
    const { chargerEtablissements } = await import("@/lib/pro.server");
    return chargerEtablissements(context.userId);
  });

export const proEstablishment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => {
    if (!input?.id) throw new Error("Fiche requise");
    return { id: input.id };
  })
  .handler(async ({ context, data }): Promise<ProEstablishment | null> => {
    const { chargerEtablissement } = await import("@/lib/pro.server");
    return chargerEtablissement(context.userId, data.id);
  });

export const proAvailableAddresses = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { chargerAdressesDisponibles } = await import("@/lib/pro.server");
    return chargerAdressesDisponibles(context.userId);
  });

export const proCreateEstablishment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(validerPayload)
  .handler(async ({ context, data }) => {
    const { creerEtablissement } = await import("@/lib/pro.server");
    return creerEtablissement(context.userId, data);
  });

export const proUpdateEstablishment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: Payload & { id: string }) => {
    if (!input?.id) throw new Error("Fiche requise");
    return { ...validerPayload(input), id: input.id };
  })
  .handler(async ({ context, data }) => {
    const { majEtablissement } = await import("@/lib/pro.server");
    return majEtablissement(context.userId, data);
  });

export const proReorderPhotos = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string; photoIds: string[] }) => {
    if (!input?.id || !Array.isArray(input.photoIds)) throw new Error("Paramètres invalides");
    return { id: input.id, photoIds: input.photoIds.slice(0, 16) };
  })
  .handler(async ({ context, data }) => {
    const { reordonnerPhotos } = await import("@/lib/pro.server");
    return reordonnerPhotos(context.userId, data.id, data.photoIds);
  });

export const proDeletePhoto = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string; photoId: string }) => {
    if (!input?.id || !input?.photoId) throw new Error("Paramètres invalides");
    return { id: input.id, photoId: input.photoId };
  })
  .handler(async ({ context, data }) => {
    const { supprimerPhoto } = await import("@/lib/pro.server");
    return supprimerPhoto(context.userId, data.id, data.photoId);
  });

export const proStats = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string; jours?: number }) => {
    if (!input?.id) throw new Error("Fiche requise");
    return { id: input.id, jours: Math.min(Math.max(Math.round(input.jours ?? 90), 7), 180) };
  })
  .handler(async ({ context, data }): Promise<ProStats> => {
    const { chargerStatsEtablissement } = await import("@/lib/pro.server");
    return chargerStatsEtablissement(context.userId, data.id, data.jours);
  });

/* -------------------------------- ÉQUIPE -------------------------------- */

export const proTeam = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { chargerEquipe } = await import("@/lib/pro.server");
    return chargerEquipe(context.userId);
  });

export const proInviteMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { email: string; role: string }) => {
    const email = (input?.email ?? "").trim();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new Error("Adresse e-mail invalide.");
    const role = input.role === "viewer" ? "viewer" : "editor";
    return { email: email.slice(0, 160), role };
  })
  .handler(async ({ context, data }) => {
    const { inviterMembre } = await import("@/lib/pro.server");
    return inviterMembre(context.userId, data.email, data.role);
  });

export const proUpdateMemberRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string; role: string }) => {
    if (!input?.id) throw new Error("Membre requis");
    if (!["owner", "editor", "viewer"].includes(input.role)) throw new Error("Rôle invalide");
    return { id: input.id, role: input.role };
  })
  .handler(async ({ context, data }) => {
    const { majRoleMembre } = await import("@/lib/pro.server");
    return majRoleMembre(context.userId, data.id, data.role);
  });

export const proRemoveMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => {
    if (!input?.id) throw new Error("Membre requis");
    return { id: input.id };
  })
  .handler(async ({ context, data }) => {
    const { retirerMembre } = await import("@/lib/pro.server");
    return retirerMembre(context.userId, data.id);
  });

/* ------------------------------ FACTURATION ------------------------------ */

export const proBilling = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { chargerFacturation } = await import("@/lib/pro.server");
    return chargerFacturation(context.userId);
  });

export const proChangePlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { planCode: string }) => {
    if (input?.planCode !== "basic" && input?.planCode !== "plus") {
      throw new Error("Offre invalide.");
    }
    return { planCode: input.planCode };
  })
  .handler(async ({ context, data }) => {
    const { changerOffre } = await import("@/lib/pro.server");
    return changerOffre(context.userId, data.planCode);
  });

/* -------------------------------- CLÉS API -------------------------------- */

export const proApiKeys = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<ApiKeyRow[]> => {
    const { chargerClesApi } = await import("@/lib/pro.server");
    return chargerClesApi(context.userId);
  });

export const proCreateApiKey = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { creerCleApi } = await import("@/lib/pro.server");
    return creerCleApi(context.userId);
  });

export const proRevokeApiKey = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => {
    if (!input?.id) throw new Error("Clé requise");
    return { id: input.id };
  })
  .handler(async ({ context, data }) => {
    const { revoquerCleApi } = await import("@/lib/pro.server");
    return revoquerCleApi(context.userId, data.id);
  });
