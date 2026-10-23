import type {
  Metadata,
} from "next";

import {
  ResourcePage,
} from "@/features/backoffice/components/resource-page";


export const metadata: Metadata = {
  title: "Exports — Adresse GN",
};


export default function Page() {
  return (
    <ResourcePage
      title="Exports"
      subtitle="Lots et disponibilité des QR pour les exports opérationnels."
      resource="ops_exports"
    />
  );
}