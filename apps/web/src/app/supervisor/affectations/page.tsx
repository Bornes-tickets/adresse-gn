import type {
  Metadata,
} from "next";

import {
  SupervisorAssignmentsPage,
} from "@/features/backoffice/components/supervisor-professional-pages";


export const metadata: Metadata = {
  title: "Affectations terrain — Adresse GN",
};


export default function Page() {
  return (
    <SupervisorAssignmentsPage />
  );
}
