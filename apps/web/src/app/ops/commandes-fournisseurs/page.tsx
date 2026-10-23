import type {
  Metadata,
} from "next";

import {
  ResourcePage,
} from "@/features/backoffice/components/resource-page";


export const metadata: Metadata = {
  title: "Commandes fournisseurs — Adresse GN",
};


export default function Page() {
  return (
    <ResourcePage
      title="Commandes fournisseurs"
      subtitle="Lots, fournisseurs, bons de commande, livraisons et factures."
      resource="ops_procurement"
    />
  );
}