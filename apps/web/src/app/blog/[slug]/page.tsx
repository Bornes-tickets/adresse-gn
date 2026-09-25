import type {
  Metadata,
} from "next";
import Link from "next/link";
import {
  notFound,
} from "next/navigation";

import {
  getPublicCmsPost,
} from "@/features/content/api";
import {
  CmsRichText,
} from "@/features/content/rich-text";
import {
  cmsText,
} from "@/features/content/types";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{
    slug: string;
  }>;
};

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const {
    slug,
  } = await params;

  const post =
    await getPublicCmsPost(slug);

  if (!post) {
    return {
      title: "Article introuvable — Adresse GN",
      robots: {
        index: false,
        follow: false,
      },
    };
  }

  const title =
    cmsText(post.seo_title) ||
    cmsText(post.title);

  const description =
    cmsText(post.seo_description) ||
    cmsText(post.excerpt);

  return {
    title: `${title} — Adresse GN`,
    description,
  };
}

export default async function Page({
  params,
}: PageProps) {
  const {
    slug,
  } = await params;

  const post =
    await getPublicCmsPost(slug);

  if (!post) {
    notFound();
  }

  const title =
    cmsText(post.title);

  const date =
    post.published_at ??
    post.updated_at;

  return (
    <article className="mx-auto max-w-3xl px-4 py-14 sm:px-6 sm:py-20">
      <Link
        href="/blog"
        className="text-sm font-medium text-accent hover:underline"
      >
        ← Retour au blog
      </Link>

      <header className="mt-6">
        {post.category && (
          <span className="inline-flex rounded-full bg-muted px-3 py-1 text-xs font-medium">
            {post.category}
          </span>
        )}

        <h1 className="mt-4 text-3xl font-extrabold leading-tight tracking-tight text-foreground sm:text-4xl">
          {title}
        </h1>

        <time className="mt-3 block text-sm text-slate-400">
          {new Intl.DateTimeFormat(
            "fr-FR",
            {
              day: "numeric",
              month: "long",
              year: "numeric",
            },
          ).format(new Date(date))}
        </time>

        {cmsText(post.excerpt) && (
          <p className="mt-5 text-lg leading-relaxed text-muted-foreground">
            {cmsText(post.excerpt)}
          </p>
        )}
      </header>

      {post.cover_url && (
        <img
          src={post.cover_url}
          alt={title}
          loading="lazy"
          className="mt-8 w-full rounded-2xl border object-cover"
        />
      )}

      <div className="mt-10">
        <CmsRichText
          content={cmsText(post.body)}
        />
      </div>
    </article>
  );
}
