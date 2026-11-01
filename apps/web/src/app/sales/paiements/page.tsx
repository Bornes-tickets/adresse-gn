import type {
  Metadata,
} from "next";

import {
  SalesPaymentsPage,
} from "@/features/sales/components/sales-payments-page";


export const metadata: Metadata = {
  title: "Paiements — Adresse GN",
};


export default function Page() {
  return (
    <SalesPaymentsPage />
  );
}
