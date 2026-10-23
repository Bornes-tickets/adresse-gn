import type {
  Metadata,
} from "next";

import {
  ResourcePage,
} from "@/features/backoffice/components/resource-page";


export const metadata: Metadata = {
  title: "Consultations — Adresse GN",
};


export default function Page() {
  return (
    <ResourcePage
      title="Consultations"
      subtitle="Vue transversale des adresses, balises, lots, agents et communes."
      resource="supervisor_consultations"
    />
  );
}