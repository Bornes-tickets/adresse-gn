import type {
  Metadata,
} from "next";

import {
  ResourcePage,
} from "@/features/backoffice/components/resource-page";


export const metadata: Metadata = {
  title: "Offres — Adresse GN",
};


export default function Page() {
  return (
    <ResourcePage
      title="Offres"
      subtitle="Catalogue commercial actuel issu du CMS des plans."
      resource="sales_offers"
    />
  );
}