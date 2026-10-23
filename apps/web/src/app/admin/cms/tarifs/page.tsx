import type {
  Metadata,
} from "next";

import {
  ResourcePage,
} from "@/features/backoffice/components/resource-page";


export const metadata: Metadata = {
  title: "Tarifs — Adresse GN",
};


export default function Page() {
  return (
    <ResourcePage
      title="Tarifs"
      subtitle="Catalogue actuel des offres et capacités commerciales."
      resource="cms_plans"
    />
  );
}