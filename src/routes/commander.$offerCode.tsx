import { Link, createFileRoute, useNavigate, useParams } from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";
import { useEffect } from "react";
import { Check, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/hooks/useAuth";
import { creerCommandeFn } from "@/lib/payment.functions";
import { getOffer, buildOrderItems, itemsTotal } from "@/lib/pricing";

export const Route = createFileRoute("/commander/$offerCode")({
  head: () => ({
    meta: [
      { title: "Commander votre adresse — Adresse GN" },
      {
        name: "description",
        content:
          "Validez votre commande Adresse GN : récapitulatif de l'offre, montant en francs guinéens et choix du moyen de paiement.",
      },
      { property: "og:title", content: "Commander votre adresse — Adresse GN" },
      { property: "og:description", content: "Récapitulatif de commande Adresse GN." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: CommanderPage,
});

function gnf(montant: number): string {
  return `${montant.toLocaleString("fr-FR")} GNF`;
}

function CommanderPage() {
  const { t } = useTranslation();
  const { offerCode } = useParams({ from: "/commander/$offerCode" });
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const offre = getOffer(offerCode);

  useEffect(() => {
    if (!loading && !user) {
      navigate({ to: "/login", search: { redirect: `/commander/${offerCode}` } as never });
    }
  }, [loading, user, navigate, offerCode]);

  const creer = useMutation({
    mutationFn: () => creerCommandeFn({ data: { offerCode } }),
    onSuccess: ({ orderRef }) => {
      navigate({ to: "/commande/$orderRef/paiement", params: { orderRef } });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!offre || offre.quoteOnly) {
    return (
      <>
        <div className="mx-auto max-w-lg px-4 py-20 text-center">
          <h1 className="text-2xl font-semibold text-foreground">{t("checkout.commander.offerUnavailable.title")}</h1>
          <p className="mt-3 text-sm text-muted-foreground">
            {t("checkout.commander.offerUnavailable.description")}
          </p>
          <Button asChild className="mt-6">
            <Link to="/tarifs">{t("checkout.commander.offerUnavailable.viewPricing")}</Link>
          </Button>
        </div>
      </>
    );
  }

  const lignes = buildOrderItems(offre);
  const total = itemsTotal(lignes);

  return (
    <>
      <div className="mx-auto max-w-2xl space-y-6 px-4 py-12">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">{t("checkout.commander.title")}</h1>
          <p className="text-sm text-muted-foreground">{offre.tagline}</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">{offre.label}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <ul className="space-y-2 text-sm">
              {lignes.map((ligne) => (
                <li key={ligne.label} className="flex items-center justify-between gap-3">
                  <span className="text-foreground">{ligne.label}</span>
                  <span className="font-mono text-foreground">
                    {gnf(ligne.unit_price_gnf * ligne.qty)}
                  </span>
                </li>
              ))}
            </ul>
            <div className="flex items-center justify-between border-t border-border pt-3">
              <span className="font-medium text-foreground">{t("checkout.commander.total")}</span>
              <span className="font-mono text-lg font-bold text-primary">{gnf(total)}</span>
            </div>
            <ul className="space-y-1 text-sm text-muted-foreground">
              {offre.includes.map((i) => (
                <li key={i} className="flex gap-2">
                  <Check className="mt-0.5 size-4 shrink-0 text-accent" />
                  {i}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
          <Button
            className="h-12 w-full sm:w-auto"
            onClick={() => creer.mutate()}
            disabled={creer.isPending || !user}
          >
            {creer.isPending && <Loader2 className="mr-2 size-4 animate-spin rtl:mr-0 rtl:ml-2" />}
            {t("checkout.commander.continueToPayment")}
          </Button>
          <Button variant="outline" className="h-12 w-full sm:w-auto" asChild>
            <Link to="/tarifs">{t("checkout.commander.changeOffer")}</Link>
          </Button>
        </div>

        <p className="text-xs text-muted-foreground">
          {t("checkout.commander.disclaimer")}
        </p>
      </div>
    </>
  );
}
