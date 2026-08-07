/** Points d'entrée serveur pour les justificatifs d'installation (back-office). */
import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const KINDS = ["photo", "recu", "attestation", "autre"] as const;
const STATUTS = ["pending", "approved", "rejected"] as const;

export const adminInstallDocsQueue = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input?: { statut?: string | null }) => ({ statut: input?.statut ?? null }))
  .handler(async ({ context, data }) => {
    const { requireAdmin } = await import("@/lib/admin.server");
    const { listerInstallationsAvecDocs } = await import("@/lib/install-docs.server");
    await requireAdmin(context.userId);
    return listerInstallationsAvecDocs({ statut: data.statut });
  });

export const adminInstallDocs = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { pendingId: string }) => ({ pendingId: String(input.pendingId) }))
  .handler(async ({ context, data }) => {
    const { requireAdmin } = await import("@/lib/admin.server");
    const { listerDocs } = await import("@/lib/install-docs.server");
    await requireAdmin(context.userId);
    return listerDocs(data.pendingId);
  });

export const adminUploadInstallDoc = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      pendingId: string;
      kind: string;
      label?: string | null;
      mimeType: string;
      base64: string;
    }) => {
      const kind = KINDS.includes(input.kind as never) ? (input.kind as (typeof KINDS)[number]) : "autre";
      const label = input.label ? String(input.label).slice(0, 120) : null;
      if (!input.base64) throw new Error("Fichier manquant.");
      return {
        pendingId: String(input.pendingId),
        kind,
        label,
        mimeType: String(input.mimeType),
        base64: String(input.base64),
      };
    },
  )
  .handler(async ({ context, data }) => {
    const { requireAdmin } = await import("@/lib/admin.server");
    const { ajouterDoc } = await import("@/lib/install-docs.server");
    await requireAdmin(context.userId);
    return ajouterDoc({ ...data, actorId: context.userId });
  });

export const adminReviewInstallDoc = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { docId: string; statut: string; note?: string | null }) => {
    if (!STATUTS.includes(input.statut as never)) throw new Error("Statut invalide.");
    return {
      docId: String(input.docId),
      statut: input.statut as (typeof STATUTS)[number],
      note: input.note ? String(input.note).slice(0, 500) : null,
    };
  })
  .handler(async ({ context, data }) => {
    const { requireAdmin } = await import("@/lib/admin.server");
    const { statuerDoc } = await import("@/lib/install-docs.server");
    await requireAdmin(context.userId);
    return statuerDoc({ ...data, actorId: context.userId });
  });

export const adminDeleteInstallDoc = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { docId: string }) => ({ docId: String(input.docId) }))
  .handler(async ({ context, data }) => {
    const { requireAdmin } = await import("@/lib/admin.server");
    const { supprimerDoc } = await import("@/lib/install-docs.server");
    await requireAdmin(context.userId);
    return supprimerDoc({ docId: data.docId, actorId: context.userId });
  });
