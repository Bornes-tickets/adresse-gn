import type {
  Metadata,
} from "next";

import {
  ResourcePage,
} from "@/features/backoffice/components/resource-page";


export const metadata: Metadata = {
  title: "Rapport installations — Adresse GN",
};


export default function Page() {
  return (
    <ResourcePage
      title="Rapport installations"
      subtitle="Rapport consolidé des installations, agents, communes et précision GPS."
      resource="supervisor_installation_report"
    />
  );
}