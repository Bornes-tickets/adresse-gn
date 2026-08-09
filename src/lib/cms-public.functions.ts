/** Fonctions serveur publiques du CMS : pages, blog, FAQ, tarifs. Aucun jeton requis. */
import { createServerFn } from "@tanstack/react-start";

import type { CmsFaq, CmsPage, CmsPlan, CmsPost } from "@/lib/cms";

const slugValidator = (input: { slug: string }) => {
  const slug = String(input?.slug ?? "").slice(0, 120);
  if (!/^[a-z0-9-]+$/.test(slug)) throw new Error("Slug invalide");
  return { slug };
};

export const publicListPages = createServerFn({ method: "GET" }).handler(
  async (): Promise<CmsPage[]> => {
    const { listerPagesPubliees } = await import("@/lib/cms-public.server");
    return listerPagesPubliees();
  },
);

export const publicGetPage = createServerFn({ method: "GET" })
  .inputValidator(slugValidator)
  .handler(async ({ data }): Promise<CmsPage | null> => {
    const { pagePubliee } = await import("@/lib/cms-public.server");
    return pagePubliee(data.slug);
  });

export const publicListPosts = createServerFn({ method: "GET" }).handler(
  async (): Promise<CmsPost[]> => {
    const { listerArticlesPublies } = await import("@/lib/cms-public.server");
    return listerArticlesPublies();
  },
);

export const publicGetPost = createServerFn({ method: "GET" })
  .inputValidator(slugValidator)
  .handler(async ({ data }): Promise<CmsPost | null> => {
    const { articlePublie } = await import("@/lib/cms-public.server");
    return articlePublie(data.slug);
  });

export const publicListFaq = createServerFn({ method: "GET" }).handler(
  async (): Promise<CmsFaq[]> => {
    const { listerFaqPubliee } = await import("@/lib/cms-public.server");
    return listerFaqPubliee();
  },
);

export const publicListPlans = createServerFn({ method: "GET" }).handler(
  async (): Promise<CmsPlan[]> => {
    const { listerOffresActives } = await import("@/lib/cms-public.server");
    return listerOffresActives();
  },
);
