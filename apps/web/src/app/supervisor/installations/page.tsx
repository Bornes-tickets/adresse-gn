import type {
  Metadata,
} from "next";

import {
  SupervisorInstallationsQcPage,
} from "@/features/backoffice/components/supervisor-professional-pages";


export const metadata: Metadata = {
  title: "Installations & QC — Adresse GN",
};


export default function Page() {
  return (
    <SupervisorInstallationsQcPage />
  );
}
