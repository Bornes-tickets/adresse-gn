import type {
  Metadata,
} from "next";

import {
  OpsDashboardPage,
} from "@/features/backoffice/components/ops-professional-pages";


export const metadata: Metadata = {
  title:
    "Opérations — Adresse GN",
};


export default function Page() {
  return (
    <OpsDashboardPage />
  );
}
