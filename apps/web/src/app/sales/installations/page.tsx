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
      subtitle="Demandes physiques en attente, affectations et planification terrain."
      resource="sales_installations"
    />
  );
}