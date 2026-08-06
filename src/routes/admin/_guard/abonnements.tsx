import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { adminAbonnements } from "@/lib/payment.functions";
import { planLabel } from "@/lib/portal";

export const Route = createFileRoute("/admin/_guard/abonnements")({
  head: () => ({
    meta: [
      { title: "Abonnements — Back-office Adresse GN" },
      {
        name: "description",
        content:
          "Suivez les abonnements professionnels Adresse GN : échéances, statuts et renouvellements automatiques.",
      },
      { property: "og:title", content: "Abonnements — Back-office Adresse GN" },
      { property: "og:description", content: "Suivi des abonnements et échéances." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AbonnementsAdminPage,
});

const STATUTS: Record<string, string> = {
  active: "Actif",
  suspended: "Suspendu",
  expired: "Expiré",
  cancelled: "Résilié",
};

function AbonnementsAdminPage() {
  const { data, isPending } = useQuery({
    queryKey: ["admin-abonnements"],
    queryFn: () => adminAbonnements(),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{data?.length ?? 0} abonnement(s)</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {isPending && <Skeleton className="h-40 w-full" />}
        {!isPending && !data?.length && (
          <p className="text-sm text-muted-foreground">Aucun abonnement enregistré.</p>
        )}
        {data?.map((s) => (
          <div
            key={s.id}
            className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border p-3"
          >
            <div>
              <p className="text-sm font-medium text-foreground">
                {s.client} · {planLabel(s.plan_code)}
              </p>
              <p className="text-xs text-muted-foreground">
                Échéance {s.next_billing_date ?? s.end_date} · renouvellement{" "}
                {s.auto_renew ? "automatique" : "manuel"}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-sm text-foreground">
                {(s.price_gnf ?? 0).toLocaleString("fr-FR")} GNF
              </span>
              <Badge variant={s.status === "active" ? "default" : "secondary"}>
                {STATUTS[s.status] ?? s.status}
              </Badge>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
