import { Link, createFileRoute } from "@tanstack/react-router";

import { Reveal } from "@/components/Reveal";
import { Badge } from "@/components/ui/badge";
import { useLangueCms } from "@/hooks/useLangueCms";
import { texte, type CmsPost } from "@/lib/cms";
import { publicListPosts } from "@/lib/cms-public.functions";

const BASE = "https://adresse-gn.lovable.app";

export const Route = createFileRoute("/blog/")({
  loader: async (): Promise<{ articles: CmsPost[] }> => ({
    articles: (await publicListPosts()) as CmsPost[],
  }),
  head: () => ({
    meta: [
      { title: "Blog — ADRESSE GN" },
      {
        name: "description",
        content:
          "Actualités, guides et coulisses de l'adressage en Guinée : déploiement des balises, conseils aux commerces et nouveautés Adresse GN.",
      },
      { property: "og:title", content: "Blog — ADRESSE GN" },
      {
        property: "og:description",
        content:
          "Actualités et guides sur l'adressage guinéen, publiés par l'équipe Adresse GN.",
      },
      { property: "og:type", content: "website" },
      { property: "og:url", content: `${BASE}/blog` },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [{ rel: "canonical", href: `${BASE}/blog` }],
  }),
  component: BlogIndex,
  errorComponent: BlogVide,
  notFoundComponent: BlogVide,
});

function BlogVide() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-24 text-center sm:px-6">
      <h1 className="text-display text-3xl font-extrabold text-foreground">Blog</h1>
      <p className="mt-4 text-slate-500">Aucun article disponible pour le moment.</p>
    </div>
  );
}

function dateCourte(valeur: string | null, langue: string): string {
  if (!valeur) return "";
  return new Date(valeur).toLocaleDateString(langue, {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function BlogIndex() {
  const { articles } = Route.useLoaderData() as { articles: CmsPost[] };
  const langue = useLangueCms();

  return (
    <div>
      <section className="gradient-signature relative overflow-hidden px-4 py-16 sm:px-6 sm:py-20">
        <div
          aria-hidden="true"
          className="dot-grid pointer-events-none absolute inset-0 text-white opacity-[0.06]"
        />
        <header className="relative mx-auto max-w-3xl text-center">
          <h1 className="text-display text-4xl font-extrabold leading-tight text-white sm:text-5xl">
            Blog
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-base leading-relaxed text-white/75">
            Actualités, guides et coulisses de l'adressage en Guinée.
          </p>
        </header>
      </section>

      <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6 sm:py-20">
        {articles.length === 0 ? (
          <p className="text-center text-slate-500">
            Aucun article disponible pour le moment.
          </p>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {articles.map((article, index) => (
              <Reveal key={article.id} delay={index * 70} className="h-full">
                <Link
                  to="/blog/$slug"
                  params={{ slug: article.slug }}
                  search={{}}
                  className="flex h-full flex-col overflow-hidden rounded-2xl border border-slate-200/60 bg-card transition-all duration-200 hover:-translate-y-1 hover:shadow-brand"
                >
                  {article.cover_url ? (
                    <img
                      src={article.cover_url}
                      alt={texte(article.title, langue)}
                      loading="lazy"
                      className="aspect-16/9 w-full object-cover"
                    />
                  ) : (
                    <div className="gradient-signature aspect-16/9 w-full" />
                  )}
                  <div className="flex flex-1 flex-col p-6">
                    {article.category && (
                      <Badge variant="secondary" className="w-fit rounded-full">
                        {article.category}
                      </Badge>
                    )}
                    <h2 className="text-display mt-3 text-lg font-bold text-foreground">
                      {texte(article.title, langue)}
                    </h2>
                    <p className="mt-2 flex-1 text-sm leading-relaxed text-slate-500">
                      {texte(article.excerpt, langue)}
                    </p>
                    <time className="mt-4 text-xs text-slate-400">
                      {dateCourte(article.published_at ?? article.updated_at, langue)}
                    </time>
                  </div>
                </Link>
              </Reveal>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
