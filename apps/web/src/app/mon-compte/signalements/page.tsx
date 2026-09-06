import type {
  Metadata,
} from "next";

import {
  OwnerReportsPage,
} from "@/features/owner/components/owner-reports-page";


export const metadata: Metadata = {
  title:
    "Mes signalements — Adresse GN",

  description:
    "Suivez vos signalements, déménagements et réclamations d'adresse Adresse GN.",

  robots: {
    index: false,
    follow: false,
  },
};


export default function Page() {
  return (
    <OwnerReportsPage />
  );
}