/** Points d'entrée serveur du module CMS. Chaque handler vérifie le rôle admin. */
import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const id = (input: { id: string }) => ({ id: String(input?.id ?? "") });
const brut = (input: Record<string, unknown>) => input ?? {};

/* ------------------------------- PAGES ------------------------------- */

export const cmsListPages = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { requireAdmin } = await import("@/lib/admin.server");
    const { listerPages } = await import("@/lib/cms.server");
    await requireAdmin(context.userId);
    return listerPages();
  });

export const cmsSavePage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(brut)
  .handler(async ({ context, data }) => {
    const { requireAdmin } = await import("@/lib/admin.server");
    const { enregistrerPage } = await import("@/lib/cms.server");
    await requireAdmin(context.userId);
    return enregistrerPage(data as never, context.userId);
  });

export const cmsDeletePage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(id)
  .handler(async ({ context, data }) => {
    const { requireAdmin } = await import("@/lib/admin.server");
    const { supprimerPage } = await import("@/lib/cms.server");
    await requireAdmin(context.userId);
    return supprimerPage(data.id);
  });

/* -------------------------------- BLOG ------------------------------- */

export const cmsListPosts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { requireAdmin } = await import("@/lib/admin.server");
    const { listerArticles } = await import("@/lib/cms.server");
    await requireAdmin(context.userId);
    return listerArticles();
  });

export const cmsSavePost = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(brut)
  .handler(async ({ context, data }) => {
    const { requireAdmin } = await import("@/lib/admin.server");
    const { enregistrerArticle } = await import("@/lib/cms.server");
    await requireAdmin(context.userId);
    return enregistrerArticle(data as never, context.userId);
  });

export const cmsDeletePost = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(id)
  .handler(async ({ context, data }) => {
    const { requireAdmin } = await import("@/lib/admin.server");
    const { supprimerArticle } = await import("@/lib/cms.server");
    await requireAdmin(context.userId);
    return supprimerArticle(data.id);
  });

/* --------------------------------- FAQ ------------------------------- */

export const cmsListFaq = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { requireAdmin } = await import("@/lib/admin.server");
    const { listerFaq } = await import("@/lib/cms.server");
    await requireAdmin(context.userId);
    return listerFaq();
  });

export const cmsSaveFaq = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(brut)
  .handler(async ({ context, data }) => {
    const { requireAdmin } = await import("@/lib/admin.server");
    const { enregistrerFaq } = await import("@/lib/cms.server");
    await requireAdmin(context.userId);
    return enregistrerFaq(data as never);
  });

export const cmsDeleteFaq = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(id)
  .handler(async ({ context, data }) => {
    const { requireAdmin } = await import("@/lib/admin.server");
    const { supprimerFaq } = await import("@/lib/cms.server");
    await requireAdmin(context.userId);
    return supprimerFaq(data.id);
  });

/* ---------------------------- TRADUCTIONS ---------------------------- */

export const cmsListTranslations = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { requireAdmin } = await import("@/lib/admin.server");
    const { listerTraductions } = await import("@/lib/cms.server");
    await requireAdmin(context.userId);
    return listerTraductions();
  });

export const cmsSaveTranslation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(brut)
  .handler(async ({ context, data }) => {
    const { requireAdmin } = await import("@/lib/admin.server");
    const { enregistrerTraduction } = await import("@/lib/cms.server");
    await requireAdmin(context.userId);
    return enregistrerTraduction(data as never);
  });

export const cmsDeleteTranslation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(id)
  .handler(async ({ context, data }) => {
    const { requireAdmin } = await import("@/lib/admin.server");
    const { supprimerTraduction } = await import("@/lib/cms.server");
    await requireAdmin(context.userId);
    return supprimerTraduction(data.id);
  });

/* ------------------------------- TARIFS ------------------------------ */

export const cmsListPlans = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { requireAdmin } = await import("@/lib/admin.server");
    const { listerOffres } = await import("@/lib/cms.server");
    await requireAdmin(context.userId);
    return listerOffres();
  });

export const cmsSavePlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(brut)
  .handler(async ({ context, data }) => {
    const { requireAdmin } = await import("@/lib/admin.server");
    const { enregistrerOffre } = await import("@/lib/cms.server");
    await requireAdmin(context.userId);
    return enregistrerOffre(data as never);
  });

export const cmsDeletePlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(id)
  .handler(async ({ context, data }) => {
    const { requireAdmin } = await import("@/lib/admin.server");
    const { supprimerOffre } = await import("@/lib/cms.server");
    await requireAdmin(context.userId);
    return supprimerOffre(data.id);
  });

/* ------------------------------ SYNTHÈSE ----------------------------- */

export const cmsStats = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { requireAdmin } = await import("@/lib/admin.server");
    const { statistiquesCms } = await import("@/lib/cms.server");
    await requireAdmin(context.userId);
    return statistiquesCms();
  });
