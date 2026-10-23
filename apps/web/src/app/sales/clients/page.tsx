import type {
  Metadata,
} from "next";

import {
  ResourcePage,
} from "@/features/backoffice/components/resource-page";


export const metadata: Metadata = {
  title: "Clients — Adresse GN",
};


export default function Page() {
  return (
    <ResourcePage
      title="Clients"
      subtitle="Portefeuille clients, commandes et valeur commerciale."
      resource="sales_clients"
    />
  );
}