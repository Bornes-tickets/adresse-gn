import type {
  Metadata,
} from "next";

import {
  ResourcePage,
} from "@/features/backoffice/components/resource-page";


export const metadata: Metadata = {
  title: "Commandes — Adresse GN",
};


export default function Page() {
  return (
    <ResourcePage
      title="Commandes"
      subtitle="Commandes Adresse GN, offres, montants et états de traitement."
      resource="sales_orders"
    />
  );
}