/**
 * Lectures publiques du CMS (contenus publiés uniquement).
 * Utilise la clé publiable : les policies RLS `*_public_read` s'appliquent.
 * Fichier bloqué des bundles navigateur (*.server.ts).
 */
import { createClient } from "@supabase/supabase-js";

import type { CmsFaq, CmsPage, CmsPlan, CmsPost } from "@/lib/cms";

function client() {
  const url = process.env["SUPABASE_URL"] ?? process.env["VITE_SUPABASE_URL"];
  const key =
    process.env["SUPABASE_PUBLISHABLE_KEY"] ??
    process.env["VITE_SUPABASE_PUBLISHABLE_KEY"] ??
    process.env["SUPABASE_ANON_KEY"];
  if (!url || !key) {
    throw new Error(
      "Configuration Supabase publique manquante (SUPABASE_URL / SUPABASE_PUBLISHABLE_KEY).",
    );
  }
  return createClient(url, key, {
    auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
  }) as unknown as { from: (table: string) => any };
}

function verifier(error: { message: string } | null) {
  if (error) throw new Error(error.message);
}

const CHAMPS_PAGE =
  "id, slug, status, title, excerpt, body, seo_title, seo_description, cover_url, position, published_at, updated_at";
const CHAMPS_ARTICLE =
  "id, slug, status, category, cover_url, title, excerpt, body, seo_title, seo_description, published_at, updated_at";

/* -------------------------------- PAGES ------------------------------- */

export async function listerPagesPubliees(): Promise<CmsPage[]> {
  const { data, error } = await client()
    .from("cms_pages")
    .select(CHAMPS_PAGE)
    .eq("status", "published")
    .order("position", { ascending: true });
  verifier(error);
  return (data ?? []) as CmsPage[];
}

export async function pagePubliee(slug: string): Promise<CmsPage | null> {
  const { data, error } = await client()
    .from("cms_pages")
    .select(CHAMPS_PAGE)
    .eq("status", "published")
    .eq("slug", slug)
    .maybeSingle();
  verifier(error);
  return (data ?? null) as CmsPage | null;
}

/* --------------------------------- BLOG ------------------------------- */

export async function listerArticlesPublies(): Promise<CmsPost[]> {
  const { data, error } = await client()
    .from("cms_posts")
    .select(CHAMPS_ARTICLE)
    .eq("status", "published")
    .order("published_at", { ascending: false, nullsFirst: false })
    .order("updated_at", { ascending: false });
  verifier(error);
  return (data ?? []) as CmsPost[];
}

export async function articlePublie(slug: string): Promise<CmsPost | null> {
  const { data, error } = await client()
    .from("cms_posts")
    .select(CHAMPS_ARTICLE)
    .eq("status", "published")
    .eq("slug", slug)
    .maybeSingle();
  verifier(error);
  return (data ?? null) as CmsPost | null;
}

/* ---------------------------------- FAQ ------------------------------- */

export async function listerFaqPubliee(): Promise<CmsFaq[]> {
  const { data, error } = await client()
    .from("cms_faq")
    .select("id, category, question, answer, position, published, updated_at")
    .eq("published", true)
    .order("position", { ascending: true });
  verifier(error);
  return (data ?? []) as CmsFaq[];
}

/* -------------------------------- TARIFS ------------------------------ */

export async function listerOffresActives(): Promise<CmsPlan[]> {
  const { data, error } = await client()
    .from("cms_plans")
    .select(
      "id, code, name, description, features, price_gnf, period, popular, active, position, updated_at",
    )
    .eq("active", true)
    .order("position", { ascending: true });
  verifier(error);
  return (data ?? []) as CmsPlan[];
}
