import { createFileRoute } from "@tanstack/react-router";
import type {} from "@tanstack/react-start";

const BASE_URL = "https://adresse-gn.lovable.app";

interface SitemapEntry {
  path: string;
  changefreq?: "always" | "hourly" | "daily" | "weekly" | "monthly" | "yearly" | "never";
  priority?: string;
}

export const Route = createFileRoute("/sitemap.xml")({
  server: {
    handlers: {
      GET: async () => {
        // Les pages balises (/a/:numero) seront ajoutées dynamiquement plus tard.
        const entries: SitemapEntry[] = [
          { path: "/", changefreq: "weekly", priority: "1.0" },
          { path: "/tarifs", changefreq: "monthly", priority: "0.8" },
          { path: "/blog", changefreq: "weekly", priority: "0.7" },
          { path: "/faq", changefreq: "monthly", priority: "0.6" },
          { path: "/a-propos", changefreq: "yearly", priority: "0.5" },
          { path: "/confidentialite", changefreq: "yearly", priority: "0.3" },
        ];

        // Contenus publiés du CMS.
        try {
          const { listerPagesPubliees, listerArticlesPublies } = await import(
            "@/lib/cms-public.server"
          );
          const [pages, articles] = await Promise.all([
            listerPagesPubliees(),
            listerArticlesPublies(),
          ]);
          pages.forEach((page) =>
            entries.push({
              path: `/p/${page.slug}`,
              changefreq: "monthly",
              priority: "0.6",
            }),
          );
          articles.forEach((article) =>
            entries.push({
              path: `/blog/${article.slug}`,
              changefreq: "monthly",
              priority: "0.6",
            }),
          );
        } catch (e) {
          console.error("[sitemap] CMS indisponible:", e);
        }

        const urls = entries.map((e) =>
          [
            `  <url>`,
            `    <loc>${BASE_URL}${e.path}</loc>`,
            e.changefreq ? `    <changefreq>${e.changefreq}</changefreq>` : null,
            e.priority ? `    <priority>${e.priority}</priority>` : null,
            `  </url>`,
          ]
            .filter(Boolean)
            .join("\n"),
        );

        const xml = [
          `<?xml version="1.0" encoding="UTF-8"?>`,
          `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">`,
          ...urls,
          `</urlset>`,
        ].join("\n");

        return new Response(xml, {
          headers: {
            "Content-Type": "application/xml",
            "Cache-Control": "public, max-age=3600",
          },
        });
      },
    },
  },
});
