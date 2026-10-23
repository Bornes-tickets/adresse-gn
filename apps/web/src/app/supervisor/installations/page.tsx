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
      subtitle="Installations terrain, précision GPS et état de validation."
      resource="supervisor_installations"
    />
  );
}