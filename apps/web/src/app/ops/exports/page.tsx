import type {
  Metadata,
} from "next";

import {
  OpsExportsPage,
} from "@/features/backoffice/components/ops-professional-pages";


export const metadata: Metadata = {
  title: "Documents & exports — Adresse GN",
};


export default function Page() {
  return (
    <OpsExportsPage />
  );
}
