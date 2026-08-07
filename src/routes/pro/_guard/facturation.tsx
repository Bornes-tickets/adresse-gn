import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { PLANS, formatGnf, planLabel } from "@/lib/portal";
import { proBilling, proChangePlan } from "@/lib/pro.functions";

export const Route = createFileRoute("/pro/_guard/facturation")({
  head: () => ({
    meta: [
      { title: "Facturation — Espace pro Adresse GN" },
      {
        name: "description",
        content:
          "Consultez vos commandes, votre abonnement en cours et changez d'offre Adresse GN (Basic ou Plus).",
      },
      { property: "og:title", content: "Facturation — Espace pro Adresse GN" },
      { property: "og:description", content: "Abonnement et historique de commandes." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: FacturationPage,
});

const STATUTS: Record<string, string> = {
  pending: "À payer sur place",
  paid: "Payée",
  cancelled: "Annulée",
  active: "Actif",
  expired: "Expiré",
};

function FacturationPage() {
  const queryClient = useQueryClient();
  const { data, isPending } = useQuery({ queryKey: ["pro-billing"], queryFn: () => proBilling() });

  const changer = useMutation({
    mutationFn: (planCode: string) => proChangePlan({ data: { planCode } }),
    onSuccess: () => {
      toast.success("Offre mise à jour. Paiement à finaliser sur place.");
      queryClient.invalidateQueries({ queryKey: ["pro-billing"] });
      queryClient.invalidateQueries({ queryKey: ["pro-business"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (isPending) return <Skeleton className="h-64 w-full" />;

  const offreActuelle = data?.business?.plan_code ?? null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Facturation</h1>
        <p className="text-sm text-muted-foreground">
          Offre actuelle : {planLabel(offreActuelle)}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {PLANS.map((offre) => (
          <Card key={offre.code} className={offre.code === offreActuelle ? "border-primary" : ""}>
            <CardHeader>
              <CardTitle className="flex items-center justify-between text-base">
                {offre.label}
                {offre.code === offreActuelle && <Check className="size-4 text-primary" />}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground">
                {formatGnf(offre.monthlyGnf)}/mois · installation {formatGnf(offre.setupGnf)}
              </p>
              <ul className="space-y-1 text-sm text-foreground">
                {offre.features.map((f) => (
                  <li key={f} className="flex gap-2">
                    <Check className="mt-0.5 size-4 text-accent" />
                    {f}
                  </li>
                ))}
              </ul>
              <Button
                variant={offre.code === offreActuelle ? "outline" : "default"}
                disabled={offre.code === offreActuelle || changer.isPending}
                onClick={() => changer.mutate(offre.code)}
                className="w-full sm:w-auto"
              >
                {offre.code === offreActuelle ? "Offre en cours" : `Passer à ${offre.label}`}
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Abonnements</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {!data?.subscriptions.length && (
            <p className="text-sm text-muted-foreground">Aucun abonnement enregistré.</p>
          )}
          {data?.subscriptions.map((s: any) => (
            <div
              key={s.id}
              className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-2 last:border-0"
            >
              <div>
                <p className="text-sm font-medium text-foreground">{planLabel(s.plan_code)}</p>
                <p className="text-xs text-muted-foreground">
                  Du {new Date(s.start_date).toLocaleDateString("fr-FR")} au{" "}
                  {new Date(s.end_date).toLocaleDateString("fr-FR")}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm text-foreground">{formatGnf(s.price_gnf)}</span>
                <Badge variant={s.status === "active" ? "default" : "secondary"}>
                  {STATUTS[s.status] ?? s.status}
                </Badge>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Commandes</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {!data?.orders.length && (
            <p className="text-sm text-muted-foreground">Aucune commande.</p>
          )}
          {data?.orders.map((o: any) => (
            <div
              key={o.id}
              className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-2 last:border-0"
            >
              <div>
                <p className="text-sm font-medium text-foreground">{planLabel(o.offer_code)}</p>
                <p className="text-xs text-muted-foreground">
                  {new Date(o.created_at).toLocaleString("fr-FR")}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm text-foreground">{formatGnf(o.amount_gnf)}</span>
                <Badge variant={o.status === "paid" ? "default" : "secondary"}>
                  {STATUTS[o.status] ?? o.status}
                </Badge>
              </div>
            </div>
          ))}
          <p className="text-xs text-muted-foreground">
            Le paiement en ligne arrive prochainement : un conseiller encaisse sur place et marque
            la commande comme payée.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
