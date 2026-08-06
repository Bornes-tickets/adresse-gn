import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Download } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { mesCommandes } from "@/lib/payment.functions";
import { ORDER_STATUS_LABELS } from "@/lib/pricing";

export const Route = createFileRoute("/mon-compte/_guard/commandes")({
  head: () => ({
    meta: [
      { title: "Mes commandes et factures — Adresse GN" },
      {
        name: "description",
        content:
          "Retrouvez vos commandes Adresse GN, leur statut de paiement et téléchargez vos factures PDF.",
      },
      { property: "og:title", content: "Mes commandes et factures — Adresse GN" },
      { property: "og:description", content: "Commandes et factures Adresse GN." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: CommandesPage,
});

function CommandesPage() {
  const { data, isPending } = useQuery({
    queryKey: ["mes-commandes"],
    queryFn: () => mesCommandes(),
  });

  if (isPending) return <Skeleton className="h-64 w-full" />;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-foreground">Mes commandes</h1>
        <p className="text-sm text-muted-foreground">
          Statut de paiement et factures de vos offres Adresse GN.
        </p>
      </div>

      {!data?.length && (
        <Card>
          <CardContent className="pt-6 text-sm text-muted-foreground">
            Vous n'avez encore passé aucune commande.
          </CardContent>
        </Card>
      )}

      {data?.map((c) => (
        <Card key={c.id}>
          <CardHeader className="flex flex-row items-center justify-between gap-3">
            <CardTitle className="font-mono text-base">{c.order_ref}</CardTitle>
            <Badge variant={c.status === "paid" ? "default" : "secondary"}>
              {ORDER_STATUS_LABELS[c.status] ?? c.status}
            </Badge>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-xs text-muted-foreground">
              {new Date(c.created_at).toLocaleString("fr-FR")}
            </p>
            <ul className="space-y-1 text-sm">
              {c.items.map((item) => (
                <li key={item.label} className="flex justify-between gap-3">
                  <span className="text-foreground">{item.label}</span>
                  <span className="font-mono">
                    {(item.unit_price_gnf * item.qty).toLocaleString("fr-FR")} GNF
                  </span>
                </li>
              ))}
            </ul>
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-3">
              <span className="font-mono font-semibold text-primary">
                {c.amount_gnf.toLocaleString("fr-FR")} GNF
              </span>
              {c.invoice?.pdf_url ? (
                <Button size="sm" variant="outline" asChild>
                  <a href={c.invoice.pdf_url} target="_blank" rel="noreferrer">
                    <Download className="mr-2 size-4" />
                    Facture {c.invoice.number}
                  </a>
                </Button>
              ) : (
                <span className="text-xs text-muted-foreground">
                  Facture disponible après confirmation du paiement.
                </span>
              )}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
