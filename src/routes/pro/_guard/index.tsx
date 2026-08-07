import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Building2, Navigation, Percent, Search } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatGnf, planLabel } from "@/lib/portal";
import { proBusiness, proDashboard } from "@/lib/pro.functions";
import { PLANS } from "@/lib/portal";

export const Route = createFileRoute("/pro/_guard/")({
  head: () => ({
    meta: [
      { title: "Tableau de bord pro — Adresse GN" },
      {
        name: "description",
        content:
          "Vue d'ensemble de votre visibilité Adresse GN : établissements, recherches, itinéraires et taux de conversion.",
      },
      { property: "og:title", content: "Tableau de bord pro — Adresse GN" },
      { property: "og:description", content: "Pilotez la visibilité de votre entreprise." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ProDashboardPage,
});

function ProDashboardPage() {
  const business = useQuery({ queryKey: ["pro-business"], queryFn: () => proBusiness() });
  const dashboard = useQuery({ queryKey: ["pro-dashboard"], queryFn: () => proDashboard() });

  const offre = PLANS.find((p) => p.code === business.data?.plan_code);

  const kpis = [
    { label: "Établissements", value: dashboard.data?.establishmentCount ?? 0, icon: Building2 },
    { label: "Recherches (30 j)", value: dashboard.data?.searches30d ?? 0, icon: Search },
    { label: "Itinéraires (30 j)", value: dashboard.data?.routes30d ?? 0, icon: Navigation },
    {
      label: "Conversion",
      value: `${dashboard.data?.conversion ?? 0} %`,
      icon: Percent,
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="truncate text-2xl font-semibold text-foreground">
            {business.data?.trade_name ?? "Espace professionnel"}
          </h1>
          <p className="text-sm text-muted-foreground">
            Offre {planLabel(business.data?.plan_code)}
            {offre ? ` · ${formatGnf(offre.monthlyGnf)}/mois` : ""}
          </p>
        </div>
        <Badge variant="secondary">
          {business.data?.plan_ends_at
            ? `Valide jusqu'au ${new Date(business.data.plan_ends_at).toLocaleDateString("fr-FR")}`
            : "Abonnement à finaliser"}
        </Badge>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {kpis.map(({ label, value, icon: Icone }) => (
          <Card key={label}>
            <CardContent className="flex items-center gap-3 pt-6">
              <span className="flex size-10 items-center justify-center rounded-md bg-muted">
                <Icone className="size-5 text-primary" />
              </span>
              <div>
                {dashboard.isPending ? (
                  <Skeleton className="h-7 w-12" />
                ) : (
                  <p className="text-2xl font-semibold text-foreground">{value}</p>
                )}
                <p className="text-xs text-muted-foreground">{label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardContent className="flex flex-wrap items-center justify-between gap-3 pt-6">
          <p className="text-sm text-muted-foreground">
            Créez ou enrichissez vos fiches pour apparaître avec photos et horaires.
          </p>
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
            <Button asChild className="w-full sm:w-auto">
              <Link to="/pro/etablissements">Gérer mes établissements</Link>
            </Button>
            <Button asChild variant="outline" className="w-full sm:w-auto">
              <Link to="/pro/statistiques">Voir les statistiques</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
