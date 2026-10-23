import type {
  Metadata,
} from "next";

import {
  ResourcePage,
} from "@/features/backoffice/components/resource-page";


export const metadata: Metadata = {
  title: "Abonnements — Adresse GN",
};


export default function Page() {
  return (
    <ResourcePage
      title="Abonnements"
      subtitle="Abonnements actifs, échéances, offres et renouvellements."
      resource="sales_subscriptions"
    />
  );
}