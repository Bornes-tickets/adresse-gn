import type {
  Metadata,
} from "next";

import {
  ResourcePage,
} from "@/features/backoffice/components/resource-page";


export const metadata: Metadata = {
  title: "Utilisateurs — Adresse GN",
};


export default function Page() {
  return (
    <ResourcePage
      title="Utilisateurs"
      subtitle="Comptes, rôles métier et états d’accès Adresse GN."
      resource="admin_users"
    />
  );
}