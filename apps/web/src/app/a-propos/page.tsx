import type {
  Metadata,
} from "next";
import {
  notFound,
} from "next/navigation";

import {
  getPublicCmsPage,
} from "@/features/content/api";
import {
  CmsPage,
} from "@/features/content/cms-page";
import {
  cmsText,
} from "@/features/content/types";

const SLUG = "a-propos";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const page =
    await getPublicCmsPage(SLUG);

  if (!page) {
    return {
      title: "Page indisponible — Adresse GN",
      robots: {
        index: false,
        follow: false,
      },
    };
  }

  const title =
    cmsText(page.seo_title) ||
    cmsText(page.title);

  const description =
    cmsText(page.seo_description) ||
    cmsText(page.excerpt);

  return {
    title: `${title} — Adresse GN`,
    description,
  };
}

export default async function Page() {
  const page =
    await getPublicCmsPage(SLUG);

  if (!page) {
    notFound();
  }

  return <CmsPage page={page} />;
}
