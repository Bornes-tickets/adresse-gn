import type {
  Metadata,
} from "next";

import {
  OwnerSettingsPage,
} from "@/features/owner/components/owner-settings-page";


export const metadata: Metadata = {
  title:
    "Paramètres du compte — Adresse GN",

  description:
    "Gérez vos informations personnelles Adresse GN.",

  robots: {
    index: false,
    follow: false,
  },
};


export default function Page() {
  return (
    <OwnerSettingsPage />
  );
}