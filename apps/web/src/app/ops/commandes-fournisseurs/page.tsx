import type {
  Metadata,
} from "next";

import {
  ClipboardCheck,
  PackageOpen,
  ReceiptText,
  Truck,
} from "lucide-react";

import {
  ResourcePage,
} from "@/features/backoffice/components/resource-page";


export const metadata: Metadata = {
  title: "Achats fournisseurs — OPS — Adresse GN",
};


const STEPS = [
  {
    icon: ReceiptText,
    title: "Bon de commande",
    text: (
      "Préparez le BC à partir du lot généré "
      + "et du fournisseur sélectionné."
    ),
  },
  {
    icon: Truck,
    title: "Expédition & réception",
    text: (
      "Enregistrez chaque livraison, y compris "
      + "les réceptions partielles successives."
    ),
  },
  {
    icon: ClipboardCheck,
    title: "Contrôle qualité",
    text: (
      "Seules les quantités reçues et conformes "
      + "libèrent des balises dans le stock disponible."
    ),
  },
];


export default function Page() {
  return (
    <div className="space-y-7">
      <section className="relative overflow-hidden rounded-[28px] border border-slate-800 bg-slate-950 p-6 text-white shadow-xl shadow-slate-950/10 sm:p-8 lg:p-10">
        <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-blue-500/15 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-28 left-1/3 h-72 w-72 rounded-full bg-emerald-500/10 blur-3xl" />

        <div className="relative">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.16em] text-slate-200">
            <PackageOpen className="h-4 w-4" />
            OPS · Procurement
          </div>

          <h1 className="mt-6 text-3xl font-semibold tracking-tight sm:text-4xl lg:text-5xl">
            Achats & réceptions fournisseurs
          </h1>

          <p className="mt-4 max-w-3xl text-sm leading-6 text-slate-300 sm:text-base">
            Suivez les lots depuis le bon de commande jusqu’à la
            réception et au contrôle qualité. Les réceptions partielles
            sont cumulées sans jamais dépasser la quantité commandée.
          </p>

          <div className="mt-7 inline-flex rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-3 text-sm text-slate-200">
            BC → expédition → réception → QC → stock disponible
          </div>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        {STEPS.map(
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
        title="Dossiers fournisseurs"
        subtitle="Lots, fournisseurs, bons de commande, dernier BL, cumuls reçus, quantités acceptées, factures et règlements."
        resource="ops_procurement"
      />
    </div>
  );
}
