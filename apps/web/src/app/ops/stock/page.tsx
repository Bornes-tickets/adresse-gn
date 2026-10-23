import type {
  Metadata,
} from "next";

import {
  ResourcePage,
} from "@/features/backoffice/components/resource-page";


export const metadata: Metadata = {
  title: "Stock — Adresse GN",
};


export default function Page() {
  return (
    <ResourcePage
      title="Stock"
      subtitle="Stock par lot, états des balises et taux de consommation."
      resource="ops_stock"
    />
  );
}