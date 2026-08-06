/** Fonction serveur : enregistrement d'une installation par un agent authentifié. */
import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { InstallPayload, InstallResult } from "@/lib/install.server";

export const submitInstallation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: InstallPayload) => {
    if (typeof input?.beacon_number !== "string") throw new Error("Numéro requis");
    if (!Array.isArray(input.measures) || input.measures.length !== 3) {
      throw new Error("Trois mesures GPS requises");
    }
    if (typeof input.photo_base64 !== "string" || input.photo_base64.length === 0) {
      throw new Error("Photo requise");
    }
    if (typeof input.category !== "string" || input.category.length === 0) {
      throw new Error("Catégorie requise");
    }
    if (input.visibility !== "private" && input.visibility !== "public") {
      throw new Error("Visibilité invalide");
    }
    if (input.consent !== true) throw new Error("Consentement requis");
    return {
      beacon_number: input.beacon_number.trim().toUpperCase().slice(0, 32),
      measures: input.measures.map((m) => ({
        lat: Number(m.lat),
        lng: Number(m.lng),
        accuracy_m: Number(m.accuracy_m),
        taken_at: String(m.taken_at),
      })),
      photo_base64: input.photo_base64,
      category: input.category.slice(0, 40),
      name: input.name ? String(input.name).slice(0, 160) : null,
      visibility: input.visibility,
      access_point_note: input.access_point_note
        ? String(input.access_point_note).slice(0, 500)
        : null,
      owner_name: input.owner_name ? String(input.owner_name).slice(0, 160) : null,
      owner_phone: input.owner_phone ? String(input.owner_phone).slice(0, 40) : null,
      consent: true,
    } satisfies InstallPayload;
  })
  .handler(async ({ data, context }): Promise<InstallResult> => {
    const { performInstall } = await import("@/lib/install.server");
    return performInstall(context.userId, data);
  });
