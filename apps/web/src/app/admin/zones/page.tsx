import type {
  Metadata,
} from "next";

import {
  ResourcePage,
} from "@/features/backoffice/components/resource-page";


export const metadata: Metadata = {
  title: "Zones — Adresse GN",
};


export default function Page() {
  return (
    <ResourcePage
      title="Zones"
      subtitle="Régions, préfectures, communes, districts et secteurs du référentiel national."
      resource="admin_zones"
    />
  );
}