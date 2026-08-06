import { Link, createFileRoute, useParams } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Download, Loader2, Smartphone, Wallet } from "lucide-react";
import { toast } from "sonner";

import { Layout } from "@/components/Layout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  chargerCommandeFn,
  initierPaiementFn,
  paiementMoyens,
} from "@/lib/payment.functions";
import {
  ORDER_STATUS_LABELS,
  PAYMENT_PROVIDER_LABELS,
  PAYMENT_STATUS_LABELS,
} from "@/lib/pricing";

export const Route = createFileRoute("/commande/$orderRef/paiement")({
  head: () => ({
    meta: [
      { title: "Paiement de votre commande — Adresse GN" },
      {
        name: "description",
        content:
          "Choisissez votre moyen de paiement Adresse GN et suivez l'état de votre commande jusqu'à la confirmation.",
      },
      { property: "og:title", content: "Paiement de votre commande — Adresse GN" },
      { property: "og:description", content: "Suivi du paiement d'une commande Adresse GN." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: PaiementPage,
});

function gnf(montant: number): string {
  return `${montant.toLocaleString("fr-FR")} GNF`;
}

const ICONES: Record<string, typeof Wallet> = {
  manual: Wallet,
  orange: Smartphone,
  mtn: Smartphone,
};

function PaiementPage() {
  const { orderRef } = useParams({ from: "/commande/$orderRef/paiement" });
  const queryClient = useQueryClient();

  const commande = useQuery({
    queryKey: ["commande", orderRef],
    queryFn: () => chargerCommandeFn({ data: { orderRef } }),
    refetchInterval: (q) => (q.state.data?.status === "paid" ? false : 15_000),
  });

  const moyens = useQuery({ queryKey: ["moyens-paiement"], queryFn: () => paiementMoyens() });

  const initier = useMutation({
    mutationFn: (provider: string) => initierPaiementFn({ data: { orderRef, provider } }),
    onSuccess: (resultat) => {
      if (resultat.action.type === "url") {
        window.location.href = resultat.action.url;
        return;
      }
      toast.success("Instructions de paiement générées.");
      queryClient.invalidateQueries({ queryKey: ["commande", orderRef] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (commande.isPending) {
    return (
      <Layout>
        <div className="mx-auto max-w-2xl px-4 py-12">
          <Skeleton className="h-64 w-full" />
        </div>
      </Layout>
    );
  }

  if (commande.isError || !commande.data) {
    return (
      <Layout>
        <div className="mx-auto max-w-lg px-4 py-20 text-center">
          <h1 className="text-2xl font-semibold text-foreground">Commande introuvable</h1>
          <p className="mt-3 text-sm text-muted-foreground">
            Cette commande n'existe pas ou ne vous appartient pas.
          </p>
          <Button asChild className="mt-6">
            <Link to="/tarifs">Voir les tarifs</Link>
          </Button>
        </div>
      </Layout>
    );
  }

  const c = commande.data;
  const payee = c.status === "paid";
  const action = initier.data?.action;

  return (
    <Layout>
      <div className="mx-auto max-w-2xl space-y-6 px-4 py-12">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold text-foreground">Paiement</h1>
            <p className="font-mono text-sm text-muted-foreground">{c.order_ref}</p>
          </div>
          <Badge variant={payee ? "default" : "secondary"}>
            {ORDER_STATUS_LABELS[c.status] ?? c.status}
          </Badge>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Détail de la commande</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {c.items.map((item) => (
              <div key={item.label} className="flex items-center justify-between gap-3 text-sm">
                <span className="text-foreground">{item.label}</span>
                <span className="font-mono">{gnf(item.unit_price_gnf * item.qty)}</span>
              </div>
            ))}
            <div className="flex items-center justify-between border-t border-border pt-3">
              <span className="font-medium text-foreground">Total</span>
              <span className="font-mono text-lg font-bold text-primary">
                {gnf(c.amount_gnf)}
              </span>
            </div>
            {c.payment && (
              <p className="text-xs text-muted-foreground">
                Paiement {PAYMENT_PROVIDER_LABELS[c.payment.provider ?? "manual"]} —{" "}
                {PAYMENT_STATUS_LABELS[c.payment.status] ?? c.payment.status}
                {c.payment.external_ref ? ` · reçu ${c.payment.external_ref}` : ""}
              </p>
            )}
          </CardContent>
        </Card>

        {payee ? (
          <Card className="border-accent">
            <CardContent className="space-y-4 pt-6">
              <div className="flex items-center gap-3">
                <CheckCircle2 className="size-6 text-accent" />
                <div>
                  <p className="font-medium text-foreground">Paiement confirmé</p>
                  <p className="text-sm text-muted-foreground">
                    Un agent va planifier votre installation. Vous serez prévenu par
                    notification.
                  </p>
                </div>
              </div>
              {c.invoice?.pdf_url && (
                <Button asChild variant="outline">
                  <a href={c.invoice.pdf_url} target="_blank" rel="noreferrer">
                    <Download className="mr-2 size-4" />
                    Télécharger la facture {c.invoice.number}
                  </a>
                </Button>
              )}
              <Button asChild>
                <Link to="/mon-compte">Aller à mon espace</Link>
              </Button>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Choisissez votre moyen de paiement</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {(moyens.data ?? []).map((m) => {
                const Icone = ICONES[m.code] ?? Wallet;
                return (
                  <button
                    key={m.code}
                    type="button"
                    disabled={!m.enabled || initier.isPending}
                    onClick={() => initier.mutate(m.code)}
                    className="flex w-full items-center justify-between gap-3 rounded-lg border border-border px-4 py-3 text-left transition-colors enabled:hover:border-primary disabled:opacity-50"
                  >
                    <span className="flex items-center gap-3">
                      <Icone className="size-5 text-primary" />
                      <span className="text-sm font-medium text-foreground">{m.label}</span>
                    </span>
                    {m.enabled ? (
                      initier.isPending ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : (
                        <span className="text-xs text-primary">Choisir</span>
                      )
                    ) : (
                      <Badge variant="secondary">Bientôt disponible</Badge>
                    )}
                  </button>
                );
              })}
            </CardContent>
          </Card>
        )}

        {action && !payee && (
          <Card className="border-primary">
            <CardHeader>
              <CardTitle className="text-base">Instructions de paiement</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              {action.type === "manual" && (
                <>
                  <p className="whitespace-pre-line text-foreground">{action.instructions}</p>
                  <Button asChild variant="outline">
                    <a href={action.whatsapp} target="_blank" rel="noreferrer">
                      Contacter un conseiller sur WhatsApp
                    </a>
                  </Button>
                </>
              )}
              {action.type === "ussd" && (
                <>
                  <p className="font-mono text-lg text-primary">{action.ussd}</p>
                  <p className="text-foreground">{action.instructions}</p>
                </>
              )}
              <p className="text-xs text-muted-foreground">
                Cette page se met à jour automatiquement dès que le paiement est confirmé.
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </Layout>
  );
}
