import type {
  Metadata,
} from "next";

import {
  ResourcePage,
} from "@/features/backoffice/components/resource-page";


export const metadata: Metadata = {
  title: "Traductions — Adresse GN",
};


export default function Page() {
  return (
    <ResourcePage
      title="Traductions"
      subtitle="Contenus multilingues FR, EN et AR."
      resource="cms_translations"
    />
  );
}