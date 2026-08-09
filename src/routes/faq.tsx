import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";

import { Reveal } from "@/components/Reveal";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { useLangueCms } from "@/hooks/useLangueCms";
import { texte, type CmsFaq } from "@/lib/cms";
import { publicListFaq } from "@/lib/cms-public.functions";
import { cn } from "@/lib/utils";

const BASE = "https://adresse-gn.lovable.app";

export const Route = createFileRoute("/faq")({
  loader: async (): Promise<{ questions: CmsFaq[] }> => ({
    questions: (await publicListFaq()) as CmsFaq[],
  }),
  head: ({ loaderData }) => ({
    meta: [
      { title: "Questions fréquentes — ADRESSE GN" },
      {
        name: "description",
        content:
          "Réponses aux questions fréquentes sur Adresse GN : commande d'une balise, installation par un agent, paiement, abonnement professionnel et confidentialité.",
      },
      { property: "og:title", content: "Questions fréquentes — ADRESSE GN" },
      {
        property: "og:description",
        content:
          "Tout savoir sur la commande, l'installation et l'utilisation de votre adresse GN.",
      },
      { property: "og:type", content: "website" },
      { property: "og:url", content: `${BASE}/faq` },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [{ rel: "canonical", href: `${BASE}/faq` }],
    scripts: loaderData?.questions?.length
      ? [
          {
            type: "application/ld+json",
            children: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "FAQPage",
              mainEntity: loaderData.questions.map((q) => ({
                "@type": "Question",
                name: texte(q.question),
                acceptedAnswer: { "@type": "Answer", text: texte(q.answer) },
              })),
            }),
          },
        ]
      : [],
  }),
  component: FaqPage,
  errorComponent: FaqVide,
  notFoundComponent: FaqVide,
});

function FaqVide() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-24 text-center sm:px-6">
      <h1 className="text-display text-3xl font-extrabold text-foreground">
        Questions fréquentes
      </h1>
      <p className="mt-4 text-slate-500">Aucune question publiée pour le moment.</p>
    </div>
  );
}

function FaqPage() {
  const { questions } = Route.useLoaderData() as { questions: CmsFaq[] };
  const langue = useLangueCms();
  const [categorie, setCategorie] = useState<string>("toutes");

  const categories = useMemo(() => {
    const set = new Set<string>();
    questions.forEach((q) => q.category && set.add(q.category));
    return ["toutes", ...Array.from(set)];
  }, [questions]);

  const liste = questions.filter(
    (q) => categorie === "toutes" || q.category === categorie,
  );

  return (
    <div>
      <section className="gradient-signature relative overflow-hidden px-4 py-16 sm:px-6 sm:py-20">
        <div
          aria-hidden="true"
          className="dot-grid pointer-events-none absolute inset-0 text-white opacity-[0.06]"
        />
        <header className="relative mx-auto max-w-3xl text-center">
          <h1 className="text-display text-4xl font-extrabold leading-tight text-white sm:text-5xl">
            Questions fréquentes
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-base leading-relaxed text-white/75">
            Commande, installation, paiement, confidentialité : les réponses de
            l'équipe Adresse GN.
          </p>
        </header>
      </section>

      <div className="mx-auto max-w-3xl px-4 py-14 sm:px-6 sm:py-20">
        {categories.length > 2 && (
          <div className="mx-auto flex w-fit flex-wrap justify-center gap-1 rounded-full border border-slate-200/60 bg-card p-1.5 shadow-brand">
            {categories.map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => setCategorie(item)}
                className={cn(
                  "rounded-full px-4 py-2 text-sm font-medium transition-all duration-200",
                  categorie === item
                    ? "bg-primary text-primary-foreground"
                    : "text-slate-500 hover:text-primary",
                )}
              >
                {item === "toutes" ? "Toutes" : item}
              </button>
            ))}
          </div>
        )}

        {liste.length === 0 ? (
          <p className="mt-10 text-center text-slate-500">
            Aucune question publiée pour le moment.
          </p>
        ) : (
          <Reveal>
            <Accordion
              type="single"
              collapsible
              className="mt-10 rounded-2xl border border-slate-200/60 bg-card px-6"
            >
              {liste.map((q, index) => (
                <AccordionItem key={q.id} value={`faq-${index}`}>
                  <AccordionTrigger className="text-left text-base font-medium rtl:text-right">
                    {texte(q.question, langue)}
                  </AccordionTrigger>
                  <AccordionContent className="text-sm leading-relaxed text-slate-500">
                    {texte(q.answer, langue)}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </Reveal>
        )}
      </div>
    </div>
  );
}
