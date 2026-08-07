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
import { useTranslation } from "react-i18next";

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

const FAMILLES: { key: OfferFamily; labelKey: string; icone: typeof HomeIcon }[] = [
  { key: "residential", labelKey: "pricing.families.residential", icone: HomeIcon },
  { key: "pro", labelKey: "pricing.families.pro", icone: Store },
  { key: "quote", labelKey: "pricing.families.quote", icone: Landmark },
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

const COMPARATEUR: { critereKey: string; valeurs: Record<string, string | boolean> }[] = [
  {
    critereKey: "pricing.comparator.rows.uniqueNumber",
    valeurs: {
      residential_digital: true,
      residential_standard: true,
      residential_premium: true,
      pro_basic: true,
      pro_plus: true,
    },
  },
  {
    critereKey: "pricing.comparator.rows.physicalBeacon",
    valeurs: {
      residential_digital: false,
      residential_standard: true,
      residential_premium: true,
      pro_basic: true,
      pro_plus: true,
    },
  },
  {
    critereKey: "pricing.comparator.rows.installByAgent",
    valeurs: {
      residential_digital: false,
      residential_standard: true,
      residential_premium: "priority72h",
      pro_basic: true,
      pro_plus: "priority",
    },
  },
  {
    critereKey: "pricing.comparator.rows.publicListing",
    valeurs: {
      residential_digital: false,
      residential_standard: false,
      residential_premium: false,
      pro_basic: true,
      pro_plus: "enriched",
    },
  },
  {
    critereKey: "pricing.comparator.rows.stats",
    valeurs: {
      residential_digital: false,
      residential_standard: false,
      residential_premium: false,
      pro_basic: "days30",
      pro_plus: "days90",
    },
  },
  {
    critereKey: "pricing.comparator.rows.teamAccounts",
    valeurs: {
      residential_digital: false,
      residential_standard: false,
      residential_premium: false,
      pro_basic: false,
      pro_plus: true,
    },
  },
  {
    critereKey: "pricing.comparator.rows.monthlySubscription",
    valeurs: {
      residential_digital: "none",
      residential_standard: "none",
      residential_premium: "none",
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

const FAQ_KEYS = [
  "payment",
  "installation",
  "invoice",
  "visibility",
  "moving",
  "subscription",
];

function gnf(montant: number): string {
  return montant.toLocaleString("fr-FR");
}

function usePlanTextes(offre: Offer) {
  const { t } = useTranslation();
  const features = t(`pricing.plans.${offre.code}.features`, {
    returnObjects: true,
    defaultValue: offre.includes,
  }) as string[];
  return {
    label: t(`pricing.plans.${offre.code}.title`, { defaultValue: offre.label }),
    description: t(`pricing.plans.${offre.code}.description`, {
      defaultValue: offre.tagline,
    }),
    features: Array.isArray(features) ? features : offre.includes,
  };
}

function CarteOffre({ offre, vedette }: { offre: Offer; vedette: boolean }) {
  const { t } = useTranslation();
  const textes = usePlanTextes(offre);
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
            {t("pricing.card.popular")}
          </Badge>
        )}
      </div>

      <h3 className="text-display mt-6 text-xl font-bold text-foreground">
        {textes.label}
      </h3>
      <p className="mt-2 text-sm leading-relaxed text-slate-500">
        {textes.description}
      </p>


      <div className="mt-6">
        {offre.quoteOnly ? (
          <p className="text-display text-3xl font-extrabold text-primary">
            {t("pricing.card.quoteOnly")}
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
                ? t("pricing.card.perMonth", { amount: gnf(offre.monthly_gnf) })
                : t("pricing.card.oneTime")}
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
              {t("pricing.card.requestQuote")}
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
              {t("pricing.card.choose")}
            </Link>
          </Button>
        )}
      </div>
    </div>
  );
}

function CelluleComparateur({ valeur }: { valeur: string | boolean | undefined }) {
  const { t } = useTranslation();
  if (valeur === true)
    return (
      <Check
        className="mx-auto size-4 text-accent"
        aria-label={t("pricing.comparator.included")}
      />
    );
  if (valeur === false || valeur === undefined)
    return (
      <Minus
        className="mx-auto size-4 text-slate-300"
        aria-label={t("pricing.comparator.notIncluded")}
      />
    );
  const knownValues = ["none", "days30", "days90", "priority72h", "priority", "enriched"];
  const texte = knownValues.includes(valeur)
    ? t(`pricing.comparator.values.${valeur}`)
    : valeur;
  return <span className="text-xs text-slate-600">{texte}</span>;
}

function TarifsPage() {
  const { t } = useTranslation();
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
            {t("pricing.hero.title")}
            <span className="block text-white/80">{t("pricing.hero.titleAccent")}</span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-base leading-relaxed text-white/75 sm:text-lg">
            {t("pricing.hero.subtitle")}
          </p>
        </header>
      </section>

      <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-24">
        <div
          role="tablist"
          aria-label={t("pricing.tabsAriaLabel")}
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
              {t(item.labelKey)}
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
              {t("pricing.comparator.title")}
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-center text-slate-500">
              {t("pricing.comparator.subtitle")}
            </p>
          </Reveal>
          <div className="mt-10 overflow-x-auto rounded-2xl border border-slate-200/60 bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="min-w-[200px]">
                    {t("pricing.comparator.featureHeader")}
                  </TableHead>
                  {COLONNES_COMPARATEUR.map((code) => (
                    <TableHead key={code} className="min-w-[120px] text-center">
                      {OFFERS.find((o) => o.code === code)?.label}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {COMPARATEUR.map((ligne) => (
                  <TableRow key={ligne.critereKey}>
                    <TableCell className="font-medium text-foreground">
                      {t(ligne.critereKey)}
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
              {t("pricing.faq.title")}
            </h2>
          </Reveal>
          <Accordion
            type="single"
            collapsible
            className="mx-auto mt-10 max-w-3xl rounded-2xl border border-slate-200/60 bg-card px-6"
          >
            {FAQ_KEYS.map((key, index) => (
              <AccordionItem key={key} value={`faq-${index}`}>
                <AccordionTrigger className="text-left text-base font-medium">
                  {t(`pricing.faq.items.${key}.q`)}
                </AccordionTrigger>
                <AccordionContent className="text-sm leading-relaxed text-slate-500">
                  {t(`pricing.faq.items.${key}.r`)}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </section>

        <section className="mt-24 grid gap-8 rounded-2xl border border-slate-200/60 bg-card p-8 sm:grid-cols-3 sm:p-10">
          {[
            {
              icone: ShieldCheck,
              titre: t("pricing.trust.data.title"),
              texte: t("pricing.trust.data.text"),
            },
            {
              icone: Wallet,
              titre: t("pricing.trust.payment.title"),
              texte: t("pricing.trust.payment.text"),
            },
            {
              icone: Headphones,
              titre: t("pricing.trust.support.title"),
              texte: t("pricing.trust.support.text"),
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
