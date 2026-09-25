import type {
  Metadata,
} from "next";

import {
  getPublicCmsFaq,
} from "@/features/content/api";
import {
  cmsText,
} from "@/features/content/types";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Questions fréquentes — Adresse GN",
  description:
    "Réponses aux questions fréquentes sur Adresse GN, les commandes, l’installation et l’utilisation du service.",
};

export default async function Page() {
  const questions =
    await getPublicCmsFaq();

  return (
    <main>
      <section className="relative overflow-hidden bg-gradient-to-br from-slate-950 via-[#11284a] to-[#0B7F7E] px-4 py-16 sm:px-6 sm:py-20">
        <header className="relative mx-auto max-w-3xl text-center">
          <h1 className="text-4xl font-extrabold leading-tight tracking-tight text-white sm:text-5xl">
            Questions fréquentes
          </h1>

          <p className="mx-auto mt-5 max-w-2xl text-base leading-relaxed text-white/75">
            Commande, installation, paiement et utilisation :
            retrouvez les réponses publiées par l’équipe Adresse GN.
          </p>
        </header>
      </section>

      <section className="mx-auto max-w-3xl px-4 py-14 sm:px-6 sm:py-20">
        {questions.length === 0 ? (
          <p className="text-center text-muted-foreground">
            Aucune question publiée pour le moment.
          </p>
        ) : (
          <div className="space-y-3">
            {questions.map((question) => (
              <details
                key={question.id}
                className="group rounded-2xl border bg-card px-5 py-4"
              >
                <summary className="cursor-pointer list-none font-semibold text-foreground">
                  <span className="flex items-start justify-between gap-4">
                    <span>
                      {cmsText(question.question)}
                    </span>

                    <span
                      aria-hidden
                      className="text-muted-foreground transition-transform group-open:rotate-45"
                    >
                      +
                    </span>
                  </span>
                </summary>

                <div className="mt-4 border-t pt-4 text-sm leading-7 text-muted-foreground">
                  {cmsText(question.answer)}
                </div>

                {question.category && (
                  <p className="mt-3 text-xs font-medium uppercase tracking-[0.12em] text-slate-400">
                    {question.category}
                  </p>
                )}
              </details>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
