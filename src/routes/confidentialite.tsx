import { createFileRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";

const SOMMAIRE_IDS = [
  "responsable",
  "donnees",
  "finalites",
  "visibilite",
  "partage",
  "conservation",
  "droits",
  "securite",
  "contact",
] as const;

export const Route = createFileRoute("/confidentialite")({
  head: () => ({
    meta: [
      { title: "Confidentialité — ADRESSE GN" },
      {
        name: "description",
        content:
          "Comment Adresse GN collecte, protège et utilise les données liées aux adresses, aux balises et aux comptes, conformément aux lois guinéennes L/2016/037 et L/2016/035.",
      },
      { property: "og:title", content: "Confidentialité — ADRESSE GN" },
      {
        property: "og:description",
        content:
          "Politique de confidentialité d'Adresse GN : données collectées, visibilité des adresses, conservation et exercice de vos droits.",
      },
      {
        property: "og:url",
        content: "https://place-id-finder.lovable.app/confidentialite",
      },
    ],
    links: [
      {
        rel: "canonical",
        href: "https://place-id-finder.lovable.app/confidentialite",
      },
    ],
  }),
  component: Confidentialite,
});

function Confidentialite() {
  const { t } = useTranslation();

  return (
    <>
      <section className="gradient-signature relative overflow-hidden px-4 py-16 sm:px-6 sm:py-20">
        <div
          aria-hidden="true"
          className="dot-grid pointer-events-none absolute inset-0 text-white opacity-[0.06]"
        />
        <div className="relative mx-auto max-w-3xl">
          <h1 className="text-display text-3xl font-extrabold leading-tight text-white sm:text-4xl">
            {t("privacy.hero.title")}
          </h1>
          <p className="mt-4 text-sm text-white/70">
            {t("privacy.hero.lastUpdated")}
          </p>
        </div>
      </section>

      <div className="mx-auto max-w-3xl px-4 py-14 sm:px-6">
        <nav
          aria-label={t("privacy.toc.ariaLabel")}
          className="shadow-brand rounded-2xl border border-slate-200/60 bg-card p-6"
        >
          <h2 className="text-sm font-semibold text-foreground">
            {t("privacy.toc.title")}
          </h2>
          <ol className="mt-3 space-y-1.5 text-sm text-slate-500">
            {SOMMAIRE_IDS.map((id) => (
              <li key={id}>
                <a
                  href={`#${id}`}
                  className="transition-colors hover:text-accent"
                >
                  {t(`privacy.toc.items.${id}`)}
                </a>
              </li>
            ))}
          </ol>
        </nav>

        <div className="mt-12 space-y-10 leading-relaxed text-slate-500">

        <section id="responsable">
          <h2 className="text-xl font-semibold text-foreground">
            {t("privacy.sections.responsable.title")}
          </h2>
          <p className="mt-3">{t("privacy.sections.responsable.body")}</p>
        </section>

        <section id="donnees">
          <h2 className="text-xl font-semibold text-foreground">
            {t("privacy.sections.donnees.title")}
          </h2>
          <h3 className="mt-4 font-medium text-foreground">
            {t("privacy.sections.donnees.account.title")}
          </h3>
          <p className="mt-2">{t("privacy.sections.donnees.account.body")}</p>
          <h3 className="mt-4 font-medium text-foreground">
            {t("privacy.sections.donnees.address.title")}
          </h3>
          <p className="mt-2">{t("privacy.sections.donnees.address.body")}</p>
          <h3 className="mt-4 font-medium text-foreground">
            {t("privacy.sections.donnees.usage.title")}
          </h3>
          <p className="mt-2">{t("privacy.sections.donnees.usage.body")}</p>
          <h3 className="mt-4 font-medium text-foreground">
            {t("privacy.sections.donnees.payment.title")}
          </h3>
          <p className="mt-2">{t("privacy.sections.donnees.payment.body")}</p>
        </section>

        <section id="finalites">
          <h2 className="text-xl font-semibold text-foreground">
            {t("privacy.sections.finalites.title")}
          </h2>
          <ul className="mt-3 list-disc space-y-2 pl-5">
            <li>{t("privacy.sections.finalites.items.create")}</li>
            <li>{t("privacy.sections.finalites.items.search")}</li>
            <li>{t("privacy.sections.finalites.items.planning")}</li>
            <li>{t("privacy.sections.finalites.items.orders")}</li>
            <li>{t("privacy.sections.finalites.items.fraud")}</li>
          </ul>
        </section>

        <section id="visibilite">
          <h2 className="text-xl font-semibold text-foreground">
            {t("privacy.sections.visibilite.title")}
          </h2>
          <p className="mt-3">{t("privacy.sections.visibilite.p1")}</p>
          <p className="mt-3">{t("privacy.sections.visibilite.p2")}</p>
        </section>

        <section id="partage">
          <h2 className="text-xl font-semibold text-foreground">
            {t("privacy.sections.partage.title")}
          </h2>
          <p className="mt-3">{t("privacy.sections.partage.body")}</p>
        </section>

        <section id="conservation">
          <h2 className="text-xl font-semibold text-foreground">
            {t("privacy.sections.conservation.title")}
          </h2>
          <p className="mt-3">{t("privacy.sections.conservation.body")}</p>
        </section>

        <section id="droits">
          <h2 className="text-xl font-semibold text-foreground">
            {t("privacy.sections.droits.title")}
          </h2>
          <p className="mt-3">{t("privacy.sections.droits.body")}</p>
        </section>

        <section id="securite">
          <h2 className="text-xl font-semibold text-foreground">
            {t("privacy.sections.securite.title")}
          </h2>
          <p className="mt-3">{t("privacy.sections.securite.body")}</p>
        </section>

        <section id="contact">
          <h2 className="text-xl font-semibold text-foreground">
            {t("privacy.sections.contact.title")}
          </h2>
          <p className="mt-3">
            {t("privacy.sections.contact.before")}{" "}
            <a
              href="mailto:confidentialite@adresse.gn"
              className="text-primary hover:underline"
            >
              confidentialite@adresse.gn
            </a>
            {t("privacy.sections.contact.after")}
          </p>
        </section>
        </div>
      </div>
    </>

  );
}
