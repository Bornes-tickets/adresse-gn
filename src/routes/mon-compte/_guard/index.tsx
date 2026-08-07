import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Navigation, QrCode, Search } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ownerDashboard } from "@/lib/owner.functions";

export const Route = createFileRoute("/mon-compte/_guard/")({
  head: () => ({
    meta: [
      { title: "Mon compte — Adresse GN" },
      {
        name: "description",
        content:
          "Suivez vos balises Adresse GN : recherches, itinéraires lancés et dernières activités sur vos adresses.",
      },
      { property: "og:title", content: "Mon compte — Adresse GN" },
      {
        property: "og:description",
        content: "Tableau de bord propriétaire : balises, recherches et itinéraires.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: OwnerDashboardPage,
});

function OwnerDashboardPage() {
  const { data, isPending } = useQuery({
    queryKey: ["owner-dashboard"],
    queryFn: () => ownerDashboard(),
  });

  const kpis = [
    { label: "Balises possédées", value: data?.beaconCount ?? 0, icon: QrCode },
    { label: "Recherches (30 j)", value: data?.searches30d ?? 0, icon: Search },
    { label: "Itinéraires (30 j)", value: data?.routes30d ?? 0, icon: Navigation },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Tableau de bord</h1>
        <p className="text-sm text-muted-foreground">
          Activité des 30 derniers jours sur vos adresses.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {kpis.map(({ label, value, icon: Icone }) => (
          <Card key={label}>
            <CardContent className="flex items-center gap-3 pt-6">
              <span className="flex size-10 items-center justify-center rounded-md bg-muted">
                <Icone className="size-5 text-primary" />
              </span>
              <div>
                {isPending ? (
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
        <CardHeader>
          <CardTitle className="text-base">Dernières activités</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {isPending && <Skeleton className="h-16 w-full" />}
          {!isPending && !data?.activities.length && (
            <p className="text-sm text-muted-foreground">
              Aucune activité récente.{" "}
              <Link to="/mon-compte/beacons" className="text-primary underline">
                Voir mes balises
              </Link>
            </p>
          )}
          {data?.activities.map((a, index) => (
            <div
              key={`${a.at}-${index}`}
              className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 border-b border-border pb-2 last:border-0"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-foreground">{a.label}</p>
                <p className="truncate font-mono text-xs text-muted-foreground">{a.detail}</p>
              </div>
              <span className="shrink-0 text-xs text-muted-foreground">
                {new Date(a.at).toLocaleString("fr-FR")}
              </span>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
