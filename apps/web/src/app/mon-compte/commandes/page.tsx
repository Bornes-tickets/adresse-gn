import type {
  Metadata,
} from "next";

import {
  OwnerOrdersPage,
} from "@/features/owner/components/owner-orders-page";


export const metadata: Metadata = {
  title:
    "Mes commandes — Adresse GN",

  description:
    "Suivez vos commandes Adresse GN, leur statut, leurs adresses concernées et leurs factures.",

  robots: {
    index: false,
    follow: false,
  },
};


export default function Page() {
  return (
    <OwnerOrdersPage />
  );
}