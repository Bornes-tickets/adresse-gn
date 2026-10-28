import type {
  Metadata,
} from "next";

import {
  AdminBeaconsPage,
} from "@/features/backoffice/components/admin-beacons-page";


export const metadata: Metadata = {
  title:
    "Balises — Administration — Adresse GN",
};


export default function Page() {
  return (
    <AdminBeaconsPage />
  );
}
