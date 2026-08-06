/** Fonctions serveur du portail propriétaire (/mon-compte) et des réclamations. */
import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type {
  BeaconContext,
  OwnerBeacon,
  OwnerDashboard,
  OwnerFavorite,
  OwnerReport,
} from "@/lib/portal";

export const ownerDashboard = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<OwnerDashboard> => {
    const { chargerDashboardProprietaire } = await import("@/lib/owner.server");
    return chargerDashboardProprietaire(context.userId);
  });

export const ownerBeacons = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<OwnerBeacon[]> => {
    const { chargerMesBalises } = await import("@/lib/owner.server");
    return chargerMesBalises(context.userId);
  });

export const ownerUpdateBeacon = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      addressId: string;
      name: string | null;
      category: string;
      visibility: string;
      accessPointNote: string | null;
    }) => {
      if (!input?.addressId) throw new Error("Adresse requise");
      if (input.visibility !== "public" && input.visibility !== "private") {
        throw new Error("Visibilité invalide");
      }
      return {
        addressId: input.addressId,
        name: input.name?.slice(0, 120) ?? null,
        category: input.category.slice(0, 40),
        visibility: input.visibility,
        accessPointNote: input.accessPointNote?.slice(0, 400) ?? null,
      };
    },
  )
  .handler(async ({ context, data }) => {
    const { majMaBalise } = await import("@/lib/owner.server");
    return majMaBalise(context.userId, data);
  });

export const ownerSuspendBeacon = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { addressId: string }) => {
    if (!input?.addressId) throw new Error("Adresse requise");
    return { addressId: input.addressId };
  })
  .handler(async ({ context, data }) => {
    const { suspendreMaBalise } = await import("@/lib/owner.server");
    return suspendreMaBalise(context.userId, data.addressId);
  });

/* ------------------------------ FAVORIS ------------------------------ */

export const ownerFavorites = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<OwnerFavorite[]> => {
    const { chargerFavoris } = await import("@/lib/owner.server");
    return chargerFavoris(context.userId);
  });

export const ownerToggleFavorite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { number: string; alias?: string | null }) => {
    if (typeof input?.number !== "string") throw new Error("Numéro requis");
    return { number: input.number.slice(0, 32), alias: input.alias?.slice(0, 80) ?? null };
  })
  .handler(async ({ context, data }) => {
    const { basculerFavori } = await import("@/lib/owner.server");
    return basculerFavori(context.userId, data.number, data.alias);
  });

export const ownerUpdateFavorite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string; alias: string | null }) => {
    if (!input?.id) throw new Error("Favori requis");
    return { id: input.id, alias: input.alias?.slice(0, 80) ?? null };
  })
  .handler(async ({ context, data }) => {
    const { majFavori } = await import("@/lib/owner.server");
    return majFavori(context.userId, data.id, data.alias);
  });

export const ownerDeleteFavorite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => {
    if (!input?.id) throw new Error("Favori requis");
    return { id: input.id };
  })
  .handler(async ({ context, data }) => {
    const { supprimerFavori } = await import("@/lib/owner.server");
    return supprimerFavori(context.userId, data.id);
  });

/* --------------------------- SIGNALEMENTS --------------------------- */

export const ownerReports = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<OwnerReport[]> => {
    const { chargerMesSignalements } = await import("@/lib/owner.server");
    return chargerMesSignalements(context.userId);
  });

export const ownerCreateReport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { number: string; reason: string; description?: string | null }) => {
    if (typeof input?.number !== "string" || typeof input?.reason !== "string") {
      throw new Error("Paramètres invalides");
    }
    return {
      number: input.number.slice(0, 32),
      reason: input.reason.slice(0, 40),
      description: input.description?.slice(0, 1000) ?? null,
    };
  })
  .handler(async ({ context, data }) => {
    const { creerSignalement } = await import("@/lib/owner.server");
    return creerSignalement(context.userId, data);
  });

/* --------------------------- PARAMÈTRES --------------------------- */

export const ownerProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { chargerMonProfil } = await import("@/lib/owner.server");
    return chargerMonProfil(context.userId);
  });

export const ownerUpdateProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { fullName: string | null; phone: string | null }) => ({
    fullName: input?.fullName?.slice(0, 120) ?? null,
    phone: input?.phone?.slice(0, 30) ?? null,
  }))
  .handler(async ({ context, data }) => {
    const { majMonProfil } = await import("@/lib/owner.server");
    return majMonProfil(context.userId, data);
  });

export const ownerDeactivateAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { confirm: string }) => {
    if (input?.confirm !== "SUPPRIMER") throw new Error("Confirmation invalide.");
    return { confirm: input.confirm };
  })
  .handler(async ({ context }) => {
    const { desactiverMonCompte } = await import("@/lib/owner.server");
    return desactiverMonCompte(context.userId);
  });

/* --------------------------- RÉCLAMATIONS --------------------------- */

export const beaconContext = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { number: string }) => {
    if (typeof input?.number !== "string") throw new Error("Numéro requis");
    return { number: input.number.slice(0, 32) };
  })
  .handler(async ({ context, data }): Promise<BeaconContext> => {
    const { chargerContexteBalise } = await import("@/lib/owner.server");
    return chargerContexteBalise(context.userId, data.number);
  });

export const createClaim = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: { number: string; explanation: string; photoBase64?: string | null }) => {
      if (typeof input?.number !== "string") throw new Error("Numéro requis");
      const explication = (input.explanation ?? "").trim();
      if (explication.length < 10) {
        throw new Error("Merci de détailler votre demande (10 caractères minimum).");
      }
      return {
        number: input.number.slice(0, 32),
        explanation: explication.slice(0, 1000),
        photoBase64: input.photoBase64 ?? null,
      };
    },
  )
  .handler(async ({ context, data }) => {
    const { creerReclamation } = await import("@/lib/owner.server");
    return creerReclamation(context.userId, data);
  });

export const myClaims = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { chargerMesReclamations } = await import("@/lib/owner.server");
    return chargerMesReclamations(context.userId);
  });
