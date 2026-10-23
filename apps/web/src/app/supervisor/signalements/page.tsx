import type {
  Metadata,
} from "next";

import {
  ResourcePage,
} from "@/features/backoffice/components/resource-page";


export const metadata: Metadata = {
  title: "Signalements — Adresse GN",
};


export default function Page() {
  return (
    <ResourcePage
      title="Signalements"
      subtitle="Signalements liés aux balises et suivi de leur traitement."
      resource="supervisor_reports"
    />
  );
}