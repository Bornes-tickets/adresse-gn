import { Link, createFileRoute, notFound } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";

import { CmsPreviewBanner, CmsPreviewEtat } from "@/components/CmsPreviewBanner";
import { CmsRichText } from "@/components/CmsRichText";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useLangueCms } from "@/hooks/useLangueCms";
import { texte, type CmsPost } from "@/lib/cms";
import { publicGetPost } from "@/lib/cms-public.functions";
import { previewGetPost } from "@/lib/cms-preview.functions";

const BASE = "https://adresse-gn.lovable.app";

export const Route = createFileRoute("/blog/$slug")({
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
  loader: async ({ params, deps }): Promise<{ article: CmsPost | null }> => {
    if (deps.preview) return { article: null };
    const article = (await publicGetPost({
      data: { slug: params.slug },
    })) as CmsPost | null;
    if (!article) throw notFound();
    return { article };
  },
  head: ({ params, loaderData }) => {
    if (!loaderData?.article) {
      return {
        meta: [
          { title: "Article indisponible — ADRESSE GN" },
          { name: "robots", content: "noindex" },
        ],
      };
    }
    const article = loaderData.article;
    const titre = texte(article.seo_title) || texte(article.title);
    const description = texte(article.seo_description) || texte(article.excerpt);
    const url = `${BASE}/blog/${params.slug}`;
    return {
      meta: [
        { title: `${titre} — ADRESSE GN` },
        { name: "description", content: description },
        { property: "og:title", content: titre },
        { property: "og:description", content: description },
        { property: "og:type", content: "article" },
        { property: "og:url", content: url },
        { name: "twitter:card", content: "summary_large_image" },
        ...(article.cover_url?.startsWith("https://")
          ? [
              { property: "og:image", content: article.cover_url },
              { name: "twitter:image", content: article.cover_url },
            ]
          : []),
      ],
      links: [{ rel: "canonical", href: url }],
      scripts: [
        {
          type: "application/ld+json",
          children: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "Article",
            headline: titre,
            description,
            datePublished: article.published_at ?? article.updated_at,
            dateModified: article.updated_at,
            mainEntityOfPage: url,
          }),
        },
      ],
    };
  },
  component: ArticleRoute,
  notFoundComponent: ArticleIntrouvable,
  errorComponent: ArticleIntrouvable,
});

function ArticleIntrouvable() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-24 text-center sm:px-6">
      <h1 className="text-display text-3xl font-extrabold text-foreground">
        Article introuvable
      </h1>
      <p className="mt-4 text-slate-500">
        Cet article n'existe pas ou n'est pas encore publié.
      </p>
      <Button className="mt-8" asChild>
        <Link to="/blog">Retour au blog</Link>
      </Button>
    </div>
  );
}

function ArticleRoute() {
  const { preview } = Route.useSearch();
  return preview ? (
    <ArticleApercu />
  ) : (
    <ArticlePublic article={Route.useLoaderData().article!} />
  );
}

function ArticleApercu() {
  const { slug } = Route.useParams();
  const charger = useServerFn(previewGetPost);
  const { data, isPending, isError } = useQuery({
    queryKey: ["cms-preview-post", slug],
    queryFn: () => charger({ data: { slug } }) as Promise<CmsPost | null>,
    staleTime: 0,
  });

  if (isPending) return <CmsPreviewEtat message="Chargement de l'aperçu…" />;
  if (isError)
    return (
      <CmsPreviewEtat message="Aperçu réservé aux administrateurs connectés au back-office." />
    );
  if (!data)
    return <CmsPreviewEtat message="Aucun article ne correspond à cet identifiant." />;

  return (
    <>
      <CmsPreviewBanner statut={data.status} retour="/admin/cms/blog" />
      <ArticlePublic article={data} />
    </>
  );
}

function ArticlePublic({ article }: { article: CmsPost }) {
  const langue = useLangueCms();
  const date = article.published_at ?? article.updated_at;

  return (
    <article className="mx-auto max-w-3xl px-4 py-14 sm:px-6 sm:py-20">
      <Link
        to="/blog"
        className="inline-flex items-center gap-2 text-sm font-medium text-accent hover:underline"
      >
        <ArrowLeft className="size-4" />
        Blog
      </Link>

      <header className="mt-6">
        {article.category && (
          <Badge variant="secondary" className="rounded-full">
            {article.category}
          </Badge>
        )}
        <h1 className="text-display mt-4 text-3xl font-extrabold leading-tight text-foreground sm:text-4xl">
          {texte(article.title, langue)}
        </h1>
        <time className="mt-3 block text-sm text-slate-400">
          {date
            ? new Date(date).toLocaleDateString(langue, {
                day: "numeric",
                month: "long",
                year: "numeric",
              })
            : ""}
        </time>
        {texte(article.excerpt, langue) && (
          <p className="mt-5 text-lg leading-relaxed text-slate-500">
            {texte(article.excerpt, langue)}
          </p>
        )}
      </header>

      {article.cover_url && (
        <img
          src={article.cover_url}
          alt={texte(article.title, langue)}
          loading="lazy"
          className="mt-8 w-full rounded-2xl border border-slate-200/60 object-cover"
        />
      )}

      <div className="mt-10">
        <CmsRichText contenu={texte(article.body, langue)} />
      </div>
    </article>
  );
}
