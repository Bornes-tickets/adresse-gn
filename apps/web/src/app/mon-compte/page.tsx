import type {
  Metadata,
} from "next";

import {
  OwnerDashboardPage,
} from "@/features/owner/components/owner-dashboard-page";


export const metadata: Metadata = {
  title:
    "Mon compte — Adresse GN",

  description:
    "Suivez vos adresses Adresse GN : recherches, itinéraires lancés et dernières activités.",

  robots: {
    index: false,
    follow: false,
  },
};


export default function Page() {
  return (
    <OwnerDashboardPage />
  );
}