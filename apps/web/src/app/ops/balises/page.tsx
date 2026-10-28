import type {
  Metadata,
} from "next";

import {
  OpsBeaconsPage,
} from "@/features/backoffice/components/ops-professional-pages";


export const metadata: Metadata = {
  title:
    "Parc de balises — OPS — Adresse GN",
};


export default function Page() {
  return (
    <OpsBeaconsPage />
  );
}
