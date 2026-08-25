import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, Clock, Package } from "lucide-react";

import { Button } from "@/components/ui/button";
import { getGuestOrder } from "@/lib/orders.functions";

export const Route = createFileRoute("/suivi/$token")({
  head: () => ({
    meta: [
      { title: "Suivi de votre commande — Adresse GN" },
      { name: "description", content: "Suivez l'avancement de votre commande Adresse GN : confirmation, pose de la balise et activation." },
      { property: "og:title", content: "Suivi de votre commande — Adresse GN" },
      { property: "og:description", content: "Suivez l'avancement de votre commande Adresse GN en temps réel." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: SuiviCommande,
});

const ETAPES = [
  { code: "pending", label: "Commande reçue", icone: Package },
  { code: "confirmed", label: "Confirmée", icone: CheckCircle2 },
  { code: "installed", label: "Balise posée", icone: CheckCircle2 },
];

function SuiviCommande() {
  const { token } = Route.useParams();
  const charger = useServerFn(getGuestOrder);
  const { data, isPending, isError } = useQuery({
    queryKey: ["guest-order", token],
    queryFn: () => charger({ data: { token } }),
  });

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-12 sm:px-6">
      <div className="mx-auto max-w-2xl">
        <h1 className="text-2xl font-extrabold text-foreground sm:text-3xl">Suivi de votre commande</h1>

        {isPending && <p className="mt-6 text-muted-foreground">Chargement…</p>}
        {isError && <p className="mt-6 text-destructive">Impossible de charger cette commande.</p>}
        {!isPending && !isError && !data && (
          <p className="mt-6 text-muted-foreground">Aucune commande ne correspond à ce lien.</p>
        )}

        {data && (
          <div className="mt-6 space-y-6 rounded-2xl border border-border bg-card p-6 shadow-sm">
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Référence</p>
              <p className="text-lg font-bold text-foreground">{data.order_ref}</p>
            </div>

            <dl className="grid gap-3 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-muted-foreground">Formule</dt>
                <dd className="font-medium text-foreground">{data.formule_label}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Montant</dt>
                <dd className="font-medium text-foreground">
                  {data.devis_demande
                    ? "Sur devis"
                    : new Intl.NumberFormat("fr-FR").format(data.amount_gnf ?? 0) + " GNF"}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Adresse</dt>
                <dd className="font-medium text-foreground">
                  {data.address_line}, {data.quartier}, {data.city}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Paiement</dt>
                <dd className="font-medium text-foreground">{data.payment_method}</dd>
              </div>
            </dl>

            <ol className="space-y-3">
              {ETAPES.map((etape) => {
                const atteint =
                  etape.code === "pending" ||
                  (etape.code === "confirmed" && Boolean(data.confirmed_at)) ||
                  (etape.code === "installed" && Boolean(data.installed_at));
                const Icone = atteint ? etape.icone : Clock;
                return (
                  <li key={etape.code} className="flex items-center gap-3">
                    <Icone className={atteint ? "size-5 text-primary" : "size-5 text-muted-foreground"} />
                    <span className={atteint ? "font-semibold text-foreground" : "text-muted-foreground"}>
                      {etape.label}
                    </span>
                  </li>
                );
              })}
            </ol>
          </div>
        )}

        <Button asChild variant="outline" className="mt-8">
          <Link to="/">Retour à l'accueil</Link>
        </Button>
      </div>
    </div>
  );
}
