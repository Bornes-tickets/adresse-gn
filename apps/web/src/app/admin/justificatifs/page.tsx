import type {
  Metadata,
} from "next";

import {
  ResourcePage,
} from "@/features/backoffice/components/resource-page";


export const metadata: Metadata = {
  title: "Justificatifs — Adresse GN",
};


export default function Page() {
  return (
    <ResourcePage
      title="Justificatifs"
      subtitle="Documents associés aux installations physiques et états de revue."
      resource="admin_justificatifs"
    />
  );
}