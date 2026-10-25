import type {
  Metadata,
} from "next";

import {
  Hash,
  PackagePlus,
  ShieldCheck,
  Workflow,
} from "lucide-react";

import {
  ResourcePage,
} from "@/features/backoffice/components/resource-page";


export const metadata: Metadata = {
  title: "Balises — Administration — Adresse GN",
};


const PRINCIPLES = [
  {
    icon: Hash,
    title: "Codification nationale V1",
    text: (
      "Chaque balise reçoit un numéro permanent "
      + "CCCCC-NNNNNNNNC avec clé Verhoeff."
    ),
  },
  {
    icon: PackagePlus,
    title: "Génération par lot",
    text: (
      "L’Admin prépare le lot numérique avant "
      + "la commande physique gérée par OPS."
    ),
  },
  {
    icon: Workflow,
    title: "Séparation des responsabilités",
    text: (
      "Admin génère, OPS approvisionne, "
      + "le Superviseur affecte et valide."
    ),
  },
];


export default function Page() {
  return (
    <div className="space-y-7">
      <section className="relative overflow-hidden rounded-[28px] border border-slate-800 bg-slate-950 p-6 text-white shadow-xl shadow-slate-950/10 sm:p-8 lg:p-10">
        <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-blue-500/15 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-32 left-1/3 h-80 w-80 rounded-full bg-emerald-400/10 blur-3xl" />

        <div className="relative">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.16em] text-slate-200">
            <ShieldCheck className="h-4 w-4" />
            Référentiel national · V1
          </div>

          <div className="mt-6 max-w-4xl">
            <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl lg:text-5xl">
              Génération des balises
            </h1>

            <p className="mt-4 max-w-3xl text-sm leading-6 text-slate-300 sm:text-base">
              Créez les lots de balises Adresse GN avec la
              codification nationale officielle. Les balises
              restent au statut généré jusqu’à leur prise en
              charge par OPS pour l’approvisionnement fournisseur.
            </p>
          </div>

          <div className="mt-8 grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl border border-white/10 bg-white/[0.06] p-4 backdrop-blur">
              <p className="text-xs font-medium uppercase tracking-[0.14em] text-slate-400">
                Format officiel
              </p>
              <p className="mt-2 font-mono text-lg font-semibold text-white">
                CCCCC-NNNNNNNNC
              </p>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/[0.06] p-4 backdrop-blur">
              <p className="text-xs font-medium uppercase tracking-[0.14em] text-slate-400">
                Autorité
              </p>
              <p className="mt-2 text-lg font-semibold text-white">
                Administration
              </p>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/[0.06] p-4 backdrop-blur">
              <p className="text-xs font-medium uppercase tracking-[0.14em] text-slate-400">
                Étape suivante
              </p>
              <p className="mt-2 text-lg font-semibold text-white">
                OPS · Achats fournisseur
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        {PRINCIPLES.map(
          (item) => {
            const Icon = item.icon;

            return (
              <article
                key={item.title}
                className="group rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-950 text-white shadow-sm">
                  <Icon className="h-5 w-5" />
                </div>

                <h2 className="mt-4 text-base font-semibold text-slate-950">
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
        title="Registre des balises"
        subtitle="Consultez les numéros générés, leur lot, leur commune d’émission et leur état dans le cycle opérationnel."
        resource="admin_beacons"
      />
    </div>
  );
}
