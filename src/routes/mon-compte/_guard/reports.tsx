import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { REPORT_REASON_LABELS } from "@/lib/portal";
import { myClaims, ownerReports } from "@/lib/owner.functions";
import { CLAIM_STATUS_LABELS } from "@/lib/portal";

export const Route = createFileRoute("/mon-compte/_guard/reports")({
  head: () => ({
    meta: [
      { title: "Mes signalements — Adresse GN" },
      {
        name: "description",
        content:
          "Suivez l'état de vos signalements et de vos demandes de réclamation d'adresse sur Adresse GN.",
      },
      { property: "og:title", content: "Mes signalements — Adresse GN" },
      { property: "og:description", content: "Historique des signalements et réclamations." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: SignalementsPage,
});

const STATUTS: Record<string, string> = {
  open: "Ouvert",
  in_review: "En cours",
  resolved: "Résolu",
  rejected: "Rejeté",
};

function SignalementsPage() {
  const signalements = useQuery({
    queryKey: ["owner-reports"],
    queryFn: () => ownerReports(),
  });
  const reclamations = useQuery({
    queryKey: ["owner-claims"],
    queryFn: () => myClaims(),
  });

  return (
    <div className="space-y-8">
      <section className="space-y-4">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Mes signalements</h1>
          <p className="text-sm text-muted-foreground">Suivi des problèmes que vous avez remontés.</p>
        </div>

        {signalements.isPending && <Skeleton className="h-24 w-full" />}
        {!signalements.isPending && !signalements.data?.length && (
          <p className="text-sm text-muted-foreground">Aucun signalement envoyé.</p>
        )}

        {signalements.data?.map((r) => (
          <Card key={r.id}>
            <CardContent className="space-y-2 pt-6">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-medium text-foreground">
                  {REPORT_REASON_LABELS[r.reason] ?? r.reason}
                </p>
                <Badge variant={r.status === "resolved" ? "default" : "secondary"}>
                  {STATUTS[r.status] ?? r.status}
                </Badge>
              </div>
              {r.public_number && (
                <p className="font-mono text-xs text-muted-foreground">{r.public_number}</p>
              )}
              {r.description && <p className="text-sm text-muted-foreground">{r.description}</p>}
              {r.admin_response && (
                <p className="rounded-md bg-muted p-2 text-sm text-foreground">
                  Réponse : {r.admin_response}
                </p>
              )}
              <p className="text-xs text-muted-foreground">
                {new Date(r.created_at).toLocaleString("fr-FR")}
              </p>
            </CardContent>
          </Card>
        ))}
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-foreground">Mes réclamations d'adresse</h2>

        {reclamations.isPending && <Skeleton className="h-20 w-full" />}
        {!reclamations.isPending && !reclamations.data?.length && (
          <p className="text-sm text-muted-foreground">Aucune réclamation en cours.</p>
        )}

        {reclamations.data?.map((c) => (
          <Card key={c.id}>
            <CardContent className="space-y-2 pt-6">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-mono text-sm text-primary">{c.public_number}</p>
                <Badge
                  variant={
                    c.status === "approved"
                      ? "default"
                      : c.status === "rejected"
                        ? "destructive"
                        : "secondary"
                  }
                >
                  {CLAIM_STATUS_LABELS[c.status] ?? c.status}
                </Badge>
              </div>
              {c.decision_note && (
                <p className="text-sm text-muted-foreground">Note : {c.decision_note}</p>
              )}
              <p className="text-xs text-muted-foreground">
                Demande du {new Date(c.created_at).toLocaleDateString("fr-FR")}
              </p>
            </CardContent>
          </Card>
        ))}
      </section>
    </div>
  );
}
