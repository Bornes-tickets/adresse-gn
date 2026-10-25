import type {
  Metadata,
} from "next";

import {
  Boxes,
  CheckCircle2,
  PackageCheck,
  Warehouse,
} from "lucide-react";

import {
  ResourcePage,
} from "@/features/backoffice/components/resource-page";


export const metadata: Metadata = {
  title: "Stock — OPS — Adresse GN",
};


const CARDS = [
  {
    icon: Warehouse,
    title: "Stock centralisé",
    text: (
      "Visualisez les quantités commandées et les "
      + "états réels des balises pour chaque lot."
    ),
  },
  {
    icon: PackageCheck,
    title: "Disponible après QC",
    text: (
      "Le stock disponible correspond uniquement "
      + "aux réceptions fournisseur conformes."
    ),
  },
  {
    icon: CheckCircle2,
    title: "Traçabilité",
    text: (
      "Les états généré, disponible, affecté, installé "
      + "et actif restent séparés et mesurables."
    ),
  },
];


export default function Page() {
  return (
    <div className="space-y-7">
      <section className="relative overflow-hidden rounded-[28px] border border-slate-800 bg-slate-950 p-6 text-white shadow-xl shadow-slate-950/10 sm:p-8 lg:p-10">
        <div className="pointer-events-none absolute -right-20 -top-24 h-72 w-72 rounded-full bg-emerald-500/15 blur-3xl" />

        <div className="relative">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.16em] text-slate-200">
            <Boxes className="h-4 w-4" />
            OPS · Inventaire
          </div>

          <h1 className="mt-6 text-3xl font-semibold tracking-tight sm:text-4xl lg:text-5xl">
            Stock & disponibilité
          </h1>

          <p className="mt-4 max-w-3xl text-sm leading-6 text-slate-300 sm:text-base">
            Pilotez le stock physique par lot avec une distinction
            nette entre les balises générées, réellement disponibles
            après contrôle et celles déjà engagées sur le terrain.
          </p>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        {CARDS.map(
          (item) => {
            const Icon = item.icon;

            return (
              <article
                key={item.title}
                className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-950 text-white">
                  <Icon className="h-5 w-5" />
                </div>

                <h2 className="mt-4 font-semibold text-slate-950">
                  {item.title}
                </h2>

                <p className="mt-2 text-sm leading-6 text-slate-500">
                  {item.text}
                </p>
              </article>
            );
          },
        )}
      </section>

      <ResourcePage
        title="Inventaire par lot"
        subtitle="Quantités commandées, générées, disponibles, affectées, installées et actives."
        resource="ops_stock"
      />
    </div>
  );
}
