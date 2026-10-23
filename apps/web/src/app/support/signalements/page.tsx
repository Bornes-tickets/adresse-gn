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
      subtitle="Signalements citoyens, balises concernées et états de traitement."
      resource="support_reports"
    />
  );
}