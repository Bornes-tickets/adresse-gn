import type {
  Metadata,
} from "next";

import {
  SalesReportsPage,
} from "@/features/sales/components/sales-reports-page";


export const metadata: Metadata = {
  title: "Rapports commerciaux — Adresse GN",
};


export default function Page() {
  return (
    <SalesReportsPage />
  );
}
