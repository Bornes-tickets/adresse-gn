import type {
  Metadata,
} from "next";

import {
  SalesDataPage,
} from "@/features/sales/components/sales-data-page";


export const metadata: Metadata = {
  title: "Installations — Adresse GN",
};


export default function Page() {
  return (
    <div className="space-y-4">
      <section className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3">
        <p className="text-sm font-semibold text-blue-950">
          Suivi commercial en lecture seule
        </p>

        <p className="mt-1 text-sm text-blue-800">
          Vous pouvez consulter l&apos;avancement des installations.
          L&apos;affectation des agents et la planification restent sous
          la responsabilité du superviseur.
        </p>
      </section>

      <SalesDataPage
        mode="installations"
      />
    </div>
  );
}
