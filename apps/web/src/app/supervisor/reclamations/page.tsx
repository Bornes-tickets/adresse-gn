import type {
  Metadata,
} from "next";

import {
  ResourcePage,
} from "@/features/backoffice/components/resource-page";


export const metadata: Metadata = {
  title: "Réclamations — Adresse GN",
};


export default function Page() {
  return (
    <ResourcePage
      title="Réclamations"
      subtitle="Demandes de revendication et décisions associées."
      resource="supervisor_claims"
    />
  );
}