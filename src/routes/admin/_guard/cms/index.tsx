import { Link, createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { FileText, HelpCircle, Languages, Newspaper, Tags } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cmsStats } from "@/lib/cms.functions";

export const Route = createFileRoute("/admin/_guard/cms/")({
  head: () => ({
    meta: [
      { title: "Contenu du site — Administration Adresse GN" },
      { name: "description", content: "Module CMS : pages, blog, FAQ, traductions et tarifs." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: CmsAccueil,
});

const MODULES = [
  {
    to: "/admin/cms/pages",
    titre: "Pages",
    desc: "Pages éditoriales multilingues (à propos, confidentialité…).",
    icon: FileText,
    classe: "text-admin-blue bg-admin-blue/10 border-admin-blue/25",
    cle: "pages" as const,
  },
  {
    to: "/admin/cms/blog",
    titre: "Blog",
    desc: "Articles, catégories et publication programmée.",
    icon: Newspaper,
    classe: "text-admin-pink bg-admin-pink/10 border-admin-pink/25",
    cle: "articles" as const,
  },
  {
    to: "/admin/cms/faq",
    titre: "FAQ",
    desc: "Questions fréquentes classées et ordonnées.",
    icon: HelpCircle,
    classe: "text-admin-cyan bg-admin-cyan/10 border-admin-cyan/25",
    cle: "faq" as const,
  },
  {
    to: "/admin/cms/traductions",
    titre: "Traductions",
    desc: "Dictionnaire fr / en / ar des textes du site.",
    icon: Languages,
    classe: "text-admin-violet bg-admin-violet/10 border-admin-violet/25",
    cle: "traductions" as const,
  },
  {
    to: "/admin/cms/tarifs",
    titre: "Tarifs",
    desc: "Offres, prix en GNF et avantages affichés.",
    icon: Tags,
    classe: "text-admin-amber bg-admin-amber/10 border-admin-amber/25",
    cle: "offres" as const,
  },
];

function CmsAccueil() {
  const charger = useServerFn(cmsStats);
  const stats = useQuery({ queryKey: ["cms", "stats"], queryFn: () => charger() });

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {MODULES.map(({ to, titre, desc, icon: Icone, classe, cle }) => (
          <Link key={to} to={to} className="group">
            <Card className="h-full transition-shadow group-hover:shadow-md">
              <CardHeader className="flex-row items-center gap-3 pb-2">
                <span className={`rounded-lg border p-2 ${classe}`}>
                  <Icone className="size-5" />
                </span>
                <CardTitle className="text-base">{titre}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {stats.isLoading ? (
                  <Skeleton className="h-8 w-16" />
                ) : (
                  <p className="text-3xl font-semibold tabular-nums text-foreground">
                    {stats.data?.[cle] ?? 0}
                  </p>
                )}
                <p className="text-sm text-muted-foreground">{desc}</p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Publication</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-lg border border-border p-4">
            <p className="text-sm text-muted-foreground">Pages publiées</p>
            <p className="text-2xl font-semibold tabular-nums text-admin-green">
              {stats.data?.pagesPubliees ?? 0}
              <span className="text-base text-muted-foreground"> / {stats.data?.pages ?? 0}</span>
            </p>
          </div>
          <div className="rounded-lg border border-border p-4">
            <p className="text-sm text-muted-foreground">Articles publiés</p>
            <p className="text-2xl font-semibold tabular-nums text-admin-green">
              {stats.data?.articlesPublies ?? 0}
              <span className="text-base text-muted-foreground"> / {stats.data?.articles ?? 0}</span>
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
