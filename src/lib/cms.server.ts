/**
 * Couche serveur du module CMS (pages, blog, FAQ, traductions, tarifs).
 * Fichier bloqué des bundles navigateur (*.server.ts).
 */
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type {
  CmsFaq,
  CmsPage,
  CmsPlan,
  CmsPost,
  CmsTranslation,
} from "@/lib/cms";

// Les tables CMS peuvent être plus récentes que les types générés.
const db = supabaseAdmin as unknown as {
  from: (table: string) => any;
};

function verifier(error: { message: string } | null) {
  if (error) throw new Error(error.message);
}

/* ------------------------------- PAGES ------------------------------- */

export async function listerPages(): Promise<CmsPage[]> {
  const { data, error } = await db
    .from("cms_pages")
    .select("*")
    .order("position", { ascending: true })
    .order("updated_at", { ascending: false });
  verifier(error);
  return (data ?? []) as CmsPage[];
}

export interface EntreePage {
  id?: string | null;
  slug: string;
  status: string;
  title: Record<string, string>;
  excerpt: Record<string, string>;
  body: Record<string, string>;
  seo_title: Record<string, string>;
  seo_description: Record<string, string>;
  cover_url?: string | null;
  position?: number;
}

export async function enregistrerPage(entree: EntreePage, auteur: string) {
  if (!entree.slug) throw new Error("L'identifiant d'URL (slug) est obligatoire.");
  const ligne = {
    slug: entree.slug,
    status: entree.status,
    title: entree.title,
    excerpt: entree.excerpt,
    body: entree.body,
    seo_title: entree.seo_title,
    seo_description: entree.seo_description,
    cover_url: entree.cover_url ?? null,
    position: entree.position ?? 0,
    published_at: entree.status === "published" ? new Date().toISOString() : null,
  };

  if (entree.id) {
    const { error } = await db.from("cms_pages").update(ligne).eq("id", entree.id);
    verifier(error);
    return { id: entree.id };
  }
  const { data, error } = await db
    .from("cms_pages")
    .insert({ ...ligne, created_by: auteur })
    .select("id")
    .single();
  verifier(error);
  return { id: data.id as string };
}

export async function supprimerPage(id: string) {
  const { error } = await db.from("cms_pages").delete().eq("id", id);
  verifier(error);
  return { ok: true };
}

/* -------------------------------- BLOG ------------------------------- */

export async function listerArticles(): Promise<CmsPost[]> {
  const { data, error } = await db
    .from("cms_posts")
    .select("*")
    .order("published_at", { ascending: false, nullsFirst: false })
    .order("updated_at", { ascending: false });
  verifier(error);
  return (data ?? []) as CmsPost[];
}

export interface EntreeArticle extends EntreePage {
  category?: string | null;
}

export async function enregistrerArticle(entree: EntreeArticle, auteur: string) {
  if (!entree.slug) throw new Error("L'identifiant d'URL (slug) est obligatoire.");
  const ligne = {
    slug: entree.slug,
    status: entree.status,
    category: entree.category ?? null,
    cover_url: entree.cover_url ?? null,
    title: entree.title,
    excerpt: entree.excerpt,
    body: entree.body,
    seo_title: entree.seo_title,
    seo_description: entree.seo_description,
    published_at: entree.status === "published" ? new Date().toISOString() : null,
  };

  if (entree.id) {
    const { error } = await db.from("cms_posts").update(ligne).eq("id", entree.id);
    verifier(error);
    return { id: entree.id };
  }
  const { data, error } = await db
    .from("cms_posts")
    .insert({ ...ligne, created_by: auteur })
    .select("id")
    .single();
  verifier(error);
  return { id: data.id as string };
}

export async function supprimerArticle(id: string) {
  const { error } = await db.from("cms_posts").delete().eq("id", id);
  verifier(error);
  return { ok: true };
}

/* --------------------------------- FAQ ------------------------------- */

export async function listerFaq(): Promise<CmsFaq[]> {
  const { data, error } = await db
    .from("cms_faq")
    .select("*")
    .order("position", { ascending: true });
  verifier(error);
  return (data ?? []) as CmsFaq[];
}

export interface EntreeFaq {
  id?: string | null;
  category?: string | null;
  question: Record<string, string>;
  answer: Record<string, string>;
  position?: number;
  published?: boolean;
}

export async function enregistrerFaq(entree: EntreeFaq) {
  const ligne = {
    category: entree.category ?? null,
    question: entree.question,
    answer: entree.answer,
    position: entree.position ?? 0,
    published: entree.published ?? true,
  };
  if (!ligne.question['fr']) throw new Error("La question en français est obligatoire.");

  if (entree.id) {
    const { error } = await db.from("cms_faq").update(ligne).eq("id", entree.id);
    verifier(error);
    return { id: entree.id };
  }
  const { data, error } = await db.from("cms_faq").insert(ligne).select("id").single();
  verifier(error);
  return { id: data.id as string };
}

export async function supprimerFaq(id: string) {
  const { error } = await db.from("cms_faq").delete().eq("id", id);
  verifier(error);
  return { ok: true };
}

/* ---------------------------- TRADUCTIONS ---------------------------- */

export async function listerTraductions(): Promise<CmsTranslation[]> {
  const { data, error } = await db
    .from("cms_translations")
    .select("*")
    .order("namespace", { ascending: true })
    .order("key", { ascending: true });
  verifier(error);
  return (data ?? []) as CmsTranslation[];
}

export interface EntreeTraduction {
  id?: string | null;
  namespace: string;
  key: string;
  fr?: string | null;
  en?: string | null;
  ar?: string | null;
}

export async function enregistrerTraduction(entree: EntreeTraduction) {
  if (!entree.key) throw new Error("La clé est obligatoire.");
  const ligne = {
    namespace: entree.namespace || "common",
    key: entree.key,
    fr: entree.fr ?? null,
    en: entree.en ?? null,
    ar: entree.ar ?? null,
  };
  const { error } = await db
    .from("cms_translations")
    .upsert(ligne, { onConflict: "namespace,key" });
  verifier(error);
  return { ok: true };
}

export async function supprimerTraduction(id: string) {
  const { error } = await db.from("cms_translations").delete().eq("id", id);
  verifier(error);
  return { ok: true };
}

/* ------------------------------- TARIFS ------------------------------ */

export async function listerOffres(): Promise<CmsPlan[]> {
  const { data, error } = await db
    .from("cms_plans")
    .select("*")
    .order("position", { ascending: true });
  verifier(error);
  return (data ?? []) as CmsPlan[];
}

export interface EntreeOffre {
  id?: string | null;
  code: string;
  name: Record<string, string>;
  description: Record<string, string>;
  features: Record<string, string[]>;
  price_gnf: number;
  period: string;
  popular?: boolean;
  active?: boolean;
  position?: number;
}

export async function enregistrerOffre(entree: EntreeOffre) {
  if (!entree.code) throw new Error("Le code de l'offre est obligatoire.");
  const ligne = {
    code: entree.code,
    name: entree.name,
    description: entree.description,
    features: entree.features,
    price_gnf: Math.max(0, Math.round(entree.price_gnf)),
    period: entree.period,
    popular: entree.popular ?? false,
    active: entree.active ?? true,
    position: entree.position ?? 0,
  };

  if (entree.id) {
    const { error } = await db.from("cms_plans").update(ligne).eq("id", entree.id);
    verifier(error);
    return { id: entree.id };
  }
  const { data, error } = await db.from("cms_plans").insert(ligne).select("id").single();
  verifier(error);
  return { id: data.id as string };
}

export async function supprimerOffre(id: string) {
  const { error } = await db.from("cms_plans").delete().eq("id", id);
  verifier(error);
  return { ok: true };
}

/* ------------------------------ SYNTHÈSE ----------------------------- */

export async function statistiquesCms() {
  const compter = async (table: string, filtre?: (q: any) => any) => {
    let q = db.from(table).select("id", { count: "exact", head: true });
    if (filtre) q = filtre(q);
    const { count, error } = await q;
    verifier(error);
    return count ?? 0;
  };

  const [pages, pagesPubliees, articles, articlesPublies, faq, traductions, offres] =
    await Promise.all([
      compter("cms_pages"),
      compter("cms_pages", (q) => q.eq("status", "published")),
      compter("cms_posts"),
      compter("cms_posts", (q) => q.eq("status", "published")),
      compter("cms_faq"),
      compter("cms_translations"),
      compter("cms_plans", (q) => q.eq("active", true)),
    ]);

  return { pages, pagesPubliees, articles, articlesPublies, faq, traductions, offres };
}
