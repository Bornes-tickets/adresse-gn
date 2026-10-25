import type {
  Metadata,
} from "next";

import {
  ResourcePage,
} from "@/features/backoffice/components/resource-page";


export const metadata: Metadata = {
  title: "Installations à planifier — Adresse GN",
};


export default function Page() {
  return (
    <ResourcePage
      title="Installations à planifier"
      subtitle="Suivi commercial en lecture seule des demandes d’installation physique."
      resource="sales_installations"
    />
  );
}