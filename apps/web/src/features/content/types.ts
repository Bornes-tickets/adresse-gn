export type CmsLanguage =
  | "fr"
  | "en"
  | "ar";

export type CmsMultiText =
  Partial<Record<CmsLanguage, string>>;

export type PublicCmsPage = {
  id: string;
  slug: string;
  status: "published";
  title: CmsMultiText;
  excerpt: CmsMultiText;
  body: CmsMultiText;
  seo_title: CmsMultiText;
  seo_description: CmsMultiText;
  cover_url: string | null;
  position: number;
  published_at: string | null;
  updated_at: string;
};

export type PublicCmsPageResponse = {
  item: PublicCmsPage;
};

export function cmsText(
  value: CmsMultiText | null | undefined,
  language: CmsLanguage = "fr",
): string {
  if (!value) {
    return "";
  }

  return (
    value[language] ??
    value.fr ??
    value.en ??
    value.ar ??
    ""
  );
}

export type PublicCmsFaq = {
  id: string;
  category: string | null;
  question: CmsMultiText;
  answer: CmsMultiText;
  position: number;
  published: true;
  updated_at: string;
};

export type PublicCmsFaqResponse = {
  items: PublicCmsFaq[];
  count: number;
};

export type PublicCmsPostSummary = {
  id: string;
  slug: string;
  status: "published";
  category: string | null;
  cover_url: string | null;
  title: CmsMultiText;
  excerpt: CmsMultiText;
  seo_title: CmsMultiText;
  seo_description: CmsMultiText;
  published_at: string | null;
  updated_at: string;
};

export type PublicCmsPost = PublicCmsPostSummary & {
  body: CmsMultiText;
};

export type PublicCmsPostsResponse = {
  items: PublicCmsPostSummary[];
  count: number;
};

export type PublicCmsPostResponse = {
  item: PublicCmsPost;
};
