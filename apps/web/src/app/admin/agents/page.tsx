import type {
  Metadata,
} from "next";

import {
  ResourcePage,
} from "@/features/backoffice/components/resource-page";


export const metadata: Metadata = {
  title: "Agents — Adresse GN",
};


export default function Page() {
  return (
    <ResourcePage
      title="Agents"
      subtitle="Agents terrain, badges, zones et activité d’installation."
      resource="admin_agents"
    />
  );
}