import type {
  Metadata,
} from "next";

import {
  OpsStockPage,
} from "@/features/backoffice/components/ops-professional-pages";


export const metadata: Metadata = {
  title:
    "Stock — OPS — Adresse GN",
};


export default function Page() {
  return (
    <OpsStockPage />
  );
}
