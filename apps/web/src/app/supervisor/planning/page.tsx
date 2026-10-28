import type {
  Metadata,
} from "next";

import {
  SupervisorPlanningPage,
} from "@/features/backoffice/components/supervisor-professional-pages";


export const metadata: Metadata = {
  title: "Planification — Adresse GN",
};


export default function Page() {
  return (
    <SupervisorPlanningPage />
  );
}
