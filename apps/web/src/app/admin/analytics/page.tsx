import type {
  Metadata,
} from "next";

import {
  ResourcePage,
} from "@/features/backoffice/components/resource-page";


export const metadata: Metadata = {
  title: "Analytics — Adresse GN",
};


export default function Page() {
  return (
    <ResourcePage
      title="Analytics"
      subtitle="Indicateurs globaux d’utilisation, de recherche, d’itinéraires et d’activité."
      resource="admin_analytics"
    />
  );
}