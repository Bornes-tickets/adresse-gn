import { cache } from "react";

import type {
  PublicCmsPage,
  PublicCmsPageResponse,
} from "./types";

const API_BASE_URL = (
  process.env.NEXT_PUBLIC_API_URL ??
  "http://127.0.0.1:8000"
).replace(/\/$/, "");

export const getPublicCmsPage = cache(
  async (
    slug: string,
  ): Promise<PublicCmsPage | null> => {
    let response: Response;

    try {
      response = await fetch(
        `${API_BASE_URL}/api/v1/public/content/pages/${encodeURIComponent(
          slug,
        )}/`,
        {
          method: "GET",
          headers: {
            Accept: "application/json",
          },
          cache: "no-store",
        },
      );
    } catch {
      throw new Error(
        "Impossible de joindre le service de contenu Adresse GN.",
      );
    }

    if (response.status === 404) {
      return null;
    }

    if (!response.ok) {
      throw new Error(
        "Le service de contenu Adresse GN a retourné une erreur.",
      );
    }

    const payload =
      (await response.json()) as PublicCmsPageResponse;

    return payload.item ?? null;
  },
);

export const getPublicCmsFaq = cache(
  async (): Promise<
    import("./types").PublicCmsFaq[]
  > => {
    let response: Response;

    try {
      response = await fetch(
        `${API_BASE_URL}/api/v1/public/content/faq/`,
        {
          method: "GET",
          headers: {
            Accept: "application/json",
          },
          cache: "no-store",
        },
      );
    } catch {
      throw new Error(
        "Impossible de joindre le service FAQ Adresse GN.",
      );
    }

    if (!response.ok) {
      throw new Error(
        "Le service FAQ Adresse GN a retourné une erreur.",
      );
    }

    const payload =
      (await response.json()) as import("./types").PublicCmsFaqResponse;

    return payload.items ?? [];
  },
);

export const getPublicCmsPosts = cache(
  async (): Promise<
    import("./types").PublicCmsPostSummary[]
  > => {
    let response: Response;

    try {
      response = await fetch(
        `${API_BASE_URL}/api/v1/public/content/posts/`,
        {
          method: "GET",
          headers: {
            Accept: "application/json",
          },
          cache: "no-store",
        },
      );
    } catch {
      throw new Error(
        "Impossible de joindre le service Blog Adresse GN.",
      );
    }

    if (!response.ok) {
      throw new Error(
        "Le service Blog Adresse GN a retourné une erreur.",
      );
    }

    const payload =
      (await response.json()) as import("./types").PublicCmsPostsResponse;

    return payload.items ?? [];
  },
);

export const getPublicCmsPost = cache(
  async (
    slug: string,
  ): Promise<
    import("./types").PublicCmsPost | null
  > => {
    let response: Response;

    try {
      response = await fetch(
        `${API_BASE_URL}/api/v1/public/content/posts/${encodeURIComponent(
          slug,
        )}/`,
        {
          method: "GET",
          headers: {
            Accept: "application/json",
          },
          cache: "no-store",
        },
      );
    } catch {
      throw new Error(
        "Impossible de joindre le service Blog Adresse GN.",
      );
    }

    if (response.status === 404) {
      return null;
    }

    if (!response.ok) {
      throw new Error(
        "Le service Blog Adresse GN a retourné une erreur.",
      );
    }

    const payload =
      (await response.json()) as import("./types").PublicCmsPostResponse;

    return payload.item ?? null;
  },
);
