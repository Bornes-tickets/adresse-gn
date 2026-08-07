import { Link, createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import {
  Building2,
  Check,
  Headphones,
  Home as HomeIcon,
  Landmark,
  Minus,
  ShieldCheck,
  Store,
  Wallet,
} from "lucide-react";

import { Reveal } from "@/components/Reveal";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { OFFERS, type Offer, type OfferFamily } from "@/lib/pricing";
import { cn } from "@/lib/utils";

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

const FAMILLES: { key: OfferFamily; label: string; icone: typeof HomeIcon }[] = [
  { key: "residential", label: "Résidentiel", icone: HomeIcon },
  { key: "pro", label: "Professionnel", icone: Store },
  { key: "quote", label: "Institutionnel", icone: Landmark },
];

const RECOMMANDEES: Record<OfferFamily, string> = {
  residential: "residential_standard",
  pro: "pro_plus",
  quote: "institutional",
};

const ICONES_OFFRE: Record<string, typeof HomeIcon> = {
  residential_digital: HomeIcon,
  residential_standard: HomeIcon,
  residential_premium: ShieldCheck,
  pro_basic: Store,
  pro_plus: Building2,
  multi_site: Building2,
  institutional: Landmark,
};

const COMPARATEUR: { critere: string; valeurs: Record<string, string | boolean> }[] = [
  {
    critere: "Numéro d'adresse unique",
    valeurs: {
      residential_digital: true,
      residential_standard: true,
      residential_premium: true,
      pro_basic: true,
      pro_plus: true,
    },
  },
  {
    critere: "Balise physique avec QR code",
    valeurs: {
      residential_digital: false,
      residential_standard: true,
      residential_premium: true,
      pro_basic: true,
      pro_plus: true,
    },
  },
  {
    critere: "Pose par un agent agréé",
    valeurs: {
      residential_digital: false,
      residential_standard: true,
      residential_premium: "Prioritaire 72 h",
      pro_basic: true,
      pro_plus: "Prioritaire",
    },
  },
  {
    critere: "Fiche établissement publique",
    valeurs: {
      residential_digital: false,
      residential_standard: false,
      residential_premium: false,
      pro_basic: true,
      pro_plus: "Enrichie",
    },
  },
  {
    critere: "Statistiques de consultation",
    valeurs: {
      residential_digital: false,
      residential_standard: false,
      residential_premium: false,
      pro_basic: "30 jours",
      pro_plus: "90 jours",
    },
  },
  {
    critere: "Comptes d'équipe",
    valeurs: {
      residential_digital: false,
      residential_standard: false,
      residential_premium: false,
      pro_basic: false,
      pro_plus: true,
    },
  },
  {
    critere: "Abonnement mensuel",
    valeurs: {
      residential_digital: "Aucun",
      residential_standard: "Aucun",
      residential_premium: "Aucun",
      pro_basic: "50 000 GNF",
      pro_plus: "150 000 GNF",
    },
  },
];

const COLONNES_COMPARATEUR = [
  "residential_digital",
  "residential_standard",
  "residential_premium",
  "pro_basic",
  "pro_plus",
];

const FAQ = [
  {
    q: "Comment se déroule le paiement ?",
    r: "Après votre commande, un conseiller vous contacte pour encaisser sur place ou par transfert. Orange Money et MTN Mobile Money arrivent prochainement.",
  },
  {
    q: "Quand ma balise est-elle posée ?",
    r: "Dès la confirmation du paiement, une demande d'installation est transmise à un agent de votre zone.",
  },
  {
    q: "Puis-je obtenir une facture ?",
    r: "Oui, une facture PDF est générée automatiquement après confirmation du paiement et disponible dans votre espace client.",
  },
  {
    q: "Mon adresse sera-t-elle visible par tout le monde ?",
    r: "Non. Une adresse résidentielle reste privée : seule une personne qui connaît votre numéro peut afficher la position. Les fiches d'établissement, elles, sont publiques par choix du responsable.",
  },
  {
    q: "Que se passe-t-il si je déménage ?",
    r: "Signalez-le depuis votre espace client : nous désactivons l'ancienne balise et planifions une nouvelle pose à votre nouvelle adresse.",
  },
  {
    q: "Y a-t-il un abonnement pour les particuliers ?",
    r: "Non. Les offres résidentielles se règlent une seule fois. Seules les offres professionnelles comportent un abonnement mensuel.",
  },
];

function gnf(montant: number): string {
  return montant.toLocaleString("fr-FR");
}

function CarteOffre({ offre, vedette }: { offre: Offer; vedette: boolean }) {
  const Icone = ICONES_OFFRE[offre.code] ?? HomeIcon;
  return (
    <div
      className={cn(
        "flex h-full flex-col rounded-2xl border bg-card p-6 transition-all duration-200 sm:p-8",
        vedette
          ? "-translate-y-2 border-transparent ring-2 ring-accent shadow-brand-lg"
          : "border-slate-200/60 hover:-translate-y-1 hover:shadow-brand",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <span className="inline-flex size-12 items-center justify-center rounded-xl bg-accent/10 text-accent">
          <Icone className="size-6" />
        </span>
        {vedette && (
          <Badge className="rounded-full bg-accent px-3 py-1 text-xs font-medium text-accent-foreground">
            Plus populaire
          </Badge>
        )}
      </div>

      <h3 className="text-display mt-6 text-xl font-bold text-foreground">
        {offre.label}
      </h3>
      <p className="mt-2 text-sm leading-relaxed text-slate-500">{offre.tagline}</p>

      <div className="mt-6">
        {offre.quoteOnly ? (
          <p className="text-display text-3xl font-extrabold text-primary">
            Sur devis
          </p>
        ) : (
          <>
            <p className="text-display flex items-baseline gap-2 text-primary">
              <span className="font-mono text-4xl font-extrabold tracking-tight">
                {gnf(offre.setup_gnf)}
              </span>
              <span className="text-sm font-semibold text-slate-500">GNF</span>
            </p>
            <p className="mt-2 text-xs text-slate-500">
              {offre.monthly_gnf > 0
                ? `à l'installation, puis ${gnf(offre.monthly_gnf)} GNF par mois`
                : "paiement unique, sans abonnement"}
            </p>
          </>
        )}
      </div>

      <ul className="mt-8 flex-1 space-y-3 text-sm text-foreground">
        {offre.includes.map((ligne) => (
          <li key={ligne} className="flex gap-2.5">
            <Check className="mt-0.5 size-4 shrink-0 text-accent" />
            <span className="leading-relaxed">{ligne}</span>
          </li>
        ))}
      </ul>

      <div className="mt-8">
        {offre.quoteOnly ? (
          <Button variant="outline" className="h-12 w-full text-base" asChild>
            <a href="mailto:commercial@adresse.gn?subject=Demande%20de%20devis">
              Demander un devis
            </a>
          </Button>
        ) : (
          <Button
            className={cn(
              "h-12 w-full text-base font-medium transition-transform duration-200 hover:scale-[1.02] active:scale-[0.98]",
              vedette
                ? "bg-accent text-accent-foreground hover:bg-accent-dark"
                : "",
            )}
            variant={vedette ? "default" : "outline"}
            asChild
          >
            <Link to="/commander/$offerCode" params={{ offerCode: offre.code }}>
              Choisir
            </Link>
          </Button>
        )}
      </div>
    </div>
  );
}

function CelluleComparateur({ valeur }: { valeur: string | boolean | undefined }) {
  if (valeur === true)
    return <Check className="mx-auto size-4 text-accent" aria-label="Inclus" />;
  if (valeur === false || valeur === undefined)
    return <Minus className="mx-auto size-4 text-slate-300" aria-label="Non inclus" />;
  return <span className="text-xs text-slate-600">{valeur}</span>;
}

function TarifsPage() {
  const [famille, setFamille] = useState<OfferFamily>("residential");
  const offres = OFFERS.filter((o) => o.family === famille);

  return (
    <>
      <section className="gradient-signature relative overflow-hidden px-4 py-20 sm:px-6 sm:py-28">
        <div
          aria-hidden="true"
          className="dot-grid pointer-events-none absolute inset-0 text-white opacity-[0.06]"
        />
        <header className="relative mx-auto max-w-3xl text-center">
          <h1 className="text-display text-4xl font-extrabold leading-[1.05] text-white sm:text-5xl lg:text-[3.5rem]">
            Des tarifs simples,
            <span className="block text-white/80">en francs guinéens</span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-base leading-relaxed text-white/75 sm:text-lg">
            Choisissez l'offre adaptée à votre logement ou à votre commerce. Vous
            réglez sur place ou par Mobile Money, puis un agent agréé vient poser
            votre balise.
          </p>
        </header>
      </section>

      <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-24">
        <div
          role="tablist"
          aria-label="Type d'offre"
          className="mx-auto flex w-fit flex-wrap justify-center gap-1 rounded-full border border-slate-200/60 bg-card p-1.5 shadow-brand"
        >
          {FAMILLES.map((item) => (
            <button
              key={item.key}
              role="tab"
              type="button"
              aria-selected={famille === item.key}
              onClick={() => setFamille(item.key)}
              className={cn(
                "inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-medium transition-all duration-200 focus-visible:ring-2 focus-visible:ring-accent/40 focus-visible:outline-hidden",
                famille === item.key
                  ? "bg-primary text-primary-foreground"
                  : "text-slate-500 hover:text-primary",
              )}
            >
              <item.icone className="size-4" />
              {item.label}
            </button>
          ))}
        </div>

        <div
          className={cn(
            "mt-12 grid gap-6",
            offres.length >= 3 ? "lg:grid-cols-3" : "md:grid-cols-2",
          )}
        >
          {offres.map((offre, index) => (
            <Reveal key={offre.code} delay={index * 90} className="h-full">
              <CarteOffre
                offre={offre}
                vedette={offre.code === RECOMMANDEES[famille]}
              />
            </Reveal>
          ))}
        </div>

        <section className="mt-24">
          <Reveal>
            <h2 className="text-display text-center text-3xl font-extrabold text-foreground sm:text-4xl">
              Comparer les offres
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-center text-slate-500">
              Ce que chaque formule inclut, en un coup d'œil.
            </p>
          </Reveal>
          <div className="mt-10 overflow-x-auto rounded-2xl border border-slate-200/60 bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="min-w-[200px]">Fonctionnalité</TableHead>
                  {COLONNES_COMPARATEUR.map((code) => (
                    <TableHead key={code} className="min-w-[120px] text-center">
                      {OFFERS.find((o) => o.code === code)?.label}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {COMPARATEUR.map((ligne) => (
                  <TableRow key={ligne.critere}>
                    <TableCell className="font-medium text-foreground">
                      {ligne.critere}
                    </TableCell>
                    {COLONNES_COMPARATEUR.map((code) => (
                      <TableCell key={code} className="text-center">
                        <CelluleComparateur valeur={ligne.valeurs[code]} />
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </section>

        <section className="mt-24">
          <Reveal>
            <h2 className="text-display text-center text-3xl font-extrabold text-foreground sm:text-4xl">
              Questions fréquentes
            </h2>
          </Reveal>
          <Accordion
            type="single"
            collapsible
            className="mx-auto mt-10 max-w-3xl rounded-2xl border border-slate-200/60 bg-card px-6"
          >
            {FAQ.map((item, index) => (
              <AccordionItem key={item.q} value={`faq-${index}`}>
                <AccordionTrigger className="text-left text-base font-medium">
                  {item.q}
                </AccordionTrigger>
                <AccordionContent className="text-sm leading-relaxed text-slate-500">
                  {item.r}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </section>

        <section className="mt-24 grid gap-8 rounded-2xl border border-slate-200/60 bg-card p-8 sm:grid-cols-3 sm:p-10">
          {[
            {
              icone: ShieldCheck,
              titre: "Vos données protégées",
              texte:
                "Adresse privée par défaut, conforme aux lois guinéennes L/2016/037 et L/2016/035.",
            },
            {
              icone: Wallet,
              titre: "Paiement sécurisé",
              texte:
                "Encaissement par agent agréé ou Mobile Money, avec facture PDF systématique.",
            },
            {
              icone: Headphones,
              titre: "Support en français",
              texte:
                "Une équipe joignable par WhatsApp et par e-mail, basée à Conakry.",
            },
          ].map((item, index) => (
            <Reveal key={item.titre} delay={index * 80}>
              <div className="flex gap-4">
                <span className="inline-flex size-11 shrink-0 items-center justify-center rounded-xl bg-accent/10 text-accent">
                  <item.icone className="size-5" />
                </span>
                <div className="min-w-0">
                  <h3 className="font-semibold text-foreground">{item.titre}</h3>
                  <p className="mt-1 text-sm leading-relaxed text-slate-500">
                    {item.texte}
                  </p>
                </div>
              </div>
            </Reveal>
          ))}
        </section>
      </div>
    </>
  );
}
