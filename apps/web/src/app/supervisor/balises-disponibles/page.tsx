import type {
  Metadata,
} from "next";

import {
  SupervisorAvailableBeaconsPage,
} from "@/features/backoffice/components/supervisor-professional-pages";


export const metadata: Metadata = {
  title: "Balises disponibles — Adresse GN",
};


export default function Page() {
  return (
    <SupervisorAvailableBeaconsPage />
  );
}
