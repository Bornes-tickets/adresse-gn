import type {
  Metadata,
} from "next";

import {
  ResourcePage,
} from "@/features/backoffice/components/resource-page";


export const metadata: Metadata = {
  title: "Balises — Adresse GN",
};


export default function Page() {
  return (
    <ResourcePage
      title="Balises"
      subtitle="Parc de balises, lots, affectations et version de numérotation."
      resource="ops_beacons"
    />
  );
}