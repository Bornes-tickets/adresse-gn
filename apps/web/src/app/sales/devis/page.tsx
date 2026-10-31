import type {
  Metadata,
} from "next";

import {
  SalesOrdersPage,
} from "@/features/sales/components/sales-orders-page";


export const metadata: Metadata = {
  title: "Devis — Adresse GN",
};


export default function Page() {
  return (
    <SalesOrdersPage
      mode="quotes"
    />
  );
}