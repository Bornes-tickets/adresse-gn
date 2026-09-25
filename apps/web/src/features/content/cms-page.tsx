import Image from "next/image";

import {
  CmsRichText,
} from "./rich-text";
import {
  cmsText,
  type PublicCmsPage,
} from "./types";

export function CmsPage({
  page,
}: {
  page: PublicCmsPage;
}) {
  const title = cmsText(page.title);
  const excerpt = cmsText(page.excerpt);
  const body = cmsText(page.body);

  return (
    <article>
      <section className="relative overflow-hidden bg-gradient-to-br from-slate-950 via-[#11284a] to-[#0B7F7E] px-4 py-16 sm:px-6 sm:py-20">
        <header className="relative mx-auto max-w-3xl text-center">
          <h1 className="text-3xl font-extrabold leading-tight tracking-tight text-white sm:text-4xl">
            {title}
          </h1>

          {excerpt && (
            <p className="mx-auto mt-5 max-w-2xl text-base leading-relaxed text-white/75">
              {excerpt}
            </p>
          )}
        </header>
      </section>

      <div className="mx-auto max-w-3xl px-4 py-14 sm:px-6 sm:py-20">
        {page.cover_url && (
          <div className="relative mb-10 aspect-[16/9] w-full overflow-hidden rounded-2xl border border-slate-200/60">
            <Image
              src={page.cover_url}
              alt={title}
              fill
              sizes="(max-width: 768px) 100vw, 768px"
              className="object-cover"
            />
          </div>
        )}

        <CmsRichText content={body} />
      </div>
    </article>
  );
}
