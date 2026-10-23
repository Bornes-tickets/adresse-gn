import type {
  Metadata,
} from "next";

import {
  ResourcePage,
} from "@/features/backoffice/components/resource-page";


export const metadata: Metadata = {
  title: "Planification — Adresse GN",
};


export default function Page() {
  return (
    <ResourcePage
      title="Planification"
      subtitle="Planning des installations et affectations terrain."
      resource="supervisor_planning"
    />
  );
}