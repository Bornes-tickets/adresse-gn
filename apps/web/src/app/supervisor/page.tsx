import type {
  Metadata,
} from "next";

import {
  SupervisorDashboardPage,
} from "@/features/backoffice/components/supervisor-professional-pages";


export const metadata: Metadata = {
  title: "Supervision — Adresse GN",
};


export default function Page() {
  return (
    <SupervisorDashboardPage />
  );
}
