import type {
  Metadata,
} from "next";

import {
  OwnerBeaconsPage,
} from "@/features/owner/components/owner-beacons-page";


export const metadata: Metadata = {
  title: "Mes balises",

  description:
    "Gérez vos balises Adresse GN : nom, catégorie, visibilité, QR code et signalement de déménagement.",

  robots: {
    index: false,
    follow: false,
  },
};


export default function Page() {
  return (
    <OwnerBeaconsPage />
  );
}