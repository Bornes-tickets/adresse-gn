import type {
  Metadata,
} from "next";

import {
  OpsProcurementPage,
} from "@/features/backoffice/components/ops-professional-pages";


export const metadata: Metadata = {
  title:
    "Achats fournisseurs — OPS — Adresse GN",
};


export default function Page() {
  return (
    <OpsProcurementPage />
  );
}
