import { Link, createFileRoute, notFound } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";

import { CmsPreviewBanner, CmsPreviewEtat } from "@/components/CmsPreviewBanner";
import { CmsRichText } from "@/components/CmsRichText";
import { Button } from "@/components/ui/button";
import { useLangueCms } from "@/hooks/useLangueCms";
import { texte, type CmsPage } from "@/lib/cms";
import { publicGetPage } from "@/lib/cms-public.functions";
import { previewGetPage } from "@/lib/cms-preview.functions";

const BASE = "https://adresse-gn.lovable.app";

export const Route = createFileRoute("/p/$slug")({
  validateSearch: (search: Record<string, unknown>) => ({
    preview:
      search['preview'] === true ||
      search['preview'] === 1 ||
      search['preview'] === "1" ||
      search['preview'] === "true"
        ? true
        : undefined,
  }),
  loaderDeps: ({ search }) => ({ preview: !!search.preview }),
  loader: async ({ params, deps }): Promise<{ page: CmsPage | null }> => {
    if (deps.preview) return { page: null };
    const page = (await publicGetPage({ data: { slug: params.slug } })) as CmsPage | null;
    if (!page) throw notFound();
    return { page };
  },
  head: ({ params, loaderData }) => {
    if (!loaderData?.page) {
      return {
        meta: [{ title: "Page indisponible — ADRESSE GN" }, { name: "robots", content: "noindex" }],
      };
    }
    const page = loaderData.page;
    const titre = texte(page.seo_title) || texte(page.title);
    const description = texte(page.seo_description) || texte(page.excerpt);
    const url = `${BASE}/p/${params.slug}`;
    return {
      meta: [
        { title: `${titre} — ADRESSE GN` },
        { name: "description", content: description },
        { property: "og:title", content: titre },
        { property: "og:description", content: description },
        { property: "og:type", content: "article" },
        { property: "og:url", content: url },
        { name: "twitter:card", content: "summary_large_image" },
        ...(page.cover_url?.startsWith("https://")
          ? [
              { property: "og:image", content: page.cover_url },
              { name: "twitter:image", content: page.cover_url },
            ]
          : []),
      ],
      links: [{ rel: "canonical", href: url }],
    };
  },
  component: PageRoute,
  notFoundComponent: PageIntrouvable,
  errorComponent: PageIntrouvable,
});

function PageIntrouvable() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-24 text-center sm:px-6">
      <h1 className="text-display text-3xl font-extrabold text-foreground">
        Page introuvable
      </h1>
      <p className="mt-4 text-slate-500">
        Cette page n'existe pas ou n'est pas encore publiée.
      </p>
      <Button className="mt-8" asChild>
        <Link to="/">Retour à l'accueil</Link>
      </Button>
    </div>
  );
}

function PageRoute() {
  const { preview } = Route.useSearch();
  return preview ? <PageApercu /> : <PagePublique page={Route.useLoaderData().page!} />;
}

function PageApercu() {
  const { slug } = Route.useParams();
  const charger = useServerFn(previewGetPage);
  const { data, isPending, isError } = useQuery({
    queryKey: ["cms-preview-page", slug],
    queryFn: () => charger({ data: { slug } }) as Promise<CmsPage | null>,
    staleTime: 0,
  });

  if (isPending) return <CmsPreviewEtat message="Chargement de l'aperçu…" />;
  if (isError)
    return (
      <CmsPreviewEtat message="Aperçu réservé aux administrateurs connectés au back-office." />
    );
  if (!data) return <CmsPreviewEtat message="Aucune page ne correspond à cet identifiant." />;

  return (
    <>
      <CmsPreviewBanner statut={data.status} retour="/admin/cms/pages" />
      <PagePublique page={data} />
    </>
  );
}

function PagePublique({ page }: { page: CmsPage }) {
  const langue = useLangueCms();

  return (
    <article>
      <section className="gradient-signature relative overflow-hidden px-4 py-16 sm:px-6 sm:py-20">
        <div
          aria-hidden="true"
          className="dot-grid pointer-events-none absolute inset-0 text-white opacity-[0.06]"
        />
        <header className="relative mx-auto max-w-3xl text-center">
          <h1 className="text-display text-3xl font-extrabold leading-tight text-white sm:text-4xl">
            {texte(page.title, langue)}
          </h1>
          {texte(page.excerpt, langue) && (
            <p className="mx-auto mt-5 max-w-2xl text-base leading-relaxed text-white/75">
              {texte(page.excerpt, langue)}
            </p>
          )}
        </header>
      </section>

      <div className="mx-auto max-w-3xl px-4 py-14 sm:px-6 sm:py-20">
        {page.cover_url && (
          <img
            src={page.cover_url}
            alt={texte(page.title, langue)}
            loading="lazy"
            className="mb-10 w-full rounded-2xl border border-slate-200/60 object-cover"
          />
        )}
        <CmsRichText contenu={texte(page.body, langue)} />
      </div>
    </article>
  );
}
