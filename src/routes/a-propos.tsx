import { Link, createFileRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { Compass, HeartHandshake, ShieldCheck, Users } from "lucide-react";

import { Reveal } from "@/components/Reveal";
import { Button } from "@/components/ui/button";

const VALEURS = [
  { icone: ShieldCheck, cle: "reliability" },
  { icone: HeartHandshake, cle: "privacy" },
  { icone: Compass, cle: "utility" },
  { icone: Users, cle: "local" },
];

const EQUIPE = ["management", "operations", "technology"];


export const Route = createFileRoute("/a-propos")({
  head: () => ({
    meta: [
      { title: "À propos — ADRESSE GN" },
      {
        name: "description",
        content:
          "Adresse GN construit le système d'adressage guinéen : un numéro unique par lieu, une position GPS vérifiée par un agent et un itinéraire fiable pour tous.",
      },
      { property: "og:title", content: "À propos — ADRESSE GN" },
      {
        property: "og:description",
        content:
          "Notre mission : donner à chaque lieu de Guinée une adresse simple à partager et fiable à suivre.",
      },
      { property: "og:url", content: "https://place-id-finder.lovable.app/a-propos" },
      {
        property: "og:image",
        content: "https://place-id-finder.lovable.app/og-cover.jpg",
      },
      {
        name: "twitter:image",
        content: "https://place-id-finder.lovable.app/og-cover.jpg",
      },
    ],
    links: [
      { rel: "canonical", href: "https://place-id-finder.lovable.app/a-propos" },
    ],
  }),
  component: APropos,
});

function APropos() {
  const { t } = useTranslation();

  return (
    <div>
      <section className="bg-linear-to-br from-primary to-[oklch(0.32_0.07_262)] px-4 py-20">
        <div className="mx-auto max-w-3xl text-center">
          <h1 className="text-4xl font-bold tracking-tight text-primary-foreground">
            {t("about.heroTitle")}
          </h1>
          <p className="mt-5 text-lg text-primary-foreground/85">
            {t("about.heroText")}
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-3xl space-y-6 px-4 py-16">
        <Reveal>
          <h2 className="text-2xl font-bold text-foreground">
            {t("about.mission.title")}
          </h2>
          <p className="mt-4 text-muted-foreground">{t("about.mission.text")}</p>
        </Reveal>

        <Reveal>
          <h2 className="mt-10 text-2xl font-bold text-foreground">
            {t("about.vision.title")}
          </h2>
          <p className="mt-4 text-muted-foreground">{t("about.vision.text")}</p>
        </Reveal>
      </section>

      <section
        className="relative bg-primary bg-cover bg-center px-4 py-24"
        style={{
          backgroundImage:
            "url('https://images.unsplash.com/photo-1519501025264-65ba15a82390?w=1600&q=80')",
        }}
      >
        <div className="absolute inset-0 bg-primary/85" aria-hidden="true" />
        <Reveal className="relative mx-auto max-w-3xl text-center">
          <h2 className="font-mono text-sm uppercase tracking-[0.2em] text-primary-foreground/70">
            {t("about.why.eyebrow")}
          </h2>
          <blockquote className="mt-6 text-2xl font-semibold leading-snug text-primary-foreground sm:text-3xl">
            {t("about.why.quote")}
          </blockquote>
        </Reveal>
      </section>

      <section className="mx-auto max-w-5xl px-4 py-16">
        <Reveal>
          <h2 className="text-2xl font-bold text-foreground">
            {t("about.valuesTitle")}
          </h2>
        </Reveal>
        <div className="mt-8 grid gap-6 sm:grid-cols-2">
          {VALEURS.map((valeur, index) => (
            <Reveal key={valeur.cle} delay={index * 80}>
              <div className="h-full rounded-xl border border-border bg-card p-6 transition-transform duration-200 hover:scale-[1.02]">
                <span className="inline-flex size-11 items-center justify-center rounded-lg bg-accent/10 text-accent">
                  <valeur.icone className="size-5" />
                </span>
                <h3 className="mt-4 text-base font-semibold text-foreground">
                  {t(`about.values.${valeur.cle}.title`)}
                </h3>
                <p className="mt-2 text-sm text-muted-foreground">
                  {t(`about.values.${valeur.cle}.text`)}
                </p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-4 pb-16">
        <Reveal>
          <h2 className="text-2xl font-bold text-foreground">
            {t("about.team.title")}
          </h2>
          <p className="mt-3 text-sm text-muted-foreground">
            {t("about.team.text")}
          </p>
        </Reveal>
        <div className="mt-8 grid gap-4 sm:grid-cols-3">
          {EQUIPE.map((membre, index) => (
            <Reveal key={membre} delay={index * 80}>
              <div className="rounded-xl border border-border bg-card p-6">
                <div
                  className="size-12 rounded-full bg-muted"
                  aria-hidden="true"
                />
                <h3 className="mt-4 text-sm font-semibold text-foreground">
                  {t(`about.team.${membre}`)}
                </h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  {t("about.team.soon")}
                </p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-4 pb-20">
        <Reveal>
          <div className="rounded-2xl border border-border bg-card px-6 py-10 text-center">
            <h2 className="text-2xl font-bold text-foreground">
              {t("about.cta.title")}
            </h2>
            <Button asChild size="lg" className="mt-6">
              <Link to="/tarifs">{t("about.cta.button")}</Link>
            </Button>
          </div>
        </Reveal>
      </section>

    </div>
  );
}
