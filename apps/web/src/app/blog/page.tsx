import type {
  Metadata,
} from "next";
import Link from "next/link";

import {
  getPublicCmsPosts,
} from "@/features/content/api";
import {
  cmsText,
} from "@/features/content/types";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Blog — Adresse GN",
  description:
    "Actualités, guides et informations publiés par Adresse GN.",
};

function formatDate(
  value: string | null,
): string {
  if (!value) {
    return "";
  }

  return new Intl.DateTimeFormat(
    "fr-FR",
    {
      day: "numeric",
      month: "long",
      year: "numeric",
    },
  ).format(new Date(value));
}

export default async function Page() {
  const posts =
    await getPublicCmsPosts();

  return (
    <main>
      <section className="relative overflow-hidden bg-gradient-to-br from-slate-950 via-[#11284a] to-[#0B7F7E] px-4 py-16 sm:px-6 sm:py-20">
        <header className="relative mx-auto max-w-3xl text-center">
          <h1 className="text-4xl font-extrabold leading-tight tracking-tight text-white sm:text-5xl">
            Blog
          </h1>

          <p className="mx-auto mt-5 max-w-2xl text-base leading-relaxed text-white/75">
            Actualités, guides et coulisses d’Adresse GN.
          </p>
        </header>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-14 sm:px-6 sm:py-20">
        {posts.length === 0 ? (
          <p className="text-center text-muted-foreground">
            Aucun article publié pour le moment.
          </p>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {posts.map((post) => {
              const title =
                cmsText(post.title);

              return (
                <Link
                  key={post.id}
                  href={`/blog/${encodeURIComponent(
                    post.slug,
                  )}`}
                  className="flex h-full flex-col overflow-hidden rounded-2xl border bg-card transition-transform hover:-translate-y-1 hover:shadow-lg"
                >
                  {post.cover_url ? (
                    <img
                      src={post.cover_url}
                      alt={title}
                      loading="lazy"
                      className="aspect-video w-full object-cover"
                    />
                  ) : (
                    <div className="aspect-video w-full bg-gradient-to-br from-slate-900 to-[#0B7F7E]" />
                  )}

                  <div className="flex flex-1 flex-col p-6">
                    {post.category && (
                      <span className="w-fit rounded-full bg-muted px-3 py-1 text-xs font-medium">
                        {post.category}
                      </span>
                    )}

                    <h2 className="mt-3 text-xl font-bold text-foreground">
                      {title}
                    </h2>

                    <p className="mt-2 flex-1 text-sm leading-6 text-muted-foreground">
                      {cmsText(post.excerpt)}
                    </p>

                    <time className="mt-5 text-xs text-slate-400">
                      {formatDate(
                        post.published_at ??
                          post.updated_at,
                      )}
                    </time>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </section>
    </main>
  );
}
