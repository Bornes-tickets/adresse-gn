import { Link, createFileRoute } from "@tanstack/react-router";
import { Check } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { OFFERS, type Offer } from "@/lib/pricing";

export const Route = createFileRoute("/tarifs")({
  head: () => ({
    meta: [
      { title: "Tarifs — ADRESSE GN" },
      {
        name: "description",
        content:
          "Tarifs Adresse GN en francs guinéens : adresse numérique dès 40 000 GNF, balise résidentielle posée par un agent, offres Pro Basic et Pro Plus pour les commerces.",
      },
      { property: "og:title", content: "Tarifs — ADRESSE GN" },
      {
        property: "og:description",
        content:
          "Adresse numérique, balise physique, fiche établissement : toutes les offres et leurs prix en francs guinéens.",
      },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://place-id-finder.lovable.app/tarifs" },
      {
        property: "og:image",
        content: "https://place-id-finder.lovable.app/og-cover.jpg",
      },
      {
        name: "twitter:image",
        content: "https://place-id-finder.lovable.app/og-cover.jpg",
      },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [
      { rel: "canonical", href: "https://place-id-finder.lovable.app/tarifs" },
    ],
  }),
  component: TarifsPage,
});


function gnf(montant: number): string {
  return `${montant.toLocaleString("fr-FR")} GNF`;
}

function CarteOffre({ offre, vedette }: { offre: Offer; vedette: boolean }) {
  return (
    <Card
      className={
        "h-full shadow-sm transition-transform duration-200 hover:scale-[1.02] hover:shadow-md" +
        (vedette ? " border-primary" : "")
      }
    >
      <CardHeader className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-lg">{offre.label}</CardTitle>
          {vedette && <Badge>Plus populaire</Badge>}
        </div>
        <p className="text-sm text-muted-foreground">{offre.tagline}</p>
        <div>
          {offre.quoteOnly ? (
            <p className="font-mono text-2xl font-bold text-primary">Sur devis</p>
          ) : (
            <>
              <p className="font-mono text-2xl font-bold text-primary">
                {gnf(offre.setup_gnf)}
              </p>
              <p className="text-xs text-muted-foreground">
                {offre.monthly_gnf > 0
                  ? `à l'installation, puis ${gnf(offre.monthly_gnf)} par mois`
                  : "paiement unique, sans abonnement"}
              </p>
            </>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <ul className="space-y-2 text-sm text-foreground">
          {offre.includes.map((ligne) => (
            <li key={ligne} className="flex gap-2">
              <Check className="mt-0.5 size-4 shrink-0 text-accent" />
              <span>{ligne}</span>
            </li>
          ))}
        </ul>
        {offre.quoteOnly ? (
          <Button variant="outline" className="w-full" asChild>
            <a href="mailto:commercial@adresse.gn?subject=Demande%20de%20devis">
              Demander un devis
            </a>
          </Button>
        ) : (
          <Button className="w-full" asChild>
            <Link to="/commander/$offerCode" params={{ offerCode: offre.code }}>
              Commander
            </Link>
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

function TarifsPage() {
  const residentiel = OFFERS.filter((o) => o.family === "residential");
  const pro = OFFERS.filter((o) => o.family === "pro");
  const devis = OFFERS.filter((o) => o.family === "quote");

  return (
    <>
      <section className="bg-linear-to-br from-primary to-[oklch(0.32_0.07_262)] px-4 py-16">
        <header className="mx-auto max-w-3xl space-y-4 text-center">
          <h1 className="text-3xl font-bold text-primary-foreground sm:text-4xl">
            Des tarifs simples, en francs guinéens
          </h1>
          <p className="mx-auto max-w-2xl text-primary-foreground/85">
            Choisissez l'offre adaptée à votre logement ou à votre commerce. Vous réglez sur
            place ou par Mobile Money, puis un agent agréé vient poser votre balise.
          </p>
        </header>
      </section>

      <div className="mx-auto max-w-5xl space-y-12 px-4 py-12">

        <section className="space-y-4">
          <h2 className="text-xl font-semibold text-foreground">Particuliers</h2>
          <div className="grid gap-4 md:grid-cols-3">
            {residentiel.map((offre) => (
              <CarteOffre
                key={offre.code}
                offre={offre}
                vedette={offre.code === "residential_standard"}
              />
            ))}
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-semibold text-foreground">Professionnels</h2>
          <div className="grid gap-4 md:grid-cols-2">
            {pro.map((offre) => (
              <CarteOffre key={offre.code} offre={offre} vedette={offre.code === "pro_plus"} />
            ))}
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-semibold text-foreground">Grands comptes</h2>
          <div className="grid gap-4 md:grid-cols-2">
            {devis.map((offre) => (
              <CarteOffre key={offre.code} offre={offre} vedette={false} />
            ))}
          </div>
        </section>

        <section className="rounded-xl border border-border bg-card p-6">
          <h2 className="text-lg font-semibold text-foreground">Questions fréquentes</h2>
          <dl className="mt-4 space-y-4 text-sm">
            <div>
              <dt className="font-medium text-foreground">Comment se déroule le paiement ?</dt>
              <dd className="text-muted-foreground">
                Après votre commande, un conseiller vous contacte pour encaisser sur place ou
                par transfert. Orange Money et MTN Mobile Money arrivent prochainement.
              </dd>
            </div>
            <div>
              <dt className="font-medium text-foreground">Quand ma balise est-elle posée ?</dt>
              <dd className="text-muted-foreground">
                Dès la confirmation du paiement, une demande d'installation est transmise à un
                agent de votre zone.
              </dd>
            </div>
            <div>
              <dt className="font-medium text-foreground">Puis-je obtenir une facture ?</dt>
              <dd className="text-muted-foreground">
                Oui, une facture PDF est générée automatiquement après confirmation du
                paiement et disponible dans votre espace client.
              </dd>
            </div>
            <div>
              <dt className="font-medium text-foreground">
                Mon adresse sera-t-elle visible par tout le monde ?
              </dt>
              <dd className="text-muted-foreground">
                Non. Une adresse résidentielle reste privée : seule une personne qui connaît
                votre numéro peut afficher la position. Les fiches d'établissement, elles,
                sont publiques par choix du responsable.
              </dd>
            </div>
            <div>
              <dt className="font-medium text-foreground">
                Que se passe-t-il si je déménage ?
              </dt>
              <dd className="text-muted-foreground">
                Signalez-le depuis votre espace client : nous désactivons l'ancienne balise et
                planifions une nouvelle pose à votre nouvelle adresse.
              </dd>
            </div>
            <div>
              <dt className="font-medium text-foreground">
                Y a-t-il un abonnement pour les particuliers ?
              </dt>
              <dd className="text-muted-foreground">
                Non. Les offres résidentielles se règlent une seule fois. Seules les offres
                professionnelles comportent un abonnement mensuel.
              </dd>
            </div>
          </dl>
        </section>
      </div>
    </>
  );
}
