import type {
  Metadata,
} from "next";

import {
  OwnerFavoritesPage,
} from "@/features/owner/components/owner-favorites-page";


export const metadata: Metadata = {
  title:
    "Mes favoris — Adresse GN",

  description:
    "Retrouvez vos adresses favorites Adresse GN et donnez-leur un alias mémorisable.",

  robots: {
    index: false,
    follow: false,
  },
};


export default function Page() {
  return (
    <OwnerFavoritesPage />
  );
}