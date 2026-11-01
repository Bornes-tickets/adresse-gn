import type {
  Metadata,
} from "next";

import {
  SalesDataPage,
} from "@/features/sales/components/sales-data-page";


export const metadata: Metadata = {
  title: "Offres — Adresse GN",
};


export default function Page() {
  return (
    <SalesDataPage
      mode="offers"
    />
  );
}
