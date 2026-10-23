import type {
  Metadata,
} from "next";

import {
  ResourcePage,
} from "@/features/backoffice/components/resource-page";


export const metadata: Metadata = {
  title: "Audit — Adresse GN",
};


export default function Page() {
  return (
    <ResourcePage
      title="Audit"
      subtitle="Journal d’audit global des opérations Adresse GN."
      resource="admin_audit"
    />
  );
}