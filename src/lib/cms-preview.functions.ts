/** Aperçu admin des contenus CMS non publiés (pages, articles, FAQ). */
import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { CmsFaq, CmsPage, CmsPost } from "@/lib/cms";

const slugValidator = (input: { slug: string }) => {
  const slug = String(input?.slug ?? "").slice(0, 120);
  if (!/^[a-z0-9-]+$/.test(slug)) throw new Error("Slug invalide");
  return { slug };
};

export const previewGetPage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(slugValidator)
  .handler(async ({ context, data }): Promise<CmsPage | null> => {
    const { requireAdmin } = await import("@/lib/admin.server");
    const { pageParSlug } = await import("@/lib/cms.server");
    await requireAdmin(context.userId);
    return pageParSlug(data.slug);
  });

export const previewGetPost = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(slugValidator)
  .handler(async ({ context, data }): Promise<CmsPost | null> => {
    const { requireAdmin } = await import("@/lib/admin.server");
    const { articleParSlug } = await import("@/lib/cms.server");
    await requireAdmin(context.userId);
    return articleParSlug(data.slug);
  });

export const previewListFaq = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<CmsFaq[]> => {
    const { requireAdmin } = await import("@/lib/admin.server");
    const { listerFaq } = await import("@/lib/cms.server");
    await requireAdmin(context.userId);
    return listerFaq();
  });
