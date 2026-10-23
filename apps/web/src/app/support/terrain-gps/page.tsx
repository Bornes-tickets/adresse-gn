import type {
  Metadata,
} from "next";

import {
  SupportFieldGpsPage,
} from "@/features/backoffice/components/support-field-gps-page";


export const metadata: Metadata = {
  title:
    "Capture GPS terrain — Adresse GN",

  description:
    "Outil interne de collecte des mesures GPS terrain Adresse GN.",

  robots: {
    index: false,
    follow: false,
  },
};


export default function Page() {
  return (
    <SupportFieldGpsPage />
  );
}
