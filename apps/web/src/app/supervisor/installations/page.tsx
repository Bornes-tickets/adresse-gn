import type {
  Metadata,
} from "next";

import {
  ResourcePage,
} from "@/features/backoffice/components/resource-page";


export const metadata: Metadata = {
  title: "Installations / QC — Adresse GN",
};


export default function Page() {
  return (
    <ResourcePage
      title="Installations / QC"
      subtitle="Pilotage des demandes physiques : affectation, planification et contrôle QC."
      resource="supervisor_installations"
    />
  );
}